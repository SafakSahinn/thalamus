import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Note } from './types';

vi.mock('./google', async (orig) => ({
  ...(await orig<typeof import('./google')>()),
  cloud: true,
  accessToken: async () => 'tok',
  loadAuth: async () => ({ calendar: true }),
}));

const mk = (id: string, type: string, title: string, props: Record<string, unknown>): Note => ({
  id, type, title, props, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

// Bellek içi sahte Google Takvim
const events = new Map<string, Record<string, unknown>>();
let calls = 0;
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls++;
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.endsWith('/calendars') && method === 'POST') return new Response(JSON.stringify({ id: 'cal1' }), { status: 200 });
    if (/\/calendars\/cal1$/.test(u)) return new Response('{}', { status: 200 });
    const m = u.match(/\/events(?:\/([^/?]+))?$/);
    if (m) {
      const id = m[1];
      if (method === 'PUT') return events.has(id) ? (events.set(id, JSON.parse(String(init!.body))), new Response('{}')) : new Response('{}', { status: 404 });
      if (method === 'POST') {
        const b = JSON.parse(String(init!.body));
        events.set(b.id, b);
        return new Response('{}');
      }
      if (method === 'DELETE') return events.delete(id) ? new Response(null, { status: 204 }) : new Response('{}', { status: 410 });
    }
    return new Response('{}', { status: 400 });
  }) as typeof fetch;
});

describe('Google Takvim eşitlemesi', () => {
  it('etkinlik kimliği ve konferans aralığı', async () => {
    const { desiredEvents, DEFAULT_CAL_FIELDS } = await import('./gcal');
    const conf = mk('11111111-2222-3333-4444-555555555555', 'conference', 'ICASSP', { deadline: '2026-10-20', start: '2027-05-01', end: '2027-05-05' });
    const d = desiredEvents([conf], { enabled: true, fields: DEFAULT_CAL_FIELDS, reminders: [1, 7] }, 'https://x/');
    expect(d).toHaveLength(2);
    for (const e of d) expect(e.id).toMatch(/^[0-9a-v]{5,1024}$/);
    const range = d.find((e) => (e.body.start as { date: string }).date === '2027-05-01')!;
    expect(range.body.summary).toBe('ICASSP');
    expect(range.body.end).toEqual({ date: '2027-05-06' });
    const dl = d.find((e) => (e.body.summary as string).includes('Son başvuru'))!;
    expect(dl.body.end).toEqual({ date: '2026-10-21' });
    expect((dl.body.reminders as { overrides: { minutes: number }[] }).overrides.map((r) => r.minutes)).toEqual([900, 9540]);
  });

  it('oluşturur, değişmeyeni göndermez, değişeni günceller, silineni kaldırır', async () => {
    const store = await import('./store');
    const { syncCalendar } = await import('./gcal');
    await store.initLocal();
    await store.saveSettings({ ...store.useStore.getState().settings, calendar: { enabled: true, fields: ['lab.due'], reminders: [1] } });
    const lab = store.createNote('lab', 'RC deneyi', { due: '2026-10-22' });
    let r = await syncCalendar();
    expect(r).toEqual({ created: 1, updated: 0, deleted: 0 });
    expect(events.size).toBe(1);

    const before = calls;
    r = await syncCalendar();
    expect(r).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(calls - before).toBe(1); // yalnızca takvimin varlık kontrolü

    store.setProp(lab.id, 'due', '2026-10-25');
    r = await syncCalendar();
    expect(r.updated).toBe(1);
    expect([...events.values()][0].start).toEqual({ date: '2026-10-25' });

    store.setProp(lab.id, 'due', undefined);
    r = await syncCalendar();
    expect(r.deleted).toBe(1);
    expect(events.size).toBe(0);
  });
});
