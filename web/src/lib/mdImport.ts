// Markdown / Obsidian içe aktarma: bir klasör, .zip ya da tek tek .md dosyaları.
// - [[Not adı]] ve [[Not adı|görünen ad]] → Thalamus not bağlantısı (kasadaki ya da mevcut notlarda ada göre)
// - ![[görsel.png]] ve ![](görsel.png) → görsel (Drive'a ya da bu cihaza yüklenir)
// - YAML başlığı (--- … ---): title başlık olur, diğer alanlar "ek bilgi" olarak saklanır
// - Klasörler → üst sayfa; içindeki notlar onun alt sayfası olur

import type { JSONContent } from '@tiptap/core';
import JSZip from 'jszip';
import { mdToDoc } from './notionImport';
import type { Note } from './types';

export interface MdFile {
  /** Kasa içindeki göreli yol, ör. "Dersler/Doğrusal Sistemler.md" */
  path: string;
  blob: Blob;
}

const base = (p: string) => p.split('/').pop() ?? p;
const stem = (p: string) => base(p).replace(/\.md$/i, '');
const dirOf = (p: string) => p.split('/').slice(0, -1).join('/');
const keyName = (s: string) => s.trim().toLocaleLowerCase('tr');
const IGNORE = /(^|\/)(\.obsidian|\.trash|\.git|node_modules|__MACOSX)(\/|$)/;

/** Seçilen dosyalar (klasör seçiminde webkitRelativePath) ya da .zip içeriği */
export async function collectFiles(list: FileList | File[]): Promise<MdFile[]> {
  const out: MdFile[] = [];
  for (const f of [...list]) {
    if (/\.zip$/i.test(f.name)) {
      const zip = await JSZip.loadAsync(f);
      for (const e of Object.values(zip.files)) {
        if (!e.dir) out.push({ path: e.name, blob: await e.async('blob') });
      }
    } else {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      out.push({ path: rel, blob: f });
    }
  }
  // Klasör seçiminde en üstteki klasör adı her yolda var: kasanın kendi adı, sayfa olarak kullanılmaz
  const tops = new Set(out.map((f) => f.path.split('/')[0]));
  const strip = tops.size === 1 && out.every((f) => f.path.includes('/'));
  return out
    .map((f) => ({ ...f, path: strip ? f.path.split('/').slice(1).join('/') : f.path }))
    .filter((f) => !IGNORE.test(f.path));
}

/** Basit YAML başlığı: "anahtar: değer" ve "- liste" satırları */
export function parseFrontmatter(md: string): { data: Record<string, string | string[]>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: md };
  const data: Record<string, string | string[]> = {};
  let last = '';
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && last) {
      const cur = data[last];
      data[last] = [...(Array.isArray(cur) ? cur : cur ? [cur] : []), item[1].replace(/^["']|["']$/g, '')];
      continue;
    }
    const kv = line.match(/^([^:#]+):\s*(.*)$/);
    if (!kv) continue;
    last = kv[1].trim();
    const v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) data[last] = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else data[last] = v.replace(/^["']|["']$/g, '');
  }
  return { data, body: md.slice(m[0].length) };
}

/** Obsidian sözdizimini standart Markdown'a çevir (kod blokları hariç) */
export function obsidianToMd(md: string): string {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((part) => part.startsWith('```')
      ? part
      : part
        // ![[görsel.png|300]] → ![](görsel.png)
        .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, t: string) => (/\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(t.trim()) ? `![](<${t.trim()}>)` : `[[${t}]]`))
        // [[Not#başlık|ad]] → [ad](<Not.md>)
        .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t: string, alias?: string) => `[${(alias ?? t).trim()}](<${t.trim()}.md>)`))
    .join('');
}

export interface MdImportResult {
  notes: Note[];
  folders: number;
  images: number;
}

/**
 * Notları kur. existing: aynı adlı mevcut notlara da bağlantı verilir.
 * upload: görseli kaydedip editörde kullanılacak adresi döndürür.
 */
export async function buildMdNotes(
  files: MdFile[],
  existing: Note[],
  upload: (blob: Blob, name: string) => Promise<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<MdImportResult> {
  const md = files.filter((f) => /\.md$/i.test(f.path));
  const assets = new Map(files.filter((f) => !/\.md$/i.test(f.path)).map((f) => [keyName(base(f.path)), f]));
  const now = new Date().toISOString();
  const mk = (title: string, props: Record<string, unknown>, content: JSONContent | null): Note => ({
    id: crypto.randomUUID(), type: 'note', title, props, content, text: '', links: [], pinned: false,
    created_at: now, updated_at: now, deleted_at: null,
  });

  // 1) Klasörler → üst sayfalar
  const folderNotes = new Map<string, Note>();
  const folderOf = (d: string): string | undefined => {
    if (!d) return undefined;
    let n = folderNotes.get(d);
    if (!n) {
      const parent = folderOf(dirOf(d));
      n = mk(base(d), { icon: '📁', ...(parent ? { parent: [parent] } : {}) }, null);
      folderNotes.set(d, n);
    }
    return n.id;
  };

  // 2) Kimlikleri önceden ver ki bağlantılar çözülebilsin
  const parsed = await Promise.all(md.map(async (f) => {
    const { data, body } = parseFrontmatter(await f.blob.text());
    const title = typeof data.title === 'string' && data.title ? data.title : stem(f.path);
    return { f, data, body, title, id: crypto.randomUUID() };
  }));
  const byName = new Map<string, { id: string; label: string }>();
  for (const n of existing) if (!n.deleted_at && n.title) byName.set(keyName(n.title), { id: n.id, label: n.title });
  for (const p of parsed) {
    byName.set(keyName(stem(p.f.path)), { id: p.id, label: p.title });
    byName.set(keyName(p.title), { id: p.id, label: p.title });
  }

  // 3) İçerik
  const out: Note[] = [];
  const uploaded = new Map<string, string>();
  let done = 0;
  for (const p of parsed) {
    const content = await mdToDoc(obsidianToMd(p.body), {
      pagePath: p.f.path,
      resolveLink: (target) => byName.get(keyName(stem(target))) ?? null,
      resolveAsset: async (path) => {
        const k = keyName(base(path));
        if (uploaded.has(k)) return uploaded.get(k)!;
        const a = assets.get(k);
        if (!a) return null;
        const src = await upload(a.blob, base(a.path));
        uploaded.set(k, src);
        return src;
      },
    });
    const { title: _t, ...rest } = p.data;
    const extra = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v]));
    const parent = folderOf(dirOf(p.f.path));
    out.push({
      ...mk(p.title, { ...(Object.keys(extra).length ? { extra } : {}), ...(parent ? { parent: [parent] } : {}) }, content),
      id: p.id,
    });
    onProgress?.(++done, parsed.length);
  }
  return { notes: [...folderNotes.values(), ...out], folders: folderNotes.size, images: uploaded.size };
}
