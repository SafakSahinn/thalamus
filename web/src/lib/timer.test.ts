import { describe, expect, it } from 'vitest';
import { fmtMin, studyStats } from './timer';
import type { Note } from './types';

const mk = (id: string, type: string, props: Record<string, unknown>): Note => ({
  id, type, title: id, props, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

describe('çalışma süresi', () => {
  it('günlere ve derslere göre toplar; dersi olan makale ders altında sayılır', () => {
    const notes = {
      ds: mk('ds', 'course', { __time: [{ start: '2026-10-16T10:00:00', min: 50 }] }),
      kal: mk('kal', 'paper', { course: ['ds'], __time: [{ start: '2026-10-17T09:00:00', min: 25 }, { start: '2026-09-01T09:00:00', min: 99 }] }),
      tez: mk('tez', 'note', { __time: [{ start: '2026-10-17T14:00:00', min: 90 }] }),
    };
    const s = studyStats(notes, 7, new Date('2026-10-17T20:00:00'));
    expect(s.total).toBe(165);
    expect(s.days.at(-1)).toEqual({ day: '2026-10-17', min: 115 });
    expect(s.days.at(-2)).toEqual({ day: '2026-10-16', min: 50 });
    expect(s.groups.map((g) => [g.note.id, g.min])).toEqual([['tez', 90], ['ds', 75]]);
    expect(fmtMin(75)).toBe('1 sa 15 dk');
    expect(fmtMin(40)).toBe('40 dk');
  });
});
