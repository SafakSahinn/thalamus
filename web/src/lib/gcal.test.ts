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

// Bellek içi sahte Google Takvim (iptal edilenler status: cancelled ile kalır, syncToken = değişiklik sırası)
type Ev = Record<string, unknown> & { id: string; status: string; seq: number };
const all = new Map<string, Ev>();
let seq = 0;
const put = (id: string, body: Record<string, unknown>, status = 'confirmed') => all.set(id, { ...body, id, status, seq: ++seq });
const events = {
  get size() { return [...all.values()].filter((e) => e.status !== 'cancelled').length; },
  values: () => [...all.values()].filter((e) => e.status !== 'cancelled').values(),
};
let calls = 0;
beforeAll(() => {
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls++;
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.endsWith('/calendars') && method === 'POST') return new Response(JSON.stringify({ id: 'cal1' }), { status: 200 });
    if (/\/calendars\/cal1$/.test(u)) return new Response('{}', { status: 200 });
    const list = u.match(/\/events\?(.*)$/);
    if (list && method === 'GET') {
      const since = Number(new URLSearchParams(list[1]).get('syncToken') ?? 0);
      const items = [...all.values()].filter((e) => e.seq > since && (since || e.status !== 'cancelled'));
      return new Response(JSON.stringify({ items, nextSyncToken: String(seq) }));
    }
    const m = u.match(/\/events(?:\/([^/?]+))?$/);
    if (m) {
      const id = m[1];
      if (method === 'PUT') return all.has(id) ? (put(id, JSON.parse(String(init!.body))), new Response('{}')) : new Response('{}', { status: 404 });
      if (method === 'POST') {
        const b = JSON.parse(String(init!.body));
        put(b.id, b);
        return new Response('{}');
      }
      if (method === 'DELETE') {
        const e = all.get(id);
        if (!e || e.status === 'cancelled') return new Response('{}', { status: 410 });
        put(id, e, 'cancelled');
        return new Response(null, { status: 204 });
      }
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

  it('saatli etkinlik ve varsayılan alanlar', async () => {
    const { desiredEvents, calSettings, parseTime } = await import('./gcal');
    expect(parseTime('9.05')).toBe('09:05');
    expect(parseTime('25:00')).toBeNull();
    const cs = calSettings({ calendar: { enabled: true, fields: ['lab.due'], reminders: [0, 1] } } as never);
    expect(cs.fields).toContain('event.date');
    expect(calSettings({ calendar: { enabled: true, fields: [], reminders: [], eventOff: true } } as never).fields).toEqual([]);
    const ev = mk('aaaaaaaa-2222-3333-4444-555555555555', 'event', 'Danışman toplantısı', { date: '2026-10-20', time: '14:30', location: 'B-204' });
    const [d] = desiredEvents([ev], cs, 'https://x/');
    expect(d.body.summary).toBe('Danışman toplantısı');
    expect((d.body.start as { dateTime: string }).dateTime).toBe('2026-10-20T14:30:00');
    expect((d.body.end as { dateTime: string }).dateTime).toBe('2026-10-20T15:30:00');
    expect(d.body.location).toBe('B-204');
    expect((d.body.reminders as { overrides: { minutes: number }[] }).overrides.map((r) => r.minutes)).toEqual([30, 1440]);
    // Notun içeriği açıklamada okunur (bağlantıya tıklamadan)
    const withBody = { ...ev, content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Tez taslağını götür <önemli>', marks: [{ type: 'bold' }] }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bölüm 2' }] }] }] },
    ] } };
    const desc = String(desiredEvents([withBody], cs, 'https://x/')[0].body.description);
    expect(desc).toContain('<b>Tez taslağını götür &lt;önemli&gt;</b>');
    expect(desc).toContain('<ul><li>Bölüm 2</li></ul>');
    expect(desc).toContain('Thalamus’ta aç');
    expect(desc).not.toContain('Saat');
    const [allDay] = desiredEvents([{ ...ev, props: { date: '2026-10-20' } }], cs, 'https://x/');
    expect(allDay.body.start).toEqual({ date: '2026-10-20' });
  });

  it('oluşturur, değişmeyeni göndermez, değişeni günceller, silineni kaldırır', async () => {
    const store = await import('./store');
    const { syncCalendar } = await import('./gcal');
    await store.initLocal();
    await store.saveSettings({ ...store.useStore.getState().settings, calendar: { enabled: true, fields: ['lab.due'], reminders: [1] } });
    const lab = store.createNote('lab', 'RC deneyi', { due: '2026-10-22' });
    let r = await syncCalendar();
    expect(r).toEqual({ created: 1, updated: 0, deleted: 0, pulled: 0 });
    expect(events.size).toBe(1);

    const before = calls;
    r = await syncCalendar();
    expect(r).toEqual({ created: 0, updated: 0, deleted: 0, pulled: 0 });
    expect(calls - before).toBe(2); // takvimin varlık kontrolü + değişiklik okuma

    store.setProp(lab.id, 'due', '2026-10-25');
    r = await syncCalendar();
    expect(r.updated).toBe(1);
    expect([...events.values()][0].start).toEqual({ date: '2026-10-25' });

    store.setProp(lab.id, 'due', undefined);
    r = await syncCalendar();
    expect(r.deleted).toBe(1);
    expect(events.size).toBe(0);
  });

  it('Google Takvim’de taşınan tarih nota, silinen etkinlik boş alana döner', async () => {
    const store = await import('./store');
    const { syncCalendar } = await import('./gcal');
    const lab = store.createNote('lab', 'Op-amp deneyi', { due: '2026-11-02' });
    await syncCalendar();
    const ev = [...all.values()].find((e) => (e.extendedProperties as { private: { thalamus: string } } | undefined)?.private.thalamus === lab.id)!;

    // Kullanıcı takvimde etkinliği 5 Kasım'a sürükledi
    put(ev.id, { ...ev, start: { date: '2026-11-05' }, end: { date: '2026-11-06' } });
    let r = await syncCalendar();
    expect(r.pulled).toBe(1);
    expect(store.useStore.getState().notes[lab.id].props.due).toBe('2026-11-05');

    // Elle eklenen etkinliğe dokunulmaz
    put('elle1', { summary: 'Toplantı', start: { date: '2026-11-03' }, end: { date: '2026-11-04' } });
    r = await syncCalendar();
    expect(r).toMatchObject({ pulled: 0, deleted: 0 });
    expect(all.get('elle1')!.status).toBe('confirmed');

    // Thalamus'ta da aynı anda değiştiyse Thalamus kazanır
    store.setProp(lab.id, 'due', '2026-11-10');
    put(ev.id, { ...all.get(ev.id)!, start: { date: '2026-11-07' }, end: { date: '2026-11-08' } });
    await syncCalendar();
    expect(store.useStore.getState().notes[lab.id].props.due).toBe('2026-11-10');
    expect(all.get(ev.id)!.start).toEqual({ date: '2026-11-10' });

    // Kullanıcı takvimden sildi
    put(ev.id, all.get(ev.id)!, 'cancelled');
    r = await syncCalendar();
    expect(r.pulled).toBe(1);
    expect(store.useStore.getState().notes[lab.id].props.due).toBeUndefined();
    expect(all.get(ev.id)!.status).toBe('cancelled');
  });

  it('konferans aralığı takvimde uzatılınca bitiş tarihi de değişir', async () => {
    const store = await import('./store');
    const { syncCalendar } = await import('./gcal');
    await store.saveSettings({ ...store.useStore.getState().settings, calendar: { enabled: true, fields: ['conference.start', 'conference.end'], reminders: [1] } });
    const c = store.createNote('conference', 'ECC', { start: '2027-06-01', end: '2027-06-03' });
    await syncCalendar();
    const ev = [...all.values()].find((e) => (e.extendedProperties as { private: { thalamus: string } } | undefined)?.private.thalamus === c.id)!;
    put(ev.id, { ...ev, start: { date: '2027-06-02' }, end: { date: '2027-06-06' } });
    await syncCalendar();
    expect(store.useStore.getState().notes[c.id].props).toMatchObject({ start: '2027-06-02', end: '2027-06-05' });
  });
});
