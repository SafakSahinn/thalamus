import { relationIds, typeOf, type Note } from './types';

interface PMNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
}

const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'tableCell', 'tableHeader', 'blockMath']);

export function walk(node: unknown, fn: (n: PMNode) => void) {
  if (!node || typeof node !== 'object') return;
  const n = node as PMNode;
  fn(n);
  n.content?.forEach((c) => walk(c, fn));
}

/** Belgedeki [[wiki]] bağlantılarının hedef kimlikleri. */
export function wikiTargets(doc: unknown): string[] {
  const out: string[] = [];
  walk(doc, (n) => {
    if (n.type === 'wikiLink' && typeof n.attrs?.id === 'string') out.push(n.attrs.id);
  });
  return out;
}

/** Arama için düz metin (bloklar arası satır sonu). */
export function plainText(doc: unknown): string {
  const parts: string[] = [];
  const rec = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as PMNode;
    if (n.type === 'text' && n.text) parts.push(n.text);
    else if (n.type === 'wikiLink') parts.push(String(n.attrs?.label ?? ''));
    else if (n.type === 'inlineMath' || n.type === 'blockMath') parts.push(String(n.attrs?.latex ?? ''));
    n.content?.forEach(rec);
    if (n.type && BLOCKS.has(n.type)) parts.push('\n');
  };
  rec(doc);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** Bir notun giden bağlantıları: içerikteki wiki bağlantıları + relation alanları. */
export function computeLinks(note: Pick<Note, 'id' | 'type' | 'props' | 'content'>): string[] {
  const set = new Set<string>(wikiTargets(note.content));
  for (const p of typeOf(note.type).props) {
    if (p.kind === 'relation') relationIds(note.props[p.key]).forEach((id) => set.add(id));
  }
  set.delete(note.id);
  return [...set];
}

/** id → bu nota bağlantı veren notlar */
export function buildBacklinks(notes: Iterable<Note>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const n of notes) {
    if (n.deleted_at) continue;
    for (const t of n.links) {
      const arr = map.get(t);
      if (arr) arr.push(n.id);
      else map.set(t, [n.id]);
    }
  }
  return map;
}

/** Hangi alandan bağlandığını bulur (yoksa içerikten bağlanmıştır). */
export function linkVia(source: Note, targetId: string): string | null {
  for (const p of typeOf(source.type).props) {
    if (p.kind === 'relation' && relationIds(source.props[p.key]).includes(targetId)) return p.label;
  }
  return null;
}

/** Kaynak notun metninde hedef etiketin geçtiği yerin çevresi. */
export function snippetAround(source: Note, label: string, radius = 70): string | null {
  if (!label) return null;
  const text = source.text.replace(/\s+/g, ' ');
  const i = text.toLocaleLowerCase('tr').indexOf(label.toLocaleLowerCase('tr'));
  if (i < 0) return null;
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + label.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export const norm = (s: string) =>
  s.toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').trim();
