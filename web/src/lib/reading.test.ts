import { describe, expect, it } from 'vitest';
import { pace, readingStamp, readingStats } from './reading';
import type { Note } from './types';

const mk = (id: string, type: string, props: Record<string, unknown>): Note => ({
  id, type, title: id, props, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '2026-10-17T10:00:00Z', deleted_at: null,
});

describe('okuma', () => {
  it('durum değişince tarih basar, varsa dokunmaz', () => {
    expect(readingStamp('book', { status: 'Okunuyor' }, { status: 'Bitti' }, '2026-10-17')).toEqual({ finished: '2026-10-17', started: '2026-10-17' });
    expect(readingStamp('book', { status: 'Okunacak' }, { status: 'Okunuyor' }, '2026-10-17')).toEqual({ started: '2026-10-17' });
    expect(readingStamp('book', { status: 'Okunuyor' }, { status: 'Bitti', finished: '2026-10-01', started: '2026-09-01' }, '2026-10-17')).toBeNull();
    expect(readingStamp('paper', null, { status: 'Okundu' }, '2026-10-17')).toEqual({ __readAt: '2026-10-17' });
    expect(readingStamp('paper', { status: 'Okundu', x: 1 }, { status: 'Okundu', x: 2 }, '2026-10-17')).toBeNull();
  });

  it('yıla ve aya göre toplar', () => {
    const notes = {
      k1: mk('k1', 'book', { status: 'Bitti', finished: '2026-03-10', pages: 300, topics: ['c'], rating: 4 }),
      k2: mk('k2', 'book', { status: 'Bitti', finished: '2026-03-20', pages: 200, rating: 5 }),
      k3: mk('k3', 'book', { status: 'Bitti', finished: '2025-12-30', pages: 999 }),
      k4: mk('k4', 'book', { status: 'Okunuyor', pages: 100 }),
      m1: mk('m1', 'paper', { status: 'Okundu', __readAt: '2026-05-02', topics: ['c'] }),
      c: mk('c', 'concept', {}),
    };
    const s = readingStats(notes, 2026);
    expect(s.books.map((n) => n.id)).toEqual(['k2', 'k1']);
    expect(s.papers.length).toBe(1);
    expect(s.pages).toBe(500);
    expect(s.months[2]).toEqual({ books: 2, papers: 0, pages: 500 });
    expect(s.months[4].papers).toBe(1);
    expect(s.topics).toEqual([{ note: notes.c, c: 2 }]);
    expect(s.rating).toBe(4.5);
    expect(pace(6, 24, 2026, new Date(2026, 6, 2)).diff).toBe(-6);
  });
});
