// Google Takvim eşitlemesi (iki yönlü). Seçilen tarih alanları "Thalamus" adlı ayrı bir takvimde etkinlik olur;
// Thalamus'ta tarih değişince etkinlik güncellenir, not ya da tarih silinince etkinlik de silinir.
// Google Takvim'de etkinliğin tarihi değişirse nottaki tarih de değişir; etkinlik silinirse o tarih alanı boşalır.
// Elle eklenen (Thalamus'a ait olmayan) etkinliklere dokunulmaz. Yalnızca calendar.app.created izni.

import { getMeta, setMeta } from './db';
import { addDays, displayTitle } from './format';
import { accessToken, cloud, loadAuth } from './google';
import { onAfterSync, saveSettings, setProp, useStore } from './store';
import { eventDescription } from './noteHtml';
import { isTemplate } from './templates';
import { typeOf, TYPES, type Note, type Settings } from './types';

const API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarSettings {
  enabled: boolean;
  calendarId?: string;
  /** "tip.alan" listesi, ör. "conference.deadline" */
  fields: string[];
  /** Kaç gün önce hatırlatılsın (sabah 09:00) */
  reminders: number[];
  /** Kullanıcı Etkinlikler'i takvimden bilerek çıkardı (yeni varsayılan sonradan eklenmesin) */
  eventOff?: boolean;
}

export const DEFAULT_CAL_FIELDS = ['event.date', 'conference.deadline', 'conference.start', 'conference.end', 'lab.date', 'lab.due', 'talk.date'];

export function calSettings(s: Settings = useStore.getState().settings): CalendarSettings {
  const cs: CalendarSettings = { enabled: false, fields: DEFAULT_CAL_FIELDS, reminders: [1, 7], ...(s.calendar ?? {}) };
  // Etkinlikler koleksiyonu sonradan geldi: kullanıcı kapatmadıysa takvime hep gitsin
  if (!cs.eventOff && !cs.fields.includes('event.date')) cs.fields = ['event.date', ...cs.fields];
  return cs;
}

/** "14:30" / "9.05" → "14:30"; geçersizse null */
export function parseTime(v: unknown): string | null {
  const m = typeof v === 'string' ? v.trim().match(/^(\d{1,2})[:.](\d{2})$/) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Takvime eklenebilecek bütün tarih alanları (koleksiyon başına) */
export function dateFields() {
  return TYPES.filter((t) => t.id !== 'daily')
    .map((t) => ({ type: t, fields: t.props.filter((p) => p.kind === 'date') }))
    .filter((x) => x.fields.length);
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
  });
  return r;
}

/** Daha önce bu uygulamanın oluşturduğu "Thalamus" takvimi (ör. hesap silinip yeniden girildiyse) */
async function findExisting(): Promise<string | null> {
  try {
    const r = await call('/users/me/calendarList?minAccessRole=owner&maxResults=250');
    if (!r.ok) return null;
    const d = (await r.json()) as { items?: { id: string; summary?: string }[] };
    return d.items?.find((c) => c.summary === 'Thalamus')?.id ?? null;
  } catch {
    return null;
  }
}

async function ensureCalendar(cs: CalendarSettings): Promise<string> {
  if (cs.calendarId) {
    const r = await call(`/calendars/${encodeURIComponent(cs.calendarId)}`);
    if (r.ok) return cs.calendarId;
  }
  // Yeni takvim açmadan önce eskisini ara: ikinci bir "Thalamus" takvimi oluşmasın
  const old = await findExisting();
  if (old) {
    const s = useStore.getState().settings;
    await saveSettings({ ...s, calendar: { ...calSettings(s), calendarId: old } });
    await setMeta('gcalState', null);
    return old;
  }
  const r = await call('/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'Thalamus', description: 'Thalamus notlarındaki tarihler (son başvurular, teslimler, deneyler…)', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (!r.ok) throw new Error(`Takvim oluşturulamadı (${r.status})`);
  const id = ((await r.json()) as { id: string }).id;
  const s = useStore.getState().settings;
  await saveSettings({ ...s, calendar: { ...calSettings(s), calendarId: id } });
  return id;
}

const hex = (s: string) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
/** Google etkinlik kimliği: base32hex karakterleri (0-9a-v); not+alan için hep aynı → tekrar oluşmaz */
const eventId = (noteId: string, key: string) => `th${noteId.replace(/-/g, '')}${hex(key)}`;

interface Desired {
  id: string;
  body: Record<string, unknown>;
  hash: string;
}

function hashOf(o: unknown) {
  let h = 0;
  for (const c of JSON.stringify(o)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(h);
}

export function desiredEvents(notes: Note[], cs: CalendarSettings, appUrl: string): Desired[] {
  const out: Desired[] = [];
  const fields = new Set(cs.fields);
  const reminders = cs.reminders.slice(0, 5).map((d) => ({ method: 'popup', minutes: Math.max(0, d * 1440 - 9 * 60) }));
  // Saatli etkinlik: "o gün" yarım saat önce, diğerleri tam gün sayısı kadar önce
  const timedReminders = cs.reminders.slice(0, 5).map((d) => ({ method: 'popup', minutes: d ? d * 1440 : 30 }));
  const byId = Object.fromEntries(notes.map((x) => [x.id, x]));
  for (const n of notes) {
    if (n.deleted_at || isTemplate(n) || n.type === 'daily') continue;
    const t = typeOf(n.type);
    const used = new Set<string>();
    for (const def of t.props) {
      if (def.kind !== 'date' || !fields.has(`${n.type}.${def.key}`) || used.has(def.key)) continue;
      const v = n.props[def.key];
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
      let end = addDays(v, 1);
      let summary = `${displayTitle(n)} — ${def.label}`;
      // Başlangıç + bitiş birlikte seçiliyse tek, çok günlü etkinlik
      if (def.key === 'start' && fields.has(`${n.type}.end`) && typeof n.props.end === 'string' && n.props.end >= v) {
        end = addDays(n.props.end as string, 1);
        summary = displayTitle(n);
        used.add('end');
      }
      // Saati girilmiş etkinlik: takvimde saatli görünür
      const time = n.type === 'event' && def.key === 'date' ? parseTime(n.props.time) : null;
      let endTime = time ? parseTime(n.props.endTime) : null;
      if (time && (!endTime || endTime <= time)) {
        const [h, m] = time.split(':').map(Number);
        endTime = h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      const when = time
        ? { start: { dateTime: `${v}T${time}:00`, timeZone: tz() }, end: { dateTime: `${v}T${endTime}:00`, timeZone: tz() } }
        : { start: { date: v }, end: { date: end } };
      if (n.type === 'event') summary = displayTitle(n);
      const body = {
        summary,
        // Notun kendisi açıklamada okunur; bağlantıya tıklamak gerekmez
        description: eventDescription(n, byId),
        ...when,
        ...(n.type === 'event' && typeof n.props.location === 'string' && n.props.location ? { location: n.props.location } : {}),
        transparency: time ? 'opaque' : 'transparent',
        // Google'ın "Kaynağı görüntüle" bağlantısı: uyarı sayfası olmadan doğrudan notu açar
        source: { title: `Thalamus · ${displayTitle(n)}`.slice(0, 200), url: `${appUrl}#/n/${n.id}` },
        reminders: { useDefault: false, overrides: time ? timedReminders : reminders },
        extendedProperties: { private: { thalamus: n.id, field: def.key } },
      };
      out.push({ id: eventId(n.id, def.key), body, hash: hashOf(body) });
    }
  }
  return out;
}

interface CalState {
  calId: string;
  /** etkinlik kimliği → son yazılan içerik özeti */
  events: Record<string, string>;
  syncToken?: string;
}

interface GEvent {
  id: string;
  status?: string;
  updated?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

const dayOf = (t?: { date?: string; dateTime?: string }) => t?.date ?? t?.dateTime?.slice(0, 10);

/** Google Takvim'deki değişiklikleri notlara uygula; uygulanan değişiklik sayısı */
async function pullCalendar(state: CalState, base: string, localHash: Map<string, string>): Promise<number> {
  const items: GEvent[] = [];
  let page = '';
  let next = '';
  for (;;) {
    const q = new URLSearchParams({ maxResults: '250', showDeleted: 'true', singleEvents: 'true' });
    if (state.syncToken) q.set('syncToken', state.syncToken);
    if (page) q.set('pageToken', page);
    const r = await call(`${base}?${q}`);
    if (r.status === 410) {
      // Eşitleme anahtarı eskidi: baştan oku
      state.syncToken = undefined;
      return pullCalendar(state, base, localHash);
    }
    if (!r.ok) throw new Error(`Takvim okunamadı (${r.status})`);
    const d = (await r.json()) as { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string };
    items.push(...(d.items ?? []));
    if (d.nextPageToken) page = d.nextPageToken;
    else {
      next = d.nextSyncToken ?? '';
      break;
    }
  }
  const firstRun = !state.syncToken;
  state.syncToken = next || state.syncToken;
  if (firstRun) return 0; // ilk okumada yalnızca anahtarı al; mevcut etkinlikler zaten Thalamus'tan geldi
  let changed = 0;
  const notes = useStore.getState().notes;
  for (const ev of items) {
    const noteId = ev.extendedProperties?.private?.thalamus;
    const field = ev.extendedProperties?.private?.field;
    if (!noteId || !field) continue; // elle eklenen etkinlik
    const n = notes[noteId];
    if (!n || n.deleted_at) continue;
    const ours = state.events[ev.id] !== undefined;
    // Bu tarih Thalamus'ta da son eşitlemeden beri değiştiyse Thalamus kazanır (sonra takvime yazılır)
    if (ours && localHash.get(ev.id) !== state.events[ev.id]) continue;
    if (ev.status === 'cancelled') {
      if (!ours) continue; // biz sildik
      setProp(noteId, field, undefined);
      if (field === 'start' && typeof n.props.end === 'string') setProp(noteId, 'end', undefined);
      delete state.events[ev.id];
      changed++;
      continue;
    }
    const start = dayOf(ev.start);
    if (!start) continue;
    if (n.props[field] !== start) {
      setProp(noteId, field, start);
      changed++;
    }
    // Saatli etkinlik takvimde başka saate taşındıysa (dateTime yerel saatle gelir: 2026-10-20T14:30:00+03:00)
    if (n.type === 'event' && field === 'date' && ev.start?.dateTime) {
      const st = ev.start.dateTime.slice(11, 16);
      const et = ev.end?.dateTime?.slice(11, 16);
      if (parseTime(n.props.time) !== st) {
        setProp(noteId, 'time', st);
        changed++;
      }
      if (et && parseTime(n.props.endTime) !== et) {
        setProp(noteId, 'endTime', et);
        changed++;
      }
    }
    // Çok günlü konferans etkinliği: bitiş de güncellensin (Google'da bitiş tarihi hariçtir)
    if (field === 'start' && ev.end?.date) {
      const end = addDays(ev.end.date, -1);
      if (end !== start && n.props.end !== end) {
        setProp(noteId, 'end', end);
        changed++;
      }
    }
  }
  return changed;
}

let running: Promise<{ created: number; updated: number; deleted: number; pulled: number }> | null = null;

/** Takvimi notlarla eşitle (yalnız değişenler gönderilir) */
export function syncCalendar(force = false) {
  running ??= (async () => {
    const res = { created: 0, updated: 0, deleted: 0, pulled: 0 };
    try {
      const cs = calSettings();
      const auth = await loadAuth();
      if (!cloud || !cs.enabled || !auth?.calendar || !navigator.onLine) return res;
      const calId = await ensureCalendar(cs);
      const state = (await getMeta<CalState>('gcalState')) ?? { calId, events: {} };
      if (state.calId !== calId || force) Object.assign(state, { calId, events: force ? {} : state.events, syncToken: state.calId === calId ? state.syncToken : undefined });
      const base0 = `/calendars/${encodeURIComponent(calId)}/events`;
      // 1) Önce takvimdeki değişiklikleri notlara al
      const appUrl = `${location.origin}${import.meta.env.BASE_URL}`;
      const before = desiredEvents(Object.values(useStore.getState().notes), cs, appUrl);
      res.pulled = await pullCalendar(state, base0, new Map(before.map((d) => [d.id, d.hash])));
      const desired = desiredEvents(Object.values(useStore.getState().notes), cs, appUrl);
      const want = new Map(desired.map((d) => [d.id, d]));
      const base = `/calendars/${encodeURIComponent(calId)}/events`;
      for (const d of desired) {
        if (state.events[d.id] === d.hash) continue;
        // Önce güncelle (silinmiş etkinlik de geri gelir), yoksa oluştur
        let r = await call(`${base}/${d.id}`, { method: 'PUT', body: JSON.stringify({ ...d.body, status: 'confirmed' }) });
        if (r.status === 404) {
          r = await call(base, { method: 'POST', body: JSON.stringify({ ...d.body, id: d.id }) });
          if (r.ok) res.created++;
        } else if (r.ok) res.updated++;
        if (!r.ok) throw new Error(`Takvim etkinliği yazılamadı (${r.status})`);
        state.events[d.id] = d.hash;
      }
      for (const id of Object.keys(state.events)) {
        if (want.has(id)) continue;
        const r = await call(`${base}/${id}`, { method: 'DELETE' });
        if (r.ok || r.status === 404 || r.status === 410) {
          delete state.events[id];
          res.deleted++;
        }
      }
      // Kendi yazdıklarımız bir sonraki okumada tekrar gelmesin diye anahtarı ilerlet
      if (res.created || res.updated || res.deleted) {
        await pullCalendar(state, base, new Map(desired.map((d) => [d.id, d.hash]))).catch(() => undefined);
      }
      await setMeta('gcalState', state);
      await setMeta('gcalLast', new Date().toISOString());
      return res;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Eşitlemeyi kapat ve Thalamus takvimini sil */
export async function disconnectCalendar(deleteCalendar: boolean) {
  const s = useStore.getState().settings;
  const cs = calSettings(s);
  if (deleteCalendar && cs.calendarId) {
    const r = await call(`/calendars/${encodeURIComponent(cs.calendarId)}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 404) throw new Error(`Takvim silinemedi (${r.status})`);
  }
  await setMeta('gcalState', null);
  await saveSettings({ ...s, calendar: { ...cs, enabled: false, calendarId: deleteCalendar ? undefined : cs.calendarId } });
}

// Drive eşitlemesinden sonra takvimi de güncelle (en fazla dakikada bir)
let lastRun = 0;
onAfterSync(() => {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  void syncCalendar().catch(() => undefined);
});
