// Yaklaşan tarihler (son başvuru, rapor teslimi, deney, konferans…) ve takvime ekleme.

import { addDays, displayTitle } from './format';
import { todayStr } from './store';
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
  days === 0 ? 'bugün' : days === 1 ? 'yarın' : days === -1 ? 'dün' : days < 0 ? `${-days} gün önce` : `${days} gün sonra`;

const compact = (d: string) => d.replace(/-/g, '');

function eventTitle(note: Note, def: PropDef) {
  return `${displayTitle(note)} — ${def.label}`;
}

/** Google Takvim'de hazır doldurulmuş etkinlik (izin ya da giriş gerekmez) */
export function googleCalendarUrl(note: Note, def: PropDef, date: string) {
  const end = addDays(date, 1);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(note, def),
    dates: `${compact(date)}/${compact(end)}`,
    details: `Thalamus · ${typeOf(note.type).label}\n${location.origin}${location.pathname}#/n/${note.id}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Apple Takvim / Outlook için .ics (1 gün önce hatırlatıcılı) */
export function icsFile(note: Note, def: PropDef, date: string) {
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Thalamus//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${note.id}-${def.key}@thalamus`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`,
    `SUMMARY:${esc(eventTitle(note, def))}`,
    `DESCRIPTION:${esc(`${location.origin}${location.pathname}#/n/${note.id}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(eventTitle(note, def))}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
