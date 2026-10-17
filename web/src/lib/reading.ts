// Okuma istatistikleri: yıllık hedef (kitap/makale), aya göre okunan kitap ve sayfa, en çok okunan konular ve yazarlar.
// Kitap: Durum "Bitti" + Bitiş tarihi. Makale: Durum "Okundu" + gizli okunma tarihi (props.__readAt).
// Durum değişince tarihler kendiliğinden dolar (bkz. readingStamp, store.automate).

import { relationIds, type Note } from './types';

/** Durum değişikliğine göre otomatik tarih: Okunuyor → Başlama, Bitti → Bitiş, makale Okundu → okunma tarihi */
export function readingStamp(type: string, old: Record<string, unknown> | null, next: Record<string, unknown>, today: string) {
  const changed = (old?.status ?? null) !== (next.status ?? null);
  if (!changed) return null;
  const p: Record<string, unknown> = {};
  if (type === 'book') {
    if (next.status === 'Okunuyor' && !next.started) p.started = today;
    if (next.status === 'Bitti' && !next.finished) {
      p.finished = today;
      if (!next.started) p.started = today;
    }
  }
  if (type === 'paper' && next.status === 'Okundu' && !next.__readAt) p.__readAt = today;
  return Object.keys(p).length ? p : null;
}

/** Kitabın/makalenin okunup bittiği gün (yoksa null) */
export function readDay(n: Note): string | null {
  if (n.deleted_at) return null;
  if (n.type === 'book' && n.props.status === 'Bitti') {
    return typeof n.props.finished === 'string' && n.props.finished ? n.props.finished.slice(0, 10) : n.updated_at.slice(0, 10);
  }
  if (n.type === 'paper' && n.props.status === 'Okundu') {
    return typeof n.props.__readAt === 'string' ? n.props.__readAt : n.updated_at.slice(0, 10);
  }
  return null;
}

export interface ReadingGoal {
  books?: number;
  papers?: number;
}

const top = (m: Map<string, number>, notes: Record<string, Note>, k: number) =>
  [...m].map(([id, c]) => ({ note: notes[id], c })).filter((x) => x.note && !x.note.deleted_at).sort((a, b) => b.c - a.c).slice(0, k);

export function readingStats(notes: Record<string, Note>, year: number) {
  const books: Note[] = [];
  const papers: Note[] = [];
  const months = Array.from({ length: 12 }, () => ({ books: 0, papers: 0, pages: 0 }));
  const topics = new Map<string, number>();
  const authors = new Map<string, number>();
  let ratingSum = 0;
  let rated = 0;
  for (const n of Object.values(notes)) {
    const d = readDay(n);
    if (!d || Number(d.slice(0, 4)) !== year) continue;
    const m = months[Number(d.slice(5, 7)) - 1];
    if (!m) continue;
    if (n.type === 'book') {
      books.push(n);
      m.books++;
      m.pages += typeof n.props.pages === 'number' ? n.props.pages : 0;
    } else {
      papers.push(n);
      m.papers++;
    }
    for (const t of relationIds(n.props.topics)) topics.set(t, (topics.get(t) ?? 0) + 1);
    for (const a of relationIds(n.type === 'book' ? n.props.author : n.props.authors)) authors.set(a, (authors.get(a) ?? 0) + 1);
    if (typeof n.props.rating === 'number' && n.props.rating > 0) {
      ratingSum += n.props.rating;
      rated++;
    }
  }
  const byDay = (a: Note, b: Note) => (readDay(b) ?? '').localeCompare(readDay(a) ?? '');
  return {
    books: books.sort(byDay),
    papers: papers.sort(byDay),
    months,
    pages: months.reduce((a, m) => a + m.pages, 0),
    topics: top(topics, notes, 10),
    authors: top(authors, notes, 6),
    rating: rated ? ratingSum / rated : 0,
  };
}

/** Hedefe göre durum: bugüne kadar beklenen sayı (yılın geçen kısmıyla orantılı) */
export function pace(done: number, goal: number, year: number, today = new Date()) {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const frac = Math.min(1, Math.max(0, (today.getTime() - start) / (end - start)));
  const expected = goal * frac;
  return { expected, diff: Math.round(done - expected) };
}
