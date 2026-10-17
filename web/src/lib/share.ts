// Herkese açık paylaşım: notun okunabilir bir kopyası kullanıcının Drive'ındaki Thalamus klasörüne
// "bağlantıya sahip olan görebilir" ayarlı bir dosya olarak yazılır; bağlantı o dosyanın kimliğidir.
// İçindeki Drive görselleri de herkese açık yapılır. Sunucuda hiçbir şey saklanmaz.

import { propValue, showValue } from './compute';
import { displayTitle, noteIcon } from './format';
import { fnUrl } from './google';
import { publicFile, removeShareFile, setProp, unpublicFile, useStore, writeShareFile } from './store';
import { relationIds, typeOf, type Note } from './types';

interface PMNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: unknown[];
}

export const shareUrl = (id: string) => `${location.origin}${import.meta.env.BASE_URL}#/p/${id}`;

/** İçeriği herkese açık hale çevir: Drive dosyaları paylaşılır, cihazdaki dosyalar çıkarılır */
async function publicContent(doc: unknown, files: Set<string>): Promise<unknown> {
  const walk = async (n: PMNode): Promise<PMNode | null> => {
    const src = typeof n.attrs?.src === 'string' ? (n.attrs.src as string) : '';
    if ((n.type === 'image' || n.type === 'fileBlock') && src.startsWith('gd://')) {
      const id = src.slice(5).split('#')[0];
      await publicFile(id);
      files.add(id);
      const url = n.type === 'image' ? `https://drive.google.com/thumbnail?id=${id}&sz=w2000` : `https://drive.google.com/file/d/${id}/view`;
      return { ...n, attrs: { ...n.attrs, src: url } };
    }
    if ((n.type === 'image' || n.type === 'fileBlock') && src.startsWith('local://')) {
      return { type: 'paragraph', content: [{ type: 'text', text: '[Bu cihazda saklanan dosya paylaşılmadı]' }] };
    }
    if (n.type === 'wikiLink') return { type: 'text', text: String(n.attrs?.label ?? ''), marks: [{ type: 'bold' }] };
    if (!n.content) return n;
    const kids = (await Promise.all(n.content.map(walk))).filter((x): x is PMNode => x !== null);
    return { ...n, content: kids };
  };
  return doc ? walk(doc as PMNode) : null;
}

function publicProps(note: Note, notes: Record<string, Note>) {
  const out: { label: string; value: string }[] = [];
  for (const def of typeOf(note.type).props) {
    if (def.kind === 'url' && /^(gd|local):/.test(String(note.props[def.key] ?? ''))) continue;
    const v = propValue(note, def, notes);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const value = def.kind === 'relation'
      ? relationIds(v).map((id) => (notes[id] ? displayTitle(notes[id]) : '')).filter(Boolean).join(', ')
      : def.kind === 'rating' ? '★'.repeat(Number(v)) : def.kind === 'checkbox' ? (v ? '✓' : '') : showValue(v);
    if (value) out.push({ label: def.label, value });
  }
  return out;
}

export async function publishShare(note: Note): Promise<string> {
  const notes = useStore.getState().notes;
  const files = new Set<string>((note.props.__shareFiles as string[] | undefined) ?? []);
  const content = await publicContent(note.content, files);
  const page: SharedPage & { thalamus_share: 1 } = {
    thalamus_share: 1, title: displayTitle(note), icon: noteIcon(note), props: publicProps(note, notes), content,
    updated_at: new Date().toISOString(),
  };
  if (JSON.stringify(page).length > 1_900_000) throw new Error('Not paylaşmak için çok büyük.');
  const id = await writeShareFile(note.props.__share, note.id, page.title, page);
  if (note.props.__share !== id) setProp(note.id, '__share', id);
  if (files.size) setProp(note.id, '__shareFiles', [...files]);
  return id;
}

export async function unpublishShare(note: Note) {
  await removeShareFile(note.props.__share);
  for (const id of (note.props.__shareFiles as string[] | undefined) ?? []) await unpublicFile(id).catch(() => undefined);
  setProp(note.id, '__share', undefined);
  setProp(note.id, '__shareFiles', undefined);
}

export interface SharedPage {
  title: string;
  icon: string | null;
  props: { label: string; value: string }[];
  content: unknown;
  updated_at: string;
}

/** Herkese açık sayfayı oku (giriş gerekmez). Paylaşım kaldırılmışsa null. */
export async function loadShare(id: string): Promise<SharedPage | null> {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const r = await fetch(`${fnUrl}?share=${encodeURIComponent(id)}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Sayfa yüklenemedi');
  return (await r.json()) as SharedPage;
}
