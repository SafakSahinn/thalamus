// Aralıklı tekrar (SM-2, Anki'nin temel algoritması): bildiğin kart giderek seyrek, zorlandığın kart sık gelir.
// Kartlar: sözlükteki kelimeler (ön: kelime, arka: anlam/örnek) ve kavramlar (ön: kavram, arka: tanım).
// Durum notun gizli alanında: props.__srs = { due, interval, ease, reps, lapses }

import { fmtNumber, t } from '../i18n';
import type { Note } from './types';

export interface SrsState {
  /** Bir sonraki tekrar günü (YYYY-MM-DD) */
  due: string;
  /** Gün cinsinden aralık */
  interval: number;
  /** Kolaylık katsayısı (en az 1.3) */
  ease: number;
  /** Arka arkaya doğru bilme sayısı */
  reps: number;
  /** Unutma sayısı */
  lapses: number;
}

/** 0 = Tekrar (bilemedim), 3 = Zor, 4 = İyi, 5 = Kolay */
export type Grade = 0 | 3 | 4 | 5;

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export const srsOf = (n: Note): SrsState | null => (n.props.__srs && typeof n.props.__srs === 'object' ? (n.props.__srs as SrsState) : null);

/** Cevaba göre yeni durum */
export function review(prev: SrsState | null, grade: Grade, today: string): SrsState {
  const s: SrsState = prev ?? { due: today, interval: 0, ease: 2.5, reps: 0, lapses: 0 };
  if (grade === 0) {
    // Unuttu: yarın tekrar, katsayı düşer
    return { due: addDays(today, 1), interval: 1, ease: Math.max(1.3, s.ease - 0.2), reps: 0, lapses: s.lapses + 1 };
  }
  const ease = Math.max(1.3, s.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  let interval = s.reps === 0 ? (grade === 5 ? 4 : 1) : s.reps === 1 ? (grade === 5 ? 6 : 3) : Math.round(s.interval * ease);
  if (grade === 3) interval = Math.max(1, Math.round(interval * 0.8));
  if (grade === 5 && s.reps > 1) interval = Math.round(interval * 1.3);
  return { due: addDays(today, Math.max(1, interval)), interval: Math.max(1, interval), ease, reps: s.reps + 1, lapses: s.lapses };
}

/** Kart olabilecek notlar */
export const isCard = (n: Note) => !n.deleted_at && (n.type === 'word' || n.type === 'concept');

/** Bugünün destesi: vadesi gelenler (en eski önce) + en fazla `newLimit` yeni kart */
export function dueCards(notes: Note[], today: string, newLimit = 20): { due: Note[]; fresh: Note[] } {
  const due: Note[] = [];
  const fresh: Note[] = [];
  for (const n of notes) {
    if (!isCard(n)) continue;
    const s = srsOf(n);
    if (!s) {
      if (!n.props.learned) fresh.push(n);
    } else if (s.due <= today) due.push(n);
  }
  due.sort((a, b) => srsOf(a)!.due.localeCompare(srsOf(b)!.due));
  fresh.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { due, fresh: fresh.slice(0, newLimit) };
}

/** Bir sonraki aralığın yazıyla gösterimi (düğmelerin altında) */
export function intervalText(prev: SrsState | null, grade: Grade, today: string): string {
  const d = review(prev, grade, today).interval;
  return d < 30 ? t('misc.interval.days', { count: d }) : d < 365 ? t('misc.interval.months', { count: Math.round(d / 30) }) : t('misc.interval.years', { count: fmtNumber(+(d / 365).toFixed(1)) });
}

/** Günde desteye girecek yeni kart sayısı (bu cihaza özel) */
export const NEW_KEY = 'srsNewPerDay';
export const newPerDay = () => {
  try {
    return Number(localStorage.getItem(NEW_KEY)) || 20;
  } catch {
    return 20;
  }
};

