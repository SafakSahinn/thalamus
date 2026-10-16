import { typeOf, type Note } from './types';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });

/** "2026-10-16" → Date (yerel saat) */
export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const fmtDate = (s: unknown) => (typeof s === 'string' && s ? dateFmt.format(parseDay(s.slice(0, 10))) : '');
export const fmtDay = (s: string) => `${dateFmt.format(parseDay(s))}, ${dayFmt.format(parseDay(s))}`;

export function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} gün önce`;
  return dateFmt.format(new Date(iso));
}

export const addDays = (s: string, n: number) => {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Seçenek adından sabit bir renk tonu */
export function optionHue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const displayTitle = (n: { title: string; type: string; props: Record<string, unknown> }) =>
  n.type === 'daily' && typeof n.props.date === 'string' ? fmtDay(n.props.date) : n.title || 'Adsız';

/** Notun simgesi: kullanıcının seçtiği emoji, yoksa tipinin simgesi */
export const noteIcon = (n: Pick<Note, 'type' | 'props'>) => (n.props.icon as string) || typeOf(n.type).icon;
