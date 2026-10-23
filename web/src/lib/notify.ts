// Uygulama içi hatırlatmalar: tarayıcı bildirimi olarak gösterilir.
// Sunucu kullanılmadığı için yalnızca Thalamus bir sekmede ya da yüklü uygulama olarak açıkken (arka planda da olsa)
// çalışır. Uygulama tamamen kapalıyken hatırlatma için Google Takvim eşitlemesi kullanılır.

import { t } from '../i18n';
import { displayTitle } from './format';
import { parseTime } from './gcal';
import type { Note } from './types';
import { upcoming } from './upcoming';

export interface Reminder {
  /** Tekrar gösterilmesin diye benzersiz anahtar */
  key: string;
  at: number;
  title: string;
  body: string;
  noteId: string;
}

const DEADLINE = /son|teslim|başvuru|deadline|bitiş|due|end|finish/i;
const p2 = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Önümüzdeki iki gün için hatırlatma planı (saf: test edilebilir) */
export function planReminders(notes: Note[], now: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const u of upcoming(notes.filter((n) => !n.deleted_at), 2, 0, localDay(now))) {
    const name = displayTitle(u.note);
    const time = u.note.type === 'event' && u.def.key === 'date' ? parseTime(u.note.props.time) : null;
    if (time) {
      const at = new Date(`${u.date}T${time}:00`).getTime() - 30 * 60_000;
      out.push({ key: `${u.note.id}.${u.def.key}.${u.date}.${time}`, at, title: `🗓️ ${name}`, body: `${t('panels.notify.startsAt', { time })}${u.note.props.location ? ` · ${u.note.props.location}` : ''}`, noteId: u.note.id });
      continue;
    }
    // Tüm gün: o sabah 09:00; son başvuru/teslim gibi tarihlerde bir gün önce de
    out.push({ key: `${u.note.id}.${u.def.key}.${u.date}.0`, at: new Date(`${u.date}T09:00:00`).getTime(), title: `📌 ${name}`, body: t('panels.notify.today', { label: u.def.label }), noteId: u.note.id });
    if (DEADLINE.test(u.def.label)) {
      const d = new Date(`${u.date}T09:00:00`);
      d.setDate(d.getDate() - 1);
      out.push({ key: `${u.note.id}.${u.def.key}.${u.date}.1`, at: d.getTime(), title: `⏰ ${name}`, body: t('panels.notify.tomorrow', { label: u.def.label }), noteId: u.note.id });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const PREF = 'notify';
const SEEN = 'notifySeen';
export const notifyEnabled = () => {
  try {
    return localStorage.getItem(PREF) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
};

export async function enableNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') throw new Error(t('panels.notify.noSupport'));
  const p = await Notification.requestPermission();
  if (p !== 'granted') throw new Error(t('panels.notify.denied'));
  localStorage.setItem(PREF, '1');
  return true;
}

export const disableNotifications = () => localStorage.removeItem(PREF);

function seen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Bildirimi göster (yüklü uygulamada hizmet çalışanı üzerinden; tıklayınca not açılır) */
export async function showNotification(r: Pick<Reminder, 'title' | 'body' | 'noteId' | 'key'>) {
  const url = `${location.origin}${import.meta.env.BASE_URL}#/n/${r.noteId}`;
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  if (reg) await reg.showNotification(r.title, { body: r.body, tag: r.key, icon: `${import.meta.env.BASE_URL}icon-192.png`, data: { url } });
  else {
    const n = new Notification(r.title, { body: r.body, tag: r.key, icon: `${import.meta.env.BASE_URL}icon-192.png` });
    n.onclick = () => {
      window.focus();
      location.hash = `#/n/${r.noteId}`;
    };
  }
}

/** Dakikada bir: zamanı gelen (son 15 dk içinde) ve gösterilmemiş hatırlatmaları göster */
export function startReminders(getNotes: () => Note[]) {
  const tick = () => {
    if (!notifyEnabled()) return;
    const now = Date.now();
    const s = seen();
    for (const r of planReminders(getNotes(), new Date())) {
      if (r.at > now || r.at < now - 15 * 60_000 || s[r.key]) continue;
      s[r.key] = now;
      void showNotification(r);
    }
    // İki günden eski kayıtları temizle
    for (const [k, t] of Object.entries(s)) if (t < now - 2 * 864e5) delete s[k];
    try {
      localStorage.setItem(SEEN, JSON.stringify(s));
    } catch {
      /* yok say */
    }
  };
  tick();
  const id = setInterval(tick, 60_000);
  return () => clearInterval(id);
}
