import { useEffect, useState } from 'react';
import { localeTag } from '../i18n';
import { saveSettings, useStore } from './store';

// "Saat" eklentisi (Windows 7 Saat gadget'ı gibi): analog kadran, 16 kaplama, saat dilimi, ad etiketi, saniye ibresi.
// Kaplamaların 8'i Windows 7 gadget'ının kendi görselleri (public/clocks/), 8'i bizim çizdiğimiz SVG'ler.
// Gadget ekranda serbest durur (depolama göstergesiyle aynı davranış: sürükleme, sabit/kaymalı, gizleme);
// istenirse ana sayfa bileşeni olarak da eklenir. Ayarlar Settings.clock'ta, Drive'a eşitlenir.

/** Windows 7 Saat gadget'ının 8 kadranı, gadget'taki sırasıyla */
export type Win7Skin = 'trad' | 'system' | 'cronometer' | 'diner' | 'flower7' | 'modern' | 'square' | 'novelty';
export type SvgSkin = 'classic' | 'night' | 'wood' | 'flower' | 'roman' | 'aero' | 'station' | 'retro';
export type ClockSkin = Win7Skin | SvgSkin;
export const WIN7_SKINS: Win7Skin[] = ['trad', 'system', 'cronometer', 'diner', 'flower7', 'modern', 'square', 'novelty'];
export const SVG_SKINS: SvgSkin[] = ['classic', 'night', 'wood', 'flower', 'roman', 'aero', 'station', 'retro'];
export const CLOCK_SKINS: ClockSkin[] = [...WIN7_SKINS, ...SVG_SKINS];
/** varsayılan kaplama: orijinal gadget'ınki gibi geleneksel kadran */
export const DEFAULT_SKIN: ClockSkin = 'trad';
export const isWin7Skin = (k: ClockSkin): k is Win7Skin => (WIN7_SKINS as string[]).includes(k);

export interface ClockSettings {
  skin?: ClockSkin;
  /** IANA saat dilimi (Europe/Istanbul); yoksa cihazın yerel saati */
  tz?: string;
  /** kadranın içinde görünen ad */
  label?: string;
  /** saniye ibresi (varsayılan: açık) */
  seconds?: boolean;
  /** serbest gadget'ın sol üst köşesi, ekranın kesri */
  x?: number;
  y?: number;
  /** gadget gizli (ana sayfa bileşeni etkilenmez) */
  hidden?: boolean;
  /** gadget her sayfada mı yoksa yalnız ana sayfada mı görünsün (varsayılan: her sayfada) */
  scope?: 'all' | 'home';
  /** ekranda sabit mi (varsayılan) yoksa sayfayla birlikte mi kayar; kayıyorsa `y` sayfa başına göredir */
  fixed?: boolean;
}

/** Konum kaydedilmemiş gadget'ın üstten uzaklığı (px); depolama göstergesinin altında dursun */
export const CLOCK_TOP = 270;

/** Tarayıcının bildiği saat dilimleri (eski tarayıcıda yalnız yerel) */
export function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

const validTz = (tz?: string) => {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
};

/** Verilen andaki saat/dakika/saniye (seçili saat diliminde) */
export function clockParts(now: Date, tz?: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: validTz(tz), hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    .formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: n('hour'), m: n('minute'), s: n('second') };
}

/** İbre açıları (derece, saat 12 yönünden saat yönünde) */
export function handAngles({ h, m, s }: { h: number; m: number; s: number }) {
  return { hour: (h % 12) * 30 + m * 0.5, minute: m * 6 + s * 0.1, second: s * 6 };
}

/** İpucu: tam tarih ve saat, saat dilimi adıyla */
export function clockTooltip(now: Date, tz?: string) {
  return new Intl.DateTimeFormat(localeTag(), {
    timeZone: validTz(tz), dateStyle: 'full', timeStyle: 'short',
  }).format(now) + (tz ? ` · ${tz.replace(/_/g, ' ')}` : '');
}

/** Saat dilimi seçicisindeki ad: "Europe/Istanbul" → "Istanbul (Europe)" */
export const tzLabel = (tz: string) => {
  const i = tz.lastIndexOf('/');
  return i < 0 ? tz : `${tz.slice(i + 1).replace(/_/g, ' ')} (${tz.slice(0, i).replace(/_/g, ' ')})`;
};

// Gadget ve ana sayfa bileşeni aynı saniye zamanlayıcısını paylaşır
const subs = new Set<() => void>();
let timer = 0;
const tick = () => {
  subs.forEach((f) => f());
  timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
};

/** Her saniye başında yenilenen "şimdi" */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const on = () => setNow(new Date());
    subs.add(on);
    if (subs.size === 1) tick();
    return () => {
      subs.delete(on);
      if (!subs.size) clearTimeout(timer);
    };
  }, []);
  return now;
}

export const clockSettings = (): ClockSettings => useStore.getState().settings.clock ?? {};
export const useClockSettings = (): ClockSettings => useStore((s) => s.settings.clock) ?? {};

export function patchClock(patch: Partial<ClockSettings>) {
  const s = useStore.getState().settings;
  return saveSettings({ ...s, clock: { ...s.clock, ...patch } });
}

/** Ekranda sabit kalma ayarını değiştir (gadget menüsü ve Ayarlar ortak); gadget ekranda olduğu yerde kalır */
export function setClockFixed(fixed: boolean, scrollY: number) {
  const s = clockSettings();
  if ((s.fixed ?? true) === fixed) return;
  const el = document.querySelector<HTMLElement>('.clock-gadget:not(.mobile)');
  const screenTop = el ? el.getBoundingClientRect().top : (s.y ?? CLOCK_TOP / innerHeight) * innerHeight - (s.fixed === false ? scrollY : 0);
  return patchClock({ fixed, y: Math.max(0, fixed ? screenTop : screenTop + scrollY) / innerHeight });
}
