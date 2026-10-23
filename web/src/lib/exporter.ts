// Dışa aktarma: tek not (.md), bütün notlar (.zip: koleksiyon klasörleri + ekler), yazdırma.

import { localeTag, lower, t } from '../i18n';
import JSZip from 'jszip';
import { displayTitle } from './format';
import { noteToLatex } from './latex';
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
  const md = noteToMarkdown(note, { notes: useStore.getState().notes, synced: useStore.getState().settings.synced });
  download(`${safeName(displayTitle(note))}.md`, md);
}

/**
 * Notu LaTeX olarak indir: main.tex + refs.bib (atıf yapılan makaleler) + figures/ (görseller), tek .zip.
 * Overleaf'e doğrudan yüklenebilir.
 */
export async function exportNoteLatex(note: Note): Promise<{ cited: number; figures: number }> {
  const zip = new JSZip();
  const figs = new Map<string, string>();
  for (const src of assetsOf(note)) {
    if (!/\.(png|jpe?g|pdf)$/i.test(src) && !/^(gd|local):/.test(src)) continue;
    try {
      const blob = await (await fetch(await resolveFileUrl(src))).blob();
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('jpeg') ? 'jpg' : '';
      if (!ext) continue;
      const path = `figures/${t('capture.export.figure')}${figs.size + 1}.${ext}`;
      zip.file(path, blob);
      figs.set(src, path);
    } catch {
      /* görsel alınamadı: yer tutucu kalır */
    }
  }
  const s = useStore.getState();
  const r = noteToLatex(note, { notes: s.notes, synced: s.settings.synced, figure: (src) => figs.get(src) ?? null });
  zip.file('main.tex', r.tex);
  if (r.bib) zip.file('refs.bib', r.bib);
  download(`${safeName(displayTitle(note))}-latex.zip`, await zip.generateAsync({ type: 'blob' }));
  return { cited: r.cited, figures: figs.size };
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
      const [id, name = t('capture.export.file')] = rest.split('#');
      assetPath.set(src, `${t('capture.export.attachments')}/${id.slice(0, 8)}-${safeName(decodeURIComponent(name))}`);
    }
  }
  let done = 0;
  const total = list.length + assetPath.size;
  for (const n of list) {
    const folder = n.type === 'daily' ? t('capture.export.journal') : safeName(typeOf(n.type).plural);
    let base = n.type === 'daily' && typeof n.props.date === 'string' ? n.props.date : safeName(displayTitle(n));
    let path = `${folder}/${base}.md`;
    for (let i = 2; used.has(lower(path)); i++) path = `${folder}/${base} (${i}).md`;
    used.add(lower(path));
    // Notun klasöründen eklere göreli yol
    zip.file(path, noteToMarkdown(n, { notes, synced: useStore.getState().settings.synced, asset: (src) => (assetPath.has(src) ? `../${assetPath.get(src)}` : null) }));
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
  zip.file('README.md', t('capture.export.readme', { date: new Date().toLocaleString(localeTag()), notes: list.length, assets: assetPath.size - missing }));
  const blob = await zip.generateAsync({ type: 'blob' });
  download(`thalamus-${new Date().toISOString().slice(0, 10)}.zip`, blob);
  return { notes: list.length, assets: assetPath.size - missing, missing };
}

export const printNote = () => window.print();
