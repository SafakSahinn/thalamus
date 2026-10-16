// Google Takvim eşitlemesi (tek yön: Thalamus → Google Takvim). CFP Calendar'daki gibi:
// seçilen tarih alanları "Thalamus" adlı ayrı bir takvimde etkinlik olur; tarih değişince
// güncellenir, not ya da tarih silinince etkinlik de silinir. Yalnızca calendar.app.created izni.

import { getMeta, setMeta } from './db';
import { addDays, displayTitle } from './format';
import { accessToken, cloud, loadAuth } from './google';
import { onAfterSync, saveSettings, useStore } from './store';
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
}

export const DEFAULT_CAL_FIELDS = ['conference.deadline', 'conference.start', 'conference.end', 'lab.date', 'lab.due', 'talk.date'];

export const calSettings = (s: Settings = useStore.getState().settings): CalendarSettings => ({
  enabled: false, fields: DEFAULT_CAL_FIELDS, reminders: [1, 7], ...(s.calendar ?? {}),
});

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

async function ensureCalendar(cs: CalendarSettings): Promise<string> {
  if (cs.calendarId) {
    const r = await call(`/calendars/${encodeURIComponent(cs.calendarId)}`);
    if (r.ok) return cs.calendarId;
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
      const body = {
        summary,
        description: `${t.icon} ${t.label} · Thalamus\n${appUrl}#/n/${n.id}`,
        start: { date: v },
        end: { date: end },
        transparency: 'transparent',
        reminders: { useDefault: false, overrides: reminders },
        extendedProperties: { private: { thalamus: n.id, field: def.key } },
        source: { title: 'Thalamus', url: `${appUrl}#/n/${n.id}` },
      };
      out.push({ id: eventId(n.id, def.key), body, hash: hashOf(body) });
    }
  }
  return out;
}

let running: Promise<{ created: number; updated: number; deleted: number }> | null = null;

/** Takvimi notlarla eşitle (yalnız değişenler gönderilir) */
export function syncCalendar(force = false) {
  running ??= (async () => {
    const res = { created: 0, updated: 0, deleted: 0 };
    try {
      const cs = calSettings();
      const auth = await loadAuth();
      if (!cloud || !cs.enabled || !auth?.calendar || !navigator.onLine) return res;
      const calId = await ensureCalendar(cs);
      const state = (await getMeta<{ calId: string; events: Record<string, string> }>('gcalState')) ?? { calId, events: {} };
      if (state.calId !== calId || force) Object.assign(state, { calId, events: force ? {} : state.events });
      const appUrl = `${location.origin}${import.meta.env.BASE_URL}`;
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
