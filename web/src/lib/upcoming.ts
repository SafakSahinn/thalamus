// Yaklaşan tarihler (son başvuru, rapor teslimi, deney, konferans…) ve takvime ekleme.

import { t } from '../i18n';
import { addDays, displayTitle } from './format';
import { parseTime } from './gcal';
import { eventDescription } from './noteHtml';
import { todayStr, useStore } from './store';
import { typeOf, type Note, type PropDef } from './types';

export interface Upcoming {
  note: Note;
  def: PropDef;
  date: string;
  /** bugünden kaç gün sonra (geçmişse negatif) */
  days: number;
}

/** "Bitti/Teslim edildi/Katıldım" gibi tamamlanmış durumlar yaklaşanlarda gösterilmez */
const DEADLINE = /teslim|başvuru|son tarih|deadline|due|sınav/i;
const DONE = /^(bitti|okundu|izlendi|tamamland|teslim edildi|katıldım|kabul edildi|reddedildi|yarım bıraktım)/i;

export function upcoming(notes: Note[], daysAhead = 14, daysBack = 2, today = todayStr()): Upcoming[] {
  const from = addDays(today, -daysBack);
  const to = addDays(today, daysAhead);
  const out: Upcoming[] = [];
  const t0 = new Date(`${today}T12:00:00`).getTime();
  for (const n of notes) {
    if (n.type === 'daily') continue;
    const status = typeof n.props.status === 'string' ? n.props.status : '';
    for (const def of typeOf(n.type).props) {
      if (def.kind !== 'date') continue;
      const v = n.props[def.key];
      if (typeof v !== 'string' || v < from || v > to) continue;
      // Geçmiş tarihler yalnızca kaçırılmaması gereken alanlarda ve iş bitmemişse (ör. teslim edilmemiş rapor)
      if (v < today && (!DEADLINE.test(def.label) || DONE.test(status))) continue;
      if (v >= today && DONE.test(status) && DEADLINE.test(def.label)) continue;
      out.push({ note: n, def, date: v, days: Math.round((new Date(`${v}T12:00:00`).getTime() - t0) / 864e5) });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const whenText = (days: number) =>
  days === 0 ? t('panels.when.today') : days === 1 ? t('panels.when.tomorrow') : days === -1 ? t('panels.when.yesterday')
    : days < 0 ? t('panels.when.ago', { count: -days }) : t('panels.when.in', { count: days });

const compact = (d: string) => d.replace(/-/g, '');

function eventTitle(note: Note, def: PropDef) {
  return `${displayTitle(note)} — ${def.label}`;
}

/** Takvim açıklamasının düz metin hali (Google'ın şablon bağlantısı ve .ics HTML anlamaz) */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/g, '\n').replace(/<li>/g, '• ').replace(/<\/li>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}

/** Takvime eklenecek etkinliğin bilgileri: başlık, gün(ler), saat, yer, açıklama (alanlar + not içeriği) */
export function calendarEvent(note: Note, def: PropDef, date: string, notes: Record<string, Note> = useStore.getState().notes) {
  let title = eventTitle(note, def);
  let end = addDays(date, 1);
  // Başlangıç + bitiş: tek, çok günlü etkinlik
  if (def.key === 'start' && typeof note.props.end === 'string' && note.props.end >= date) {
    end = addDays(note.props.end, 1);
    title = displayTitle(note);
  }
  let time: string | null = null;
  let endTime: string | null = null;
  if (note.type === 'event' && def.key === 'date') {
    title = displayTitle(note);
    time = parseTime(note.props.time);
    endTime = time ? parseTime(note.props.endTime) : null;
    if (time && (!endTime || endTime <= time)) {
      const [h, m] = time.split(':').map(Number);
      endTime = h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const place = [note.props.location, note.props.venue].find((x) => typeof x === 'string' && x.trim()) as string | undefined;
  let text = htmlToText(eventDescription(note, notes));
  if (text.length > 1500) text = `${text.slice(0, text.lastIndexOf(' ', 1500))}…`;
  const link = `${location.origin}${location.pathname}#/n/${note.id}`;
  return { title, end, time, endTime, location: place?.trim(), details: `${text}\n\n${link}`, link };
}

const hhmm = (time: string) => `${time.replace(':', '')}00`;

/** Google Takvim'de hazır doldurulmuş etkinlik (izin ya da giriş gerekmez) */
export function googleCalendarUrl(note: Note, def: PropDef, date: string, notes?: Record<string, Note>) {
  const ev = calendarEvent(note, def, date, notes);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: ev.time && ev.endTime
      ? `${compact(date)}T${hhmm(ev.time)}/${compact(date)}T${hhmm(ev.endTime)}`
      : `${compact(date)}/${compact(ev.end)}`,
    details: ev.details,
  });
  if (ev.time) q.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (ev.location) q.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Apple Takvim / Outlook için .ics (1 gün önce hatırlatıcılı; saatli etkinlikte yarım saat önce) */
export function icsFile(note: Note, def: PropDef, date: string) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = calendarEvent(note, def, date);
  // Saat dilimi yazılmayan saat "yerel saat" sayılır
  const when = ev.time && ev.endTime
    ? [`DTSTART:${compact(date)}T${hhmm(ev.time)}`, `DTEND:${compact(date)}T${hhmm(ev.endTime)}`]
    : [`DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(ev.end)}`];
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Thalamus//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${note.id}-${def.key}@thalamus`, `DTSTAMP:${stamp}`,
    ...when,
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    `DESCRIPTION:${esc(ev.details)}`,
    `URL:${ev.link}`,
    'BEGIN:VALARM', `TRIGGER:${ev.time ? '-PT30M' : '-P1D'}`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
