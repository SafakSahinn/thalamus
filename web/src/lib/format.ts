import { localeTag, onLocaleChange, t } from '../i18n';
import { typeOf, type Note } from './types';

let dateFmt: Intl.DateTimeFormat, dayFmt: Intl.DateTimeFormat, nf: Intl.NumberFormat;
function makeFormats() {
  dateFmt = new Intl.DateTimeFormat(localeTag(), { day: 'numeric', month: 'long', year: 'numeric' });
  dayFmt = new Intl.DateTimeFormat(localeTag(), { weekday: 'long' });
  nf = new Intl.NumberFormat(localeTag());
}
makeFormats();
onLocaleChange(makeFormats);

/** "2026-10-16" → Date (yerel saat) */
/** Metin istatistikleri: kelime, karakter (boşluklu) ve dakika cinsinden okuma süresi (dakikada ~200 kelime) */
export function textStats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, chars: text.length, minutes: Math.max(1, Math.round(words / 200)) };
}
export const fmtNum = (n: number) => nf.format(n);

export const parseDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

export const fmtDate = (s: unknown) => (typeof s === 'string' && s ? dateFmt.format(parseDay(s.slice(0, 10))) : '');
export const fmtDay = (s: string) => `${dateFmt.format(parseDay(s))}, ${dayFmt.format(parseDay(s))}`;

export function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('time.justNow');
  if (diff < 3600) return t('time.minAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('time.hourAgo', { count: Math.floor(diff / 3600) });
  if (diff < 86400 * 7) return t('time.dayAgo', { count: Math.floor(diff / 86400) });
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
  n.type === 'daily' && typeof n.props.date === 'string' ? fmtDay(n.props.date) : n.title || t('common.untitled');

/** Notun simgesi: kullanıcının seçtiği emoji, yoksa tipinin simgesi */
export const noteIcon = (n: Pick<Note, 'type' | 'props'>) => (n.props.icon as string) || typeOf(n.type).icon;
