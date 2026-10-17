import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('./google', async (orig) => ({
  ...(await orig<typeof import('./google')>()),
  cloud: true,
  accessToken: async () => 'tok',
}));

const sent: { method: string; url: string; body?: Record<string, { date?: string | null; dateTime?: string | null }> }[] = [];
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      sent.push({ method, url: u, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response('{}');
    }
    if (u.includes('/calendarList')) {
      return new Response(JSON.stringify({ items: [
        { id: 'me@x', summary: 'me@x', primary: true, accessRole: 'owner', backgroundColor: '#123456' },
        { id: 'th', summary: 'Thalamus', accessRole: 'owner' },
        { id: 'tr', summary: 'Türkiye tatilleri', accessRole: 'reader' },
      ] }));
    }
    return new Response(JSON.stringify({ items: [
      { id: 'a', summary: 'ICASSP son başvuru', start: { date: '2026-10-20' }, end: { date: '2026-10-21' } },
      { id: 'b', summary: 'Konferans', start: { date: '2026-10-22' }, end: { date: '2026-10-25' } },
      { id: 'c', summary: 'Ders', recurringEventId: 'r', start: { dateTime: '2026-10-21T09:30:00' }, end: { dateTime: '2026-10-21T11:00:00' } },
      { id: 'd', status: 'cancelled', start: { date: '2026-10-23' } },
    ] }));
  }) as typeof fetch;
});

describe('diğer Google takvimleri', () => {
  it('takvimleri ve etkinlikleri okur', async () => {
    const { listCalendars, listEvents } = await import('./gcalFull');
    const cals = await listCalendars();
    expect(cals.map((c) => c.id)).toEqual(['me@x', 'tr']); // Thalamus takvimi hariç, ana takvim önce
    expect(cals[1].writable).toBe(false);
    const evs = await listEvents(cals[0], '2026-10-01', '2026-10-31');
    expect(evs).toHaveLength(3);
    expect(evs[0]).toMatchObject({ date: '2026-10-20', endDate: '2026-10-20', recurring: false });
    expect(evs[1]).toMatchObject({ date: '2026-10-22', endDate: '2026-10-24' });
    expect(evs[2]).toMatchObject({ date: '2026-10-21', time: '09:30', endTime: '11:00', recurring: true });
  });

  it('taşır, düzenler, ekler', async () => {
    const { listCalendars, listEvents, moveEvent, updateEvent, createEvent } = await import('./gcalFull');
    const [me] = await listCalendars();
    const [a, b, c] = await listEvents(me, '2026-10-01', '2026-10-31');
    await moveEvent(b, 2);
    expect(sent.at(-1)!.body).toMatchObject({ start: { date: '2026-10-24' }, end: { date: '2026-10-27' } });
    await moveEvent(c, 1);
    expect(new Date(sent.at(-1)!.body!.start.dateTime!).getDate()).toBe(22);
    await updateEvent(a, { summary: 'Yeni ad', date: '2026-10-21', time: '14:00' });
    expect(sent.at(-1)).toMatchObject({ method: 'PATCH', body: { start: { dateTime: '2026-10-21T14:00:00', date: null }, end: { dateTime: '2026-10-21T15:00:00' } } });
    await createEvent('me@x', { summary: 'Toplantı', date: '2026-10-30' });
    expect(sent.at(-1)).toMatchObject({ method: 'POST', body: { start: { date: '2026-10-30' }, end: { date: '2026-10-31' } } });
  });
});
