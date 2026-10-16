import { displayTitle } from './format';
import { norm } from './links';
import type { Note, TypeId } from './types';

interface Opts {
  types?: TypeId[];
  limit?: number;
  text?: boolean;
  exclude?: Set<string>;
}

/** Başlık (ve isteğe bağlı içerik) araması; Türkçe karakter ve büyük/küçük harf duyarsız. */
export function searchNotes(alive: Note[], query: string, opts: Opts = {}): Note[] {
  const q = norm(query);
  const scored: { n: Note; s: number }[] = [];
  for (const n of alive) {
    if (opts.types && !opts.types.includes(n.type)) continue;
    if (opts.exclude?.has(n.id)) continue;
    if (!q) {
      scored.push({ n, s: 0 });
      continue;
    }
    const t = norm(displayTitle(n));
    let s = 0;
    if (t === q) s = 100;
    else if (t.startsWith(q)) s = 80;
    else if (t.includes(q)) s = 60;
    else if (q.split(/\s+/).every((w) => t.includes(w))) s = 50;
    else if (opts.text && norm(n.text).includes(q)) s = 20;
    if (s) scored.push({ n, s });
  }
  scored.sort((a, b) => b.s - a.s || (a.n.updated_at < b.n.updated_at ? 1 : -1));
  return scored.slice(0, opts.limit ?? 50).map((x) => x.n);
}

export function findByTitle(alive: Note[], title: string, type?: TypeId): Note | undefined {
  const q = norm(title);
  return alive.find((n) => (!type || n.type === type) && norm(n.title) === q);
}
