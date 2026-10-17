import { describe, expect, it } from 'vitest';
import { planReminders } from './notify';
import type { Note } from './types';

const mk = (id: string, type: string, title: string, props: Record<string, unknown>): Note => ({
  id, type, title, props, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

describe('hatırlatma planı', () => {
  it('saatli etkinlikte 30 dk önce, son başvuruda bir gün önce ve o sabah', () => {
    const now = new Date('2026-10-17T08:00:00');
    const plan = planReminders([
      mk('e', 'event', 'Danışman toplantısı', { date: '2026-10-17', time: '14:30', location: 'B-204' }),
      mk('c', 'conference', 'ICASSP', { deadline: '2026-10-18' }),
    ], now);
    const ev = plan.find((r) => r.noteId === 'e')!;
    expect(new Date(ev.at).getHours()).toBe(14);
    expect(new Date(ev.at).getMinutes()).toBe(0);
    expect(ev.body).toContain('B-204');
    const conf = plan.filter((r) => r.noteId === 'c').map((r) => new Date(r.at).getDate());
    expect(conf).toEqual([17, 18]); // bir gün önce 09:00 ve günü 09:00
  });
});
