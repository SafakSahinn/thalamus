import { describe, expect, it } from 'vitest';
import { dueCards, review } from './srs';
import type { Note } from './types';

const T = '2026-10-17';
const mk = (id: string, type: string, props: Record<string, unknown> = {}, created = '2026-10-01'): Note => ({
  id, type, title: id, props, content: null, text: '', links: [], pinned: false, created_at: created, updated_at: created, deleted_at: null,
});

describe('aralıklı tekrar', () => {
  it('doğru bildikçe aralık büyür, unutunca başa döner', () => {
    let s = review(null, 4, T);
    expect(s).toMatchObject({ interval: 1, due: '2026-10-18', reps: 1 });
    s = review(s, 4, '2026-10-18');
    expect(s).toMatchObject({ interval: 3, due: '2026-10-21', reps: 2 });
    s = review(s, 4, '2026-10-21');
    expect(s.interval).toBe(8); // 3 × 2.5 ≈ 8
    const kolay = review(s, 5, '2026-10-29');
    const zor = review(s, 3, '2026-10-29');
    expect(kolay.interval).toBeGreaterThan(zor.interval);
    const unut = review(s, 0, '2026-10-29');
    expect(unut).toMatchObject({ interval: 1, reps: 0, lapses: 1 });
    expect(unut.ease).toBeLessThan(s.ease);
  });

  it('bugünün destesi: vadesi gelenler + sınırlı yeni kart', () => {
    const notes = [
      mk('a', 'word', { __srs: { due: '2026-10-15', interval: 3, ease: 2.5, reps: 2, lapses: 0 } }),
      mk('b', 'word', { __srs: { due: '2026-10-20', interval: 3, ease: 2.5, reps: 2, lapses: 0 } }),
      mk('c', 'concept'), mk('d', 'word', {}, '2026-09-01'), mk('e', 'word', { learned: true }), mk('f', 'book'),
    ];
    const { due, fresh } = dueCards(notes, T, 1);
    expect(due.map((n) => n.id)).toEqual(['a']);
    expect(fresh.map((n) => n.id)).toEqual(['d']);
  });
});
