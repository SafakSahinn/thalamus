// PDF vurguları: makale (ya da herhangi bir) notun gizli alanında (props.__highlights) durur; her vurgu notun
// içine de alıntı olarak eklenir, böylece okuduğun yerler notunda birikir.

import { t } from '../i18n';
import { fmtNum } from './format';
import { walk } from './links';
import { fnUrl } from './google';
import { refreshEditor, resolveFileUrl, setProp, uid, updateNote, useStore } from './store';
import { fileRefs, type Note } from './types';

export type HlColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface Highlight {
  id: string;
  /** PDF kaynağı (aynı notta birden çok PDF olabilir) */
  src: string;
  page: number;
  /** Sayfaya göre oransal dikdörtgenler [x, y, w, h] (0–1) */
  rects: [number, number, number, number][];
  text: string;
  color: HlColor;
  comment?: string;
  created_at: string;
}

export const highlightsOf = (noteId: string): Highlight[] => {
  const v = useStore.getState().notes[noteId]?.props.__highlights;
  return Array.isArray(v) ? (v as Highlight[]) : [];
};

/** Vurguyu kaydet ve notun sonuna alıntı olarak ekle */
export function addHighlight(noteId: string, h: Omit<Highlight, 'id' | 'created_at'>): Highlight {
  const full: Highlight = { ...h, id: uid(), created_at: new Date().toISOString() };
  setProp(noteId, '__highlights', [...highlightsOf(noteId), full]);
  const n = useStore.getState().notes[noteId];
  if (n) {
    const doc = (n.content as { type: string; content?: unknown[] } | null) ?? { type: 'doc', content: [] };
    const quote = {
      type: 'blockquote',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: `${h.text} ` }, { type: 'text', text: t('writing.highlights.page', { page: fmtNum(h.page) }), marks: [{ type: 'italic' }] }] }],
    };
    const extra = h.comment ? [{ type: 'paragraph', content: [{ type: 'text', text: h.comment }] }] : [];
    updateNote(noteId, { content: { ...doc, content: [...(doc.content ?? []), quote, ...extra] } });
    refreshEditor(noteId);
  }
  return full;
}

export function removeHighlight(noteId: string, id: string) {
  setProp(noteId, '__highlights', highlightsOf(noteId).filter((h) => h.id !== id));
}

const hl = (id: HlColor, css: string) => ({ id, css, get label() { return t(`writing.highlights.${id}`); } });
export const HL_COLORS: { id: HlColor; readonly label: string; css: string }[] = [
  hl('yellow', 'rgba(255, 212, 0, 0.38)'),
  hl('green', 'rgba(52, 199, 89, 0.32)'),
  hl('blue', 'rgba(64, 140, 255, 0.30)'),
  hl('pink', 'rgba(255, 92, 160, 0.30)'),
];

/** Notun PDF kaynakları: PDF alanı, Dosyalar alanları, içerikteki PDF dosya blokları */
export function pdfSources(n: Note): { src: string; label: string }[] {
  const out: { src: string; label: string }[] = [];
  const add = (src: unknown, label: string) => {
    if (typeof src === 'string' && src && !out.some((x) => x.src === src)) out.push({ src, label });
  };
  if (typeof n.props.pdf === 'string') add(n.props.pdf, t('writing.highlights.pdfField'));
  for (const [k, v] of Object.entries(n.props)) {
    for (const f of fileRefs(v)) if (/\.pdf$/i.test(f.name)) add(f.src, f.name || k);
  }
  walk(n.content, (x) => {
    const a = x.attrs as { src?: string; name?: string } | undefined;
    if (x.type === 'fileBlock' && a?.src && /\.pdf$/i.test(a.name ?? a.src)) add(a.src, a.name ?? 'PDF');
  });
  return out;
}


/** PDF baytları: Drive/cihaz dosyası, doğrudan bağlantı ya da (CORS engelinde) açık arşiv aracısı */
export async function loadPdfBytes(src: string): Promise<ArrayBuffer> {
  if (/^(gd|local):\/\//.test(src)) return (await fetch(await resolveFileUrl(src))).arrayBuffer();
  try {
    const r = await fetch(src);
    if (r.ok && (r.headers.get('content-type') ?? '').includes('pdf')) return r.arrayBuffer();
  } catch {
    /* CORS: aracıyla dene */
  }
  const r = await fetch(`${fnUrl}?pdf=${encodeURIComponent(src)}`);
  if (!r.ok) throw new Error(t('writing.highlights.cantOpen'));
  return r.arrayBuffer();
}
