import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES, type Note, type SavedView } from './types';
import { applyView, groupNotes, matches } from './views';

const book = BUILTIN_TYPES.find((t) => t.id === 'book')!;
const mk = (title: string, props: Record<string, unknown>, updated = '2026-10-01T00:00:00.000Z'): Note => ({
  id: title, type: 'book', title, props, content: null, text: '', links: [], pinned: false,
  created_at: updated, updated_at: updated, deleted_at: null,
});
const A = mk('Suç ve Ceza', { status: 'Bitti', rating: 5, finished: '2026-10-12', pages: 600 }, '2026-10-02T00:00:00.000Z');
const B = mk('Sapiens', { status: 'Okunuyor', rating: 4, pages: 456 }, '2026-10-05T00:00:00.000Z');
const C = mk('Beyaz Geceler', { status: 'Okunacak' }, '2026-10-03T00:00:00.000Z');
const all = [A, B, C];
const notes = Object.fromEntries(all.map((n) => [n.id, n]));
const view = (v: Partial<SavedView>): SavedView => ({ id: 'v', name: 'v', kind: 'table', filters: [], sort: [], ...v });
const titles = (l: Note[]) => l.map((n) => n.title);

describe('görünüm mantığı', () => {
  it('filtreler', () => {
    const now = new Date('2026-10-16T12:00:00');
    expect(matches(A, { key: 'status', op: 'is', value: 'Bitti' }, book, notes)).toBe(true);
    expect(matches(B, { key: 'rating', op: 'gte', value: 5 }, book, notes)).toBe(false);
    expect(matches(C, { key: 'rating', op: 'empty' }, book, notes)).toBe(true);
    expect(matches(A, { key: 'finished', op: 'past_week' }, book, notes, now)).toBe(true);
    expect(matches(A, { key: 'finished', op: 'before', value: '2026-10-12' }, book, notes)).toBe(false);
    expect(matches(A, { key: 'title', op: 'contains', value: 'suc' }, book, notes)).toBe(true);
  });
  it('sıralama: seçenek sırası, boşlar sonda, varsayılan son düzenlenen', () => {
    expect(titles(applyView(all, view({ sort: [{ key: 'status', dir: 'asc' }] }), book, notes))).toEqual(['Beyaz Geceler', 'Sapiens', 'Suç ve Ceza']);
    expect(titles(applyView(all, view({ sort: [{ key: 'rating', dir: 'desc' }] }), book, notes))).toEqual(['Suç ve Ceza', 'Sapiens', 'Beyaz Geceler']);
    expect(titles(applyView(all, view({}), book, notes))).toEqual(['Sapiens', 'Beyaz Geceler', 'Suç ve Ceza']);
    expect(titles(applyView(all, view({ filters: [{ key: 'pages', op: 'gt', value: 500 }] }), book, notes))).toEqual(['Suç ve Ceza']);
    expect(titles(applyView(all, view({}), book, notes, 'gece'))).toEqual(['Beyaz Geceler']);
  });
  it('filtreler "ve" ya da "veya" ile birleşir', () => {
    const f = [{ key: 'status', op: 'is', value: 'Okunuyor' }, { key: 'status', op: 'is', value: 'Okunacak' }];
    expect(titles(applyView(all, view({ filters: f }), book, notes))).toEqual([]);
    expect(titles(applyView(all, view({ filters: f, filterMode: 'or' }), book, notes))).toEqual(['Sapiens', 'Beyaz Geceler']);
  });
  it('gruplama seçenek sırasıyla', () => {
    const g = groupNotes(all, book.props.find((p) => p.key === 'status')!, notes);
    expect(g.map((x) => `${x.label}:${x.notes.length}`)).toEqual(['Okunacak:1', 'Okunuyor:1', 'Bitti:1', 'Yarım bıraktım:0', 'Boş:0']);
  });
});
