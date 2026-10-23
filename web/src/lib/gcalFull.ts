// Kullanıcının bütün Google takvimleri (ana takvim, CFP Calendar etkinlikleri, ders programı…).
// İsteğe bağlı "tam takvim" izniyle: Thalamus Takvim sayfasında görünür, taşınır, düzenlenir, silinir, eklenir.
// Hiçbir şey sunucuya gitmez; istekler tarayıcıdan doğrudan Google'a. Notlara dönüşmez (Thalamus takviminden farklı).

import { t } from '../i18n';
import { calSettings, call } from './gcal';

export interface ExtCal {
  id: string;
  summary: string;
  color: string;
  primary: boolean;
  writable: boolean;
}

export interface ExtEvent {
  id: string;
  calId: string;
  summary: string;
  /** Yerel gün (YYYY-MM-DD) */
  date: string;
  /** Tüm gün etkinliklerde son gün (dahil) */
  endDate: string;
  /** Saatli etkinlikte yerel saatler */
  time?: string;
  endTime?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  recurring: boolean;
  raw: GEvent;
}

interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}

const p2 = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const localTime = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const shiftDay = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n));
};
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function ok(r: Response, what: string) {
  if (!r.ok) {
    const b = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`${what} (${r.status}${b.error?.message ? `: ${b.error.message}` : ''})`);
  }
  return r;
}

/** Thalamus'un kendi takvimi dışındaki bütün takvimler */
export async function listCalendars(): Promise<ExtCal[]> {
  const own = calSettings().calendarId;
  const r = await ok(await call('/users/me/calendarList?maxResults=250'), t('dialogs.gcal.listFailed'));
  const d = (await r.json()) as { items?: { id: string; summary?: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; accessRole?: string }[] };
  return (d.items ?? [])
    .filter((c) => c.id !== own && c.summary !== 'Thalamus')
    .map((c) => ({
      id: c.id,
      summary: c.summaryOverride ?? c.summary ?? c.id,
      color: c.backgroundColor ?? '#4285f4',
      primary: Boolean(c.primary),
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.summary.localeCompare(b.summary, 'tr'));
}

function toExt(e: GEvent, calId: string): ExtEvent | null {
  if (e.status === 'cancelled' || !e.start) return null;
  const base = { id: e.id, calId, summary: e.summary || t('dialogs.extEvent.untitled'), location: e.location, description: e.description, htmlLink: e.htmlLink, recurring: Boolean(e.recurringEventId), raw: e };
  if (e.start.date) {
    const endDate = e.end?.date ? shiftDay(e.end.date, -1) : e.start.date;
    return { ...base, date: e.start.date, endDate: endDate < e.start.date ? e.start.date : endDate };
  }
  if (!e.start.dateTime) return null;
  const s = new Date(e.start.dateTime);
  const en = e.end?.dateTime ? new Date(e.end.dateTime) : s;
  return { ...base, date: localDay(s), endDate: localDay(s), time: localTime(s), endTime: localTime(en) };
}

/** [from, to] günleri arasındaki etkinlikler (tekrar edenler tek tek) */
export async function listEvents(cal: ExtCal, from: string, to: string): Promise<ExtEvent[]> {
  const out: ExtEvent[] = [];
  let page = '';
  do {
    const q = new URLSearchParams({
      timeMin: new Date(`${from}T00:00:00`).toISOString(),
      timeMax: new Date(`${shiftDay(to, 1)}T00:00:00`).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    if (page) q.set('pageToken', page);
    const r = await ok(await call(`/calendars/${encodeURIComponent(cal.id)}/events?${q}`), t('dialogs.gcal.readFailed', { name: cal.summary }));
    const d = (await r.json()) as { items?: GEvent[]; nextPageToken?: string };
    for (const e of d.items ?? []) {
      const x = toExt(e, cal.id);
      if (x) out.push(x);
    }
    page = d.nextPageToken ?? '';
  } while (page);
  return out;
}

export interface EventInput {
  summary: string;
  date: string;
  /** Boşsa tüm gün */
  time?: string;
  endTime?: string;
  location?: string;
}

function body(v: EventInput) {
  if (!v.time) return { summary: v.summary, location: v.location ?? '', start: { date: v.date, dateTime: null }, end: { date: shiftDay(v.date, 1), dateTime: null } };
  let end = v.endTime && v.endTime > v.time ? v.endTime : '';
  if (!end) {
    const [h, m] = v.time.split(':').map(Number);
    end = h >= 23 ? '23:59' : `${p2(h + 1)}:${p2(m)}`;
  }
  return {
    summary: v.summary,
    location: v.location ?? '',
    start: { dateTime: `${v.date}T${v.time}:00`, timeZone: tz(), date: null },
    end: { dateTime: `${v.date}T${end}:00`, timeZone: tz(), date: null },
  };
}

const evUrl = (calId: string, id = '') => `/calendars/${encodeURIComponent(calId)}/events${id ? `/${encodeURIComponent(id)}` : ''}`;

export async function createEvent(calId: string, v: EventInput) {
  await ok(await call(evUrl(calId), { method: 'POST', body: JSON.stringify(body(v)) }), t('dialogs.gcal.addFailed'));
}

export async function updateEvent(ev: ExtEvent, v: EventInput) {
  // Çok günlü tüm gün etkinliğin süresini koru
  const b = body(v);
  if (!v.time && ev.endDate > ev.date && !ev.time) b.end = { date: shiftDay(v.date, Math.round((Date.parse(ev.endDate) - Date.parse(ev.date)) / 86_400_000) + 1), dateTime: null };
  await ok(await call(evUrl(ev.calId, ev.id), { method: 'PATCH', body: JSON.stringify(b) }), t('dialogs.gcal.updateFailed'));
}

/** Sürükle-bırak: etkinliği gün sayısı kadar kaydır (saati ve süresi aynı kalır) */
export async function moveEvent(ev: ExtEvent, days: number) {
  const s = ev.raw.start ?? {};
  const e = ev.raw.end ?? {};
  const shift = (t: { date?: string; dateTime?: string; timeZone?: string }) =>
    t.date ? { date: shiftDay(t.date, days) } : { dateTime: new Date(Date.parse(t.dateTime!) + days * 86_400_000).toISOString(), timeZone: t.timeZone ?? tz() };
  await ok(await call(evUrl(ev.calId, ev.id), { method: 'PATCH', body: JSON.stringify({ start: shift(s), end: shift(e) }) }), t('dialogs.gcal.moveFailed'));
}

export async function deleteEvent(ev: ExtEvent) {
  const r = await call(evUrl(ev.calId, ev.id), { method: 'DELETE' });
  if (!r.ok && r.status !== 410 && r.status !== 404) await ok(r, t('dialogs.gcal.deleteFailed'));
}

/** Açıklamayı (HTML olabilir) düz metne çevir */
export function plainDescription(html?: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n'), 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
