// Dışa aktarma: tek not (.md), bütün notlar (.zip: koleksiyon klasörleri + ekler), yazdırma.

import JSZip from 'jszip';
import { displayTitle } from './format';
import { noteToMarkdown, safeName } from './markdown';
import { resolveFileUrl, useStore } from './store';
import { isTemplate } from './templates';
import { typeOf, type Note } from './types';

export function download(name: string, data: Blob | string, type = 'text/markdown;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportNoteMd(note: Note) {
  const md = noteToMarkdown(note, { notes: useStore.getState().notes });
  download(`${safeName(displayTitle(note))}.md`, md);
}

/** Notta geçen ekler (gd:// veya local://) */
function assetsOf(note: Note): string[] {
  const out = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const x = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };
    const src = x.attrs?.src;
    if ((x.type === 'image' || x.type === 'fileBlock') && typeof src === 'string' && /^(gd|local):\/\//.test(src)) out.add(src);
    x.content?.forEach(walk);
  };
  walk(note.content);
  for (const v of Object.values(note.props)) if (typeof v === 'string' && /^(gd|local):\/\//.test(v)) out.add(v);
  return [...out];
}

export async function exportAllZip(onProgress?: (done: number, total: number) => void): Promise<{ notes: number; assets: number; missing: number }> {
  const notes = useStore.getState().notes;
  const list = Object.values(notes).filter((n) => !n.deleted_at && !isTemplate(n));
  const zip = new JSZip();
  const used = new Set<string>();
  const assetPath = new Map<string, string>();
  for (const n of list) {
    for (const src of assetsOf(n)) {
      if (assetPath.has(src)) continue;
      const [, rest] = src.split('://');
      const [id, name = 'dosya'] = rest.split('#');
      assetPath.set(src, `ekler/${id.slice(0, 8)}-${safeName(decodeURIComponent(name))}`);
    }
  }
  let done = 0;
  const total = list.length + assetPath.size;
  for (const n of list) {
    const folder = n.type === 'daily' ? 'Günlükler' : safeName(typeOf(n.type).plural);
    let base = n.type === 'daily' && typeof n.props.date === 'string' ? n.props.date : safeName(displayTitle(n));
    let path = `${folder}/${base}.md`;
    for (let i = 2; used.has(path.toLocaleLowerCase('tr')); i++) path = `${folder}/${base} (${i}).md`;
    used.add(path.toLocaleLowerCase('tr'));
    // Notun klasöründen eklere göreli yol
    zip.file(path, noteToMarkdown(n, { notes, asset: (src) => (assetPath.has(src) ? `../${assetPath.get(src)}` : null) }));
    onProgress?.(++done, total);
  }
  let missing = 0;
  for (const [src, path] of assetPath) {
    try {
      const url = await resolveFileUrl(src);
      zip.file(path, await (await fetch(url)).blob());
    } catch {
      missing++;
    }
    onProgress?.(++done, total);
  }
  zip.file('README.md', `# Thalamus dışa aktarımı\n\n${new Date().toLocaleString('tr-TR')} tarihinde oluşturuldu. ${list.length} not, ${assetPath.size - missing} ek.\n\nHer koleksiyon ayrı bir klasörde; not alanları dosyaların başındaki YAML bölümünde. Bağlantılar [[Not adı]] biçiminde olduğu için klasör Obsidian'da doğrudan açılabilir.\n`);
  const blob = await zip.generateAsync({ type: 'blob' });
  download(`thalamus-${new Date().toISOString().slice(0, 10)}.zip`, blob);
  return { notes: list.length, assets: assetPath.size - missing, missing };
}

export const printNote = () => window.print();
