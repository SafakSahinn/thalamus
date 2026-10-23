// Arayüz dili (i18n). Tasarım:
// - Kaynak dil Türkçe (locales/tr). Anahtar kümesinin tek doğruluk kaynağı odur; öbür diller
//   `Messages` tipine uymak zorunda, eksik ya da fazla anahtar derleme hatası verir.
// - Dil tercihi temadaki gibi: 'system' (tarayıcı dili, değişince izlenir) ya da sabit bir dil.
//   Cihaza özeldir (localStorage), Drive'a eşitlenmez.
// - Türkçe pakete gömülü gelir; öbür diller ilk gerektiğinde ayrı parça olarak yüklenir.
// - Bileşenler doğrudan t() çağırır. Dil değişince App ağacı yeniden kurulur (bkz. App.tsx, useLocale),
//   bu yüzden çeviri içeren modül düzeyindeki sabitler fonksiyon olarak yazılmalıdır.
// Yeni dil eklemek: locales/<kod>/ klasörünü tr'nin kopyası olarak çevir, LOCALES'e bir satır ekle.

import { createElement, Fragment, type ReactNode } from 'react';
import { create } from 'zustand';
import tr from './locales/tr';
import type { GroupKey, Messages, Msg, MsgKey, PluralMsg } from './types';

export type { GroupKey, Messages, MsgKey } from './types';

interface LocaleInfo {
  /** Dilin kendi dilindeki adı (seçicide her zaman böyle gösterilir) */
  name: string;
  /** Intl için varsayılan bölge etiketi; tarayıcı aynı dilde başka bölge söylüyorsa o kullanılır */
  tag: string;
  load: () => Promise<Messages>;
}

export const LOCALES = {
  tr: { name: 'Türkçe', tag: 'tr-TR', load: async () => tr },
  en: { name: 'English', tag: 'en-US', load: () => import('./locales/en').then((m) => m.default) },
} satisfies Record<string, LocaleInfo>;

export type Locale = keyof typeof LOCALES;
export type LocalePref = 'system' | Locale;

export const SOURCE_LOCALE: Locale = 'tr';
/** Tarayıcı dili desteklenmiyorsa kullanılacak dil */
export const FALLBACK_LOCALE: Locale = 'en';
export const LOCALE_IDS = Object.keys(LOCALES) as Locale[];

const isLocale = (x: unknown): x is Locale => typeof x === 'string' && x in LOCALES;

/** Tarayıcının dil listesinden ilk desteklenen dil: önce tam eşleşme (pt-br), sonra ana dil (pt) */
export function detectLocale(langs: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Locale {
  for (const raw of langs) {
    const l = raw.toLowerCase();
    if (isLocale(l)) return l;
    const base = l.split('-')[0];
    if (isLocale(base)) return base;
  }
  return FALLBACK_LOCALE;
}

export function getLocalePref(): LocalePref {
  try {
    const v = localStorage.getItem('lang');
    return isLocale(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export const resolveLocale = (pref: LocalePref): Locale => (pref === 'system' ? detectLocale() : pref);

interface I18nState {
  locale: Locale;
  messages: Messages;
}

/** Etkin dil: t() buradan okur; mağaza yalnız React'e haber vermek için (dinleyiciler ondan önce güncel dili görür) */
let active: I18nState = { locale: SOURCE_LOCALE, messages: tr };
const useI18n = create<I18nState>(() => active);

/** Dil değişince yeniden çizilmesi gereken kökler için */
export const useLocale = () => useI18n((s) => s.locale);
export const getLocale = () => active.locale;

/** Intl (tarih, sayı, sıralama) için BCP 47 etiketi: tarayıcı aynı dilin bir bölgesini söylüyorsa o (en-GB gibi) */
export function localeTag(locale: Locale = getLocale()): string {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [];
  return langs.find((l) => l.toLowerCase().split('-')[0] === locale && l.includes('-')) ?? LOCALES[locale].tag;
}

const listeners = new Set<(l: Locale) => void>();
/** Dil değişmeden hemen önce (ağaç yeniden kurulmadan) çalışır: modül önbelleklerini tazelemek için */
export function onLocaleChange(fn: (l: Locale) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function activate(locale: Locale) {
  const messages = await LOCALES[locale].load();
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  active = { locale, messages };
  for (const fn of listeners) fn(locale);
  useI18n.setState(active);
}

let systemWatch = false;
/** Uygulama açılırken bir kez: tercih edilen dili yükler, 'system' ise tarayıcı dilini izler */
export async function initI18n() {
  await activate(resolveLocale(getLocalePref()));
  if (!systemWatch && typeof window !== 'undefined') {
    systemWatch = true;
    window.addEventListener('languagechange', () => {
      if (getLocalePref() === 'system') void activate(detectLocale());
    });
  }
}

export async function setLocalePref(pref: LocalePref) {
  try {
    if (pref === 'system') localStorage.removeItem('lang');
    else localStorage.setItem('lang', pref);
  } catch {
    /* gizli sekme */
  }
  await activate(resolveLocale(pref));
}

// --- Çeviri ---

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralForm(msg: PluralMsg, count: number, locale: Locale): string {
  let pr = pluralRules.get(locale);
  if (!pr) pluralRules.set(locale, (pr = new Intl.PluralRules(LOCALES[locale].tag)));
  if (count === 0 && msg.zero !== undefined) return msg.zero;
  return msg[pr.select(count)] ?? msg.other;
}

function lookup(messages: Messages, key: string): Msg | undefined {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' || (cur && typeof cur === 'object' && 'other' in cur) ? (cur as Msg) : undefined;
}

export type Params = Record<string, string | number>;

/** Ham metni bulur: etkin dil → kaynak dil → anahtarın kendisi (geliştirmede uyarır) */
function raw(key: string, count: number | undefined): string {
  const { locale, messages } = active;
  let m = lookup(messages, key);
  let loc = locale;
  if (m === undefined) {
    m = lookup(tr, key);
    loc = SOURCE_LOCALE;
    if (import.meta.env.DEV) console.warn(`[i18n] eksik anahtar: ${key} (${locale})`);
  }
  if (m === undefined) return key;
  return typeof m === 'string' ? m : pluralForm(m, count ?? 0, loc);
}

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * Çeviri: t('market.install'), t('market.count', { count: 3 }).
 * {ad} yer tutucuları params'tan doldurulur; mesaj çoğul biçimliyse params.count'a göre seçilir.
 */
export function t(key: MsgKey, params?: Params): string {
  const s = raw(key, typeof params?.count === 'number' ? params.count : undefined);
  return params ? s.replace(PLACEHOLDER, (all, name: string) => (name in params ? String(params[name]) : all)) : s;
}

// Zengin metin: {ad} yer tutucuları + mesajın içinde yazılabilen basit etiketler (<b>, <i>, <code>, <br>)
const RICH = /<(b|i|code)>(.*?)<\/\1>|<br\s*\/?>|\{(\w+)\}/g;

function richParts(s: string, params: Record<string, ReactNode>, keyBase = ''): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(RICH)) {
    parts.push(s.slice(last, m.index));
    const key = `${keyBase}${parts.length}`;
    if (m[1]) parts.push(createElement(m[1], { key }, ...richParts(m[2], params, `${key}.`)));
    else if (m[3]) parts.push(m[3] in params ? createElement(Fragment, { key }, params[m[3]]) : m[0]);
    else parts.push(createElement('br', { key }));
    last = m.index + m[0].length;
  }
  parts.push(s.slice(last));
  return parts;
}

/** Metnin içine öğe yerleştirmek için: t.rich('x', { kbd: <kbd>Ctrl K</kbd> }); mesajdaki <b>…</b> gibi etiketler öğeye dönüşür */
t.rich = function rich(key: MsgKey, params: Record<string, ReactNode> = {}): ReactNode {
  return richParts(raw(key, typeof params.count === 'number' ? params.count : undefined), params);
};

/** Bir mesaj grubunu yazıldığı sırayla liste olarak döndürür (madde listeleri, paragraflar) */
export function tList(key: GroupKey): string[] {
  const { messages } = active;
  const get = (m: Messages) => key.split('.').reduce<unknown>((o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined), m);
  const g = get(messages) ?? get(tr);
  return g && typeof g === 'object' ? Object.values(g).filter((x): x is string => typeof x === 'string') : [];
}

/** Anahtar dinamikse (ör. `types.${id}`) var olup olmadığını sorar */
export const hasMsg = (key: string) => lookup(active.messages, key) !== undefined || lookup(tr, key) !== undefined;
/** Kaynak dildeki metin (ör. eski adla yazılmış formülleri çözmek için) */
export const tSource = (key: string) => {
  const m = lookup(tr, key);
  return typeof m === 'string' ? m : m?.other ?? key;
};
/** Dinamik anahtar için: yoksa yedek metni döndürür */
export const tOr = (key: string, fallback: string, params?: Params) => (hasMsg(key) ? t(key as MsgKey, params) : fallback);

// --- Biçimlendirme ---

export const fmtNumber = (n: number, o?: Intl.NumberFormatOptions) => n.toLocaleString(localeTag(), o);
/** Gün adları; varsayılan pazartesiden başlar (takvim ızgaraları), mondayFirst=false ise Date.getDay() sırası */
export function weekdays(style: 'short' | 'long' | 'narrow' = 'short', mondayFirst = true): string[] {
  const f = new Intl.DateTimeFormat(localeTag(), { weekday: style });
  // 1 Ocak 2024 pazartesi, 7 Ocak 2024 pazar
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, mondayFirst ? 1 + i : i === 0 ? 7 : i)));
}

/** Arama/sıralama için dile duyarlı küçük harf (Türkçede I → ı) */
export const lower = (s: string) => s.toLocaleLowerCase(localeTag());
