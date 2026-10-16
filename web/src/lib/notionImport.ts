import { generateJSON, type JSONContent } from '@tiptap/core';
import JSZip from 'jszip';
import { marked } from 'marked';
import Papa from 'papaparse';
import { schemaExtensions } from '../editor/extensions';
import { norm } from './links';
import { TYPE_MAP, type Note, type PropDef, type TypeId } from './types';

// Notion "Markdown & CSV" dışa aktarımını okur.
// Dosya adları "Başlık <32 hex>.md" biçimindedir; veritabanları "Ad <hex>.csv" (+ "_all.csv")
// ve satır sayfaları "Ad <hex>/" klasöründedir.

export interface NPage {
  key: string;
  path: string;
  title: string;
  body: string;
  dbKey?: string;
  row?: Record<string, string>;
}

export interface NDatabase {
  key: string;
  name: string;
  folder: string;
  columns: string[];
  titleColumn: string;
  rows: Record<string, string>[];
}

export interface Parsed {
  databases: NDatabase[];
  pages: NPage[];
  assets: Map<string, JSZip.JSZipObject>;
}

const HASH = /\s([0-9a-f]{32})$/i;

const stripExt = (p: string) => p.replace(/\.[^./]+$/, '');
const base = (p: string) => p.split('/').pop() ?? p;
const dir = (p: string) => p.split('/').slice(0, -1).join('/');

export function cleanName(name: string) {
  return stripExt(name).replace(/_all$/, '').replace(HASH, '').trim();
}

export function keyOf(path: string) {
  const m = stripExt(base(path)).replace(/_all$/, '').match(HASH);
  return m ? m[1].toLowerCase() : stripExt(path).replace(/_all$/, '');
}

export function resolvePath(fromDir: string, rel: string) {
  const out = fromDir ? fromDir.split('/') : [];
  for (const seg of rel.split('/')) {
    if (seg === '..') out.pop();
    else if (seg && seg !== '.') out.push(seg);
  }
  return out.join('/');
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

async function collect(zip: JSZip, files: Map<string, JSZip.JSZipObject>, depth = 0) {
  for (const f of Object.values(zip.files)) {
    if (f.dir) continue;
    if (/\.zip$/i.test(f.name) && depth < 2) {
      await collect(await JSZip.loadAsync(await f.async('blob')), files, depth + 1);
    } else {
      files.set(f.name.replace(/\\/g, '/'), f);
    }
  }
}

export async function readNotionZip(data: Blob | ArrayBuffer | Uint8Array): Promise<Parsed> {
  const files = new Map<string, JSZip.JSZipObject>();
  await collect(await JSZip.loadAsync(data), files);

  // Veritabanları: "_all.csv" varsa onu tercih et (görünüm filtresi uygulanmamış tam liste)
  const csvs = new Map<string, string>();
  for (const p of files.keys()) {
    if (!/\.csv$/i.test(p)) continue;
    const folder = stripExt(p).replace(/_all$/, '');
    if (!csvs.has(folder) || /_all\.csv$/i.test(p)) csvs.set(folder, p);
  }
  const databases: NDatabase[] = [];
  for (const [folder, p] of csvs) {
    const text = (await files.get(p)!.async('string')).replace(/^﻿/, '');
    const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const columns = (res.meta.fields ?? []).map((c) => c.replace(/^﻿/, ''));
    const rows = res.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/^﻿/, ''), (v ?? '').trim()])));
    databases.push({ key: keyOf(p), name: cleanName(base(p)), folder, columns, titleColumn: columns[0] ?? 'Name', rows });
  }

  const pages: NPage[] = [];
  const assets = new Map<string, JSZip.JSZipObject>();
  for (const [p, f] of files) {
    if (/\.md$/i.test(p)) {
      let md = (await f.async('string')).replace(/^﻿/, '').replace(/\r\n/g, '\n');
      let title = cleanName(base(p));
      const h = md.match(/^#\s+(.+)\n?/);
      if (h) {
        title = h[1].trim();
        md = md.slice(h[0].length);
      }
      const db = databases.find((d) => d.folder === dir(p));
      pages.push({ key: keyOf(p), path: p, title, body: md, dbKey: db?.key });
    } else if (!/\.csv$/i.test(p)) {
      assets.set(p, f);
    }
  }

  // Satır sayfalarını CSV satırlarıyla eşleştir ve özellik satırlarını gövdeden ayıkla
  for (const db of databases) {
    const dbPages = pages.filter((pg) => pg.dbKey === db.key);
    const used = new Set<NPage>();
    for (const row of db.rows) {
      const title = row[db.titleColumn] ?? '';
      const pg = dbPages.find((x) => !used.has(x) && x.title === title) ?? dbPages.find((x) => !used.has(x) && norm(x.title) === norm(title));
      if (pg) {
        used.add(pg);
        pg.row = row;
      } else {
        pages.push({ key: `row:${db.key}:${pages.length}`, path: `${db.folder}/${title}`, title, body: '', dbKey: db.key, row });
      }
    }
    const colSet = new Set(db.columns.map((c) => c.toLowerCase()));
    for (const pg of dbPages) {
      const lines = pg.body.replace(/^\n+/, '').split('\n');
      let i = 0;
      while (i < lines.length && lines[i].includes(':') && colSet.has(lines[i].slice(0, lines[i].indexOf(':')).trim().toLowerCase())) i++;
      if (i > 0) pg.body = lines.slice(i).join('\n');
    }
  }
  return { databases, pages, assets };
}

// ---------- eşleme ----------

const TYPE_GUESS: [RegExp, TypeId][] = [
  [/kitap|book|okuma|reading/, 'book'],
  [/makale|paper|article|bildiri|yayin|publication|literatur|literature/, 'paper'],
  [/film|movie|dizi|series|sinema|cinema/, 'movie'],
  [/soylesi|podcast|talk|konusma|seminer|webinar|video|youtube/, 'talk'],
  [/kelime|word|vocab|sozluk|dictionary/, 'word'],
  [/ders|course|lecture|class/, 'course'],
  [/kisi|people|person|yazar|author/, 'person'],
  [/kavram|concept|etiket|tag|topic|konu/, 'concept'],
  [/gunluk|daily|journal|rutin|habit|aliskanlik|gun\b/, 'daily'],
];

export function guessType(name: string): TypeId {
  const n = norm(name);
  return TYPE_GUESS.find(([re]) => re.test(n))?.[1] ?? 'note';
}

const SYN: Record<string, string[]> = {
  author: ['author', 'authors', 'yazar', 'yazarlar', 'writer'],
  authors: ['author', 'authors', 'yazar', 'yazarlar'],
  status: ['status', 'durum', 'state'],
  rating: ['rating', 'puan', 'score', 'stars', 'yildiz', 'degerlendirme'],
  topics: ['tags', 'tag', 'etiket', 'etiketler', 'konu', 'konular', 'topic', 'topics', 'kategori', 'category', 'alan'],
  started: ['start', 'started', 'baslama', 'baslangic', 'start date'],
  finished: ['finish', 'finished', 'bitis', 'end', 'end date', 'date read', 'okunma tarihi'],
  date: ['date', 'tarih', 'gun', 'created'],
  year: ['year', 'yil'],
  url: ['url', 'link', 'baglanti'],
  doi: ['doi', 'url', 'link', 'baglanti'],
  cover: ['cover', 'kapak', 'poster', 'afis', 'image', 'gorsel'],
  venue: ['venue', 'journal', 'dergi', 'conference', 'konferans'],
  meaning: ['meaning', 'anlam', 'anlami', 'definition', 'tanim', 'karsilik', 'turkce'],
  language: ['language', 'dil'],
  example: ['example', 'ornek', 'sentence', 'cumle'],
  director: ['director', 'yonetmen'],
  speakers: ['speaker', 'speakers', 'konusmaci', 'konusmacilar'],
  course: ['course', 'ders'],
  pages: ['pages', 'sayfa', 'sayfa sayisi'],
  definition: ['definition', 'tanim', 'aciklama'],
  kind: ['type', 'tur', 'tip', 'kind'],
};

export type ColTarget = string; // prop anahtarı | 'new' | 'extra' | 'skip' | 'routine'

export function guessColumn(col: string, type: TypeId, sample: string[]): ColTarget {
  const c = norm(col);
  const props = TYPE_MAP[type].props;
  const direct = props.find((p) => norm(p.label) === c || p.key === c);
  if (direct) return direct.key;
  for (const p of props) if (SYN[p.key]?.includes(c)) return p.key;
  if (type === 'daily' && sample.length && sample.every((v) => /^(yes|no|true|false|evet|hayir|)$/i.test(v))) return 'routine';
  return 'new';
}

/** Tanınmayan bir Notion sütunu için en uygun alan türü (yeni alan oluştururken) */
export function inferKind(values: string[]): Pick<PropDef, 'kind' | 'options' | 'target'> {
  const vals = values.map((v) => v.trim()).filter(Boolean);
  if (!vals.length) return { kind: 'text' };
  if (vals.every((v) => /^(yes|no|true|false|evet|hayır|hayir)$/i.test(v))) return { kind: 'checkbox' };
  if (vals.some((v) => /\([^)]*\.md\)/.test(v))) return { kind: 'relation', target: ['note'] };
  if (vals.every((v) => parseDate(v))) return { kind: 'date' };
  if (vals.every((v) => /^-?\d+([.,]\d+)?$/.test(v))) return { kind: 'number' };
  if (vals.every((v) => /^https?:\/\//.test(v))) return { kind: 'url' };
  if (vals.every((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))) return { kind: 'email' };
  if (vals.every((v) => /^⭐+$/.test(v))) return { kind: 'rating' };
  const parts = vals.flatMap((v) => v.split(/,\s*/));
  const distinct = [...new Set(parts)];
  const short = distinct.every((p) => p.length <= 40);
  if (short && distinct.length <= Math.max(12, vals.length / 3)) {
    const multi = vals.some((v) => v.includes(','));
    return { kind: multi ? 'multiselect' : 'select', options: distinct };
  }
  return { kind: vals.some((v) => v.length > 80) ? 'longtext' : 'text' };
}

// ---------- değer dönüştürme ----------

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6, temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
};
const p2 = (n: number) => String(n).padStart(2, '0');

export function parseDate(v: string): string | undefined {
  const s = v.split('→')[0].trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${p2(+m[2])}-${p2(+m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${p2(+m[2])}-${p2(+m[1])}`; // Türkiye biçimi gün/ay/yıl
  m = norm(s).match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[3]}-${p2(MONTHS[m[1]])}-${p2(+m[2])}`;
  m = norm(s).match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (m && MONTHS[m[2]]) return `${m[3]}-${p2(MONTHS[m[2]])}-${p2(+m[1])}`;
  return undefined;
}

/** "Ad (Klasör/Ad hash.md), Diğer" → [{title, path?}] */
export function parseRelation(v: string): { title: string; path?: string }[] {
  const out: { title: string; path?: string }[] = [];
  const re = /([^,(]+?)\s*\(([^)]*\.md)\)/g;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(v))) {
    any = true;
    out.push({ title: m[1].trim(), path: safeDecode(m[2]) });
  }
  if (any) return out;
  return v.split(/,\s*/).map((t) => t.trim()).filter(Boolean).map((title) => ({ title }));
}

// ---------- Markdown → editör belgesi ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mathToHtml(md: string) {
  return md
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith('```')) return part;
      return part
        .replace(/^\$\$\s*\n?([\s\S]+?)\n?\s*\$\$\s*$/gm, (_, tex: string) => `\n<div data-type="block-math" data-latex="${esc(tex.trim())}"></div>\n`)
        .replace(/(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<!\s)\$(?![$\w])/g, (_, tex: string) => `<span data-type="inline-math" data-latex="${esc(tex)}"></span>`);
    })
    .join('');
}

export interface DocCtx {
  pagePath: string;
  resolveLink: (target: string) => { id: string; label: string } | null;
  resolveAsset: (path: string) => Promise<string | null>;
}

export async function mdToDoc(md: string, ctx: DocCtx): Promise<JSONContent | null> {
  if (!md.trim()) return null;
  const html = marked.parse(mathToHtml(md), { async: false, gfm: true, breaks: false }) as string;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const from = dir(ctx.pagePath);

  for (const a of [...doc.querySelectorAll('a[href]')]) {
    const href = a.getAttribute('href') ?? '';
    if (/^[a-z]+:/i.test(href) || href.startsWith('#')) continue;
    const target = resolvePath(from, safeDecode(href.split('#')[0]));
    const hit = ctx.resolveLink(target);
    if (hit) {
      const w = doc.createElement('a');
      w.setAttribute('data-type', 'wiki-link');
      w.setAttribute('data-id', hit.id);
      w.setAttribute('data-label', hit.label);
      w.textContent = hit.label;
      a.replaceWith(w);
    } else if (/\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(target)) {
      const src = await ctx.resolveAsset(target);
      if (src && /\.(png|jpe?g|gif|webp|svg)$/i.test(target)) {
        const img = doc.createElement('img');
        img.setAttribute('src', src);
        a.replaceWith(img);
      } else a.replaceWith(doc.createTextNode(a.textContent ?? ''));
    }
  }
  for (const img of [...doc.querySelectorAll('img[src]')]) {
    const src = img.getAttribute('src') ?? '';
    if (/^(https?:|data:|sb:)/i.test(src)) continue;
    const url = await ctx.resolveAsset(resolvePath(from, safeDecode(src)));
    if (url) img.setAttribute('src', url);
    else img.replaceWith(doc.createTextNode(`[görsel: ${safeDecode(base(src))}]`));
  }
  // Görev listeleri
  for (const ul of [...doc.querySelectorAll('ul')]) {
    const lis = [...ul.children].filter((c) => c.tagName === 'LI');
    if (!lis.length || !lis.every((li) => li.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]'))) continue;
    ul.setAttribute('data-type', 'taskList');
    for (const li of lis) {
      const box = li.querySelector('input[type=checkbox]') as HTMLInputElement;
      li.setAttribute('data-type', 'taskItem');
      li.setAttribute('data-checked', String(box.hasAttribute('checked')));
      box.remove();
    }
  }
  // Notion "callout" kutuları (<aside>) → bilgi kutusu; baştaki emoji kutunun simgesi olur
  for (const aside of [...doc.querySelectorAll('aside')]) {
    const box = doc.createElement('div');
    box.setAttribute('data-type', 'callout');
    const html = aside.innerHTML.trim();
    const m = html.match(/^(\p{Extended_Pictographic}️?)\s*/u);
    box.setAttribute('data-emoji', m ? m[1] : '💡');
    box.innerHTML = /^<(p|h\d|ul|ol|div|blockquote|pre)/i.test(m ? html.slice(m[0].length) : html)
      ? (m ? html.slice(m[0].length) : html)
      : `<p>${m ? html.slice(m[0].length) : html}</p>`;
    aside.replaceWith(box);
  }
  return generateJSON(doc.body.innerHTML, schemaExtensions());
}

// ---------- not üretimi ----------

export interface DbMapping {
  type: TypeId;
  columns: Record<string, ColTarget>;
}

export interface BuildOpts {
  mappings: Record<string, DbMapping>;
  pageType: TypeId;
  existing: Note[];
  upload?: (blob: Blob, name: string) => Promise<string>;
  onProgress?: (done: number, total: number) => void;
}

export interface BuildResult {
  notes: Note[];
  routines: string[];
  skipped: number;
}

export async function buildNotes(parsed: Parsed, opts: BuildOpts): Promise<BuildResult> {
  const now = new Date().toISOString();
  const already = new Map<string, Note>();
  for (const n of opts.existing) if (typeof n.props.notion_id === 'string') already.set(n.props.notion_id, n);

  const typeFor = (pg: NPage): TypeId => (pg.dbKey ? opts.mappings[pg.dbKey]?.type ?? 'note' : opts.pageType);
  const ids = new Map<NPage, string>();
  const byKey = new Map<string, NPage>();
  const byPath = new Map<string, NPage>();
  for (const pg of parsed.pages) {
    ids.set(pg, already.get(pg.key)?.id ?? crypto.randomUUID());
    byKey.set(pg.key, pg);
    byPath.set(stripExt(pg.path), pg);
  }

  const created: Note[] = [];
  const named = new Map<string, string>(); // tip|başlık → id
  for (const n of opts.existing) if (!n.deleted_at) named.set(`${n.type}|${norm(n.title)}`, n.id);
  for (const pg of parsed.pages) named.set(`${typeFor(pg)}|${norm(pg.title)}`, ids.get(pg)!);

  const mk = (type: TypeId, title: string, props: Record<string, unknown> = {}, content: unknown = null): Note => ({
    id: crypto.randomUUID(), type, title, props, content, text: '', links: [], pinned: false,
    created_at: now, updated_at: now, deleted_at: null,
  });
  const ensureNamed = (type: TypeId, title: string) => {
    const k = `${type}|${norm(title)}`;
    let id = named.get(k);
    if (!id) {
      const n = mk(type, title, { notion_import: true });
      created.push(n);
      id = n.id;
      named.set(k, id);
    }
    return id;
  };

  const pageFor = (path: string) => byKey.get(keyOf(path)) ?? byPath.get(stripExt(path));
  const resolveLink = (target: string) => {
    if (!/\.md$/i.test(target) && !HASH.test(stripExt(base(target)))) return null;
    const pg = pageFor(target);
    return pg ? { id: ids.get(pg)!, label: pg.title } : null;
  };

  const assetCache = new Map<string, string | null>();
  const resolveAsset = async (path: string) => {
    if (assetCache.has(path)) return assetCache.get(path)!;
    const f = parsed.assets.get(path);
    let url: string | null = null;
    if (f) {
      const blob = await f.async('blob');
      const typed = new Blob([blob], { type: mime(path) });
      if (opts.upload) url = await opts.upload(typed, base(path)).catch(() => null);
      else if (typed.size < 400_000) url = await toDataUrl(typed);
    }
    assetCache.set(path, url);
    return url;
  };

  const routines = new Set<string>();
  const out: Note[] = [];
  let skipped = 0;
  let done = 0;
  for (const pg of parsed.pages) {
    opts.onProgress?.(done++, parsed.pages.length);
    if (already.has(pg.key)) {
      skipped++;
      continue;
    }
    const type = typeFor(pg);
    const def = TYPE_MAP[type];
    const props: Record<string, unknown> = { notion_id: pg.key };
    const extra: Record<string, string> = {};
    const mapping = pg.dbKey ? opts.mappings[pg.dbKey] : undefined;
    const db = parsed.databases.find((d) => d.key === pg.dbKey);
    if (pg.row && mapping && db) {
      for (const col of db.columns) {
        if (col === db.titleColumn) continue;
        const raw = pg.row[col] ?? '';
        if (!raw) continue;
        const target = mapping.columns[col] ?? 'extra';
        if (target === 'skip') continue;
        if (target === 'extra') {
          extra[col] = raw;
          continue;
        }
        if (target === 'routine') {
          if (/^(yes|true|evet)$/i.test(raw)) {
            routines.add(col);
            props.routines = { ...((props.routines as Record<string, boolean>) ?? {}), [`notion:${norm(col)}`]: true };
          }
          continue;
        }
        const pd = def.props.find((p) => p.key === target);
        if (!pd) {
          extra[col] = raw;
          continue;
        }
        const val = convert(pd, raw, (title, path) => {
          if (path) {
            const hit = pageFor(path);
            if (hit) return ids.get(hit)!;
          }
          return ensureNamed(pd.target?.[0] ?? 'note', title);
        });
        if (val === undefined) extra[col] = raw;
        else props[pd.key] = val;
      }
    }
    if (Object.keys(extra).length) props.extra = extra;
    // Notion alt sayfası: "Üst sayfa <hash>/Alt sayfa <hash>.md"
    const parentPg = byPath.get(dir(pg.path));
    if (parentPg && parentPg !== pg) props.parent = [ids.get(parentPg)!];
    let title = pg.title;
    if (type === 'daily') {
      const d = (props.date as string) ?? parseDate(pg.title);
      if (d) {
        props.date = d;
        title = d;
      }
    }
    const content = await mdToDoc(pg.body, { pagePath: pg.path, resolveLink, resolveAsset });
    out.push({ ...mk(type, title, props, content), id: ids.get(pg)! });
  }
  opts.onProgress?.(parsed.pages.length, parsed.pages.length);
  return { notes: [...out, ...created], routines: [...routines], skipped };
}

function convert(pd: PropDef, raw: string, rel: (title: string, path?: string) => string): unknown {
  switch (pd.kind) {
    case 'text':
    case 'longtext':
    case 'url':
      return raw;
    case 'number': {
      const n = parseFloat(raw.replace(',', '.'));
      return Number.isFinite(n) ? n : undefined;
    }
    case 'date':
      return parseDate(raw);
    case 'select':
      return raw.split(/,\s*/)[0];
    case 'multiselect':
      return raw.split(/,\s*/).filter(Boolean);
    case 'checkbox':
      return /^(yes|true|evet)$/i.test(raw) || undefined;
    case 'rating': {
      const stars = [...raw].filter((c) => c === '⭐' || c === '★').length;
      const n = stars || parseFloat(raw);
      return Number.isFinite(n) && n > 0 ? Math.min(5, Math.round(n)) : undefined;
    }
    case 'relation': {
      const list = [...new Set(parseRelation(raw).map((r) => rel(r.title, r.path)))];
      return list.length ? list : undefined;
    }
  }
}

function mime(p: string) {
  const ext = p.split('.').pop()!.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', pdf: 'application/pdf' } as Record<string, string>)[ext] ?? 'application/octet-stream';
}

function toDataUrl(b: Blob) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}
