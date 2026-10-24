import { create } from 'zustand';
import { fmtNumber, localeTag } from '../i18n';
import { driveStorage, saveSettings, useStore } from './store';

// "Depolama göstergesi" eklentisi (Windows 7 CPU meter gadget'ı gibi): Drive'ın toplam/boş alanı ve
// Thalamus klasörünün kapladığı yer. Bulut yoksa tarayıcının bu siteye ayırdığı alan gösterilir.
// Son ölçüm bu cihazda önbellekte durur (gösterge açılır açılmaz boş kalmasın); açılışta, 10 dakikada bir
// ve elle yenilenir. Görünüm/kaplama/konum ayarları Settings.meter'da, Drive'a eşitlenir.

export type MeterView = 'win7' | 'ring' | 'pie' | 'badge';
export type MeterSkin = 'original' | 'night' | 'silver' | 'aero' | 'green' | 'carbon';
export type MeterSize = 'large' | 'small';

export const VIEWS: MeterView[] = ['win7', 'ring', 'pie', 'badge'];
export const SKINS: MeterSkin[] = ['original', 'night', 'silver', 'aero', 'green', 'carbon'];

export interface MeterSettings {
  view?: MeterView;
  skin?: MeterSkin;
  size?: MeterSize;
  /** serbest gadget'ın sol üst köşesi, ekranın kesri */
  x?: number;
  y?: number;
  /** gadget gizli (ana sayfa bileşeni etkilenmez) */
  hidden?: boolean;
  /** gadget her sayfada mı yoksa yalnız ana sayfada mı görünsün (varsayılan: her sayfada) */
  scope?: 'all' | 'home';
}

export interface MeterData {
  /** true: Drive yok, tarayıcı depolaması gösteriliyor */
  local: boolean;
  /** toplam alan (bayt); sınırsız hesapta yok */
  limit?: number;
  usage: number;
  thalamus: number;
  at: number;
}

const CACHE = 'driveMeter';
const EVERY = 10 * 60_000;

const readCache = (): MeterData | null => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) ?? 'null');
  } catch {
    return null;
  }
};

export const useMeter = create<{ data: MeterData | null; loading: boolean; error: string | null }>(() => ({
  data: readCache(),
  loading: false,
  error: null,
}));

async function measure(): Promise<MeterData> {
  // Geliştirmede bulutsuz sunucuda Drive görünümünü denemek için: localStorage.meterMock = '{"limit":..,"usage":..,"thalamus":..}'
  if (import.meta.env.DEV) {
    const mock = localStorage.getItem('meterMock');
    if (mock) return { local: false, ...JSON.parse(mock), at: Date.now() };
  }
  const d = await driveStorage();
  if (d) return { local: false, ...d, at: Date.now() };
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const usage = est?.usage ?? 0;
  return { local: true, limit: est?.quota, usage, thalamus: usage, at: Date.now() };
}

let running: Promise<void> | null = null;

export function refreshMeter(): Promise<void> {
  running ??= (async () => {
    useMeter.setState({ loading: true });
    try {
      const data = await measure();
      useMeter.setState({ data, error: null });
      try {
        localStorage.setItem(CACHE, JSON.stringify(data));
      } catch { /* yoksay */ }
    } catch (e) {
      useMeter.setState({ error: (e as Error).message });
    } finally {
      useMeter.setState({ loading: false });
      running = null;
    }
  })();
  return running;
}

// Gadget ve ana sayfa bileşeni aynı zamanlayıcıyı paylaşır
let users = 0;
let timer = 0;
export function watchMeter() {
  if (users++ === 0) {
    const d = useMeter.getState().data;
    if (!d || Date.now() - d.at > 60_000) void refreshMeter();
    timer = window.setInterval(() => void refreshMeter(), EVERY);
  }
  return () => {
    if (--users === 0) clearInterval(timer);
  };
}

/** Küçük kadranın ölçeği: en az 1 GB, aşılırsa 2, 5, 10, 20… GB */
export function smallScale(bytes: number) {
  const GB = 1024 ** 3;
  let max = GB;
  for (let i = 0; bytes > max; i++) max = [2, 5, 10][i % 3] * 10 ** Math.floor(i / 3) * GB;
  return max;
}

/** Kadranların değerleri (0-1) */
export function meterValues(d: MeterData) {
  return {
    fill: d.limit ? Math.min(d.usage / d.limit, 1) : 0,
    small: Math.min(d.thalamus / smallScale(d.thalamus), 1),
    share: d.usage ? d.thalamus / d.usage : 0,
  };
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** 12,4 GB · 38 MB (1024 tabanlı; Google da böyle gösterir) */
export function fmtBytes(n: number) {
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i >= 3 && n < 100 ? 1 : 0;
  return new Intl.NumberFormat(localeTag(), { style: 'unit', unit: UNITS[i], unitDisplay: 'short', maximumFractionDigits: digits }).format(n);
}

export const fmtPct = (x: number) => fmtNumber(x, { style: 'percent', maximumFractionDigits: x > 0 && x < 0.1 ? 1 : 0 });

export const meterSettings = (): MeterSettings => useStore.getState().settings.meter ?? {};
export const useMeterSettings = (): MeterSettings => useStore((s) => s.settings.meter) ?? {};

export function patchMeter(patch: Partial<MeterSettings>) {
  const s = useStore.getState().settings;
  return saveSettings({ ...s, meter: { ...s.meter, ...patch } });
}
