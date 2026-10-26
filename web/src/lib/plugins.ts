import { getLocale, SOURCE_LOCALE, t, tList, type Locale } from '../i18n';
import { stripPatterns, stripShapes } from './sticky';
import { saveSettings, useStore } from './store';
import type { Settings } from './types';

// Eklenti marketi: çekirdek dışındaki özellikler varsayılan olarak kurulu gelmez, Market sayfasından kurulur.
// Katalog şimdilik yalnız bizim yayınladığımız yerleşik eklentilerden oluşur (kodla birlikte gelir).
// Kurulu listesi Settings.installed'da tutulur ve Drive'a eşitlenir. Kaldırmak veriyi silmez, yalnız gizler.

export type PluginId = 'sticky' | 'stickyArt' | 'stickyShape' | 'otd' | 'drivemeter';
export type PluginCategory = 'home' | 'tool';

export interface Plugin {
  id: PluginId;
  icon: string;
  category: PluginCategory;
  author: string;
  /** çalışması için kurulu olması gereken eklentiler: kurarken onlar da kurulur, onlar kaldırılınca bu da kaldırılır */
  requires?: PluginId[];
  // Aşağıdakiler etkin dilden okunur (i18n: plugins.<id>.*)
  readonly name: string;
  /** kartta görünen tek satırlık tanıtım */
  readonly summary: string;
  /** detay panelindeki paragraflar */
  readonly description: string[];
  /** öne çıkan özellikler (madde listesi) */
  readonly features: string[];
  /** kurulunca nerede görüneceği / nasıl kullanılacağı */
  readonly usage: string;
  /** “Verisiyle birlikte kaldır” onayında silinecek verinin adı */
  readonly dataLabel: string;
}

export const CATEGORIES: PluginCategory[] = ['home', 'tool'];
export const categoryLabel = (c: PluginCategory) => t(`plugins.category.${c}`);

function plugin(base: Pick<Plugin, 'id' | 'icon' | 'category' | 'author' | 'requires'>): Plugin {
  const k = `plugins.${base.id}` as const;
  return {
    ...base,
    get name() { return t(`${k}.name`); },
    get summary() { return t(`${k}.summary`); },
    get description() { return tList(`${k}.description`); },
    get features() { return tList(`${k}.features`); },
    get usage() { return t(`${k}.usage`); },
    get dataLabel() { return t(`${k}.dataLabel`); },
  };
}

export const PLUGINS: Plugin[] = [
  plugin({ id: 'sticky', icon: '🗒', category: 'tool', author: 'Thalamus' }),
  plugin({ id: 'stickyArt', icon: '🌸', category: 'tool', author: 'Thalamus', requires: ['sticky'] }),
  plugin({ id: 'stickyShape', icon: '❤', category: 'tool', author: 'Thalamus', requires: ['sticky'] }),
  plugin({ id: 'otd', icon: '📰', category: 'home', author: 'Thalamus' }),
  plugin({ id: 'drivemeter', icon: '⏲', category: 'tool', author: 'Thalamus' }),
];

/** Tanıtım görselleri dile göre: public/plugins/<id>.<dil>.webp; o dilde yoksa kaynak dildeki kullanılır */
export const pluginImage = (id: PluginId, locale: Locale = getLocale()) => `plugins/${id}.${locale}.webp`;
export const pluginImageFallback = (id: PluginId) => pluginImage(id, SOURCE_LOCALE);

export const pluginOf = (id: string) => PLUGINS.find((p) => p.id === id);

/** Kurulu eklentiler. Liste hiç kaydedilmemişse (market öncesi hesap) o an kullanılanlar kurulu sayılır. */
export function installedList(s: Settings): PluginId[] {
  if (s.installed) return s.installed.filter((id): id is PluginId => !!pluginOf(id));
  const out: PluginId[] = [];
  if (s.stickies?.length) out.push('sticky');
  if (s.homeLayout?.some((x) => x.id === 'otd' && x.on)) out.push('otd');
  return out;
}

export const isInstalled = (id: PluginId, s: Settings = useStore.getState().settings) => installedList(s).includes(id);

export function useInstalled(id: PluginId) {
  return useStore((s) => installedList(s.settings).includes(id));
}

export function useInstalledList() {
  const s = useStore((st) => st.settings);
  return installedList(s);
}

export function installPlugin(id: PluginId) {
  const s = useStore.getState().settings;
  const installed = [...new Set([...installedList(s), ...(pluginOf(id)?.requires ?? []), id])];
  let homeLayout = s.homeLayout;
  // Ana sayfa bileşeni kurulunca görünür olsun (düzende yoksa sona eklenir)
  if (pluginOf(id)?.category === 'home') {
    homeLayout = homeLayout?.some((x) => x.id === id)
      ? homeLayout.map((x) => (x.id === id ? { ...x, on: true } : x))
      : homeLayout && [...homeLayout, { id, on: true }];
  }
  return saveSettings({ ...s, installed, homeLayout });
}

export function uninstallPlugin(id: PluginId) {
  const s = useStore.getState().settings;
  return saveSettings({ ...s, installed: withoutPlugin(installedList(s), id) });
}

/** Bir eklentiyi ve ona bağlı olanları listeden çıkarır */
export const withoutPlugin = (list: PluginId[], id: PluginId) =>
  list.filter((x) => x !== id && !pluginOf(x)?.requires?.includes(id));

// Eklentilerin ayarlarda bıraktığı veriler ("Verisiyle birlikte kaldır")
const DATA: Record<PluginId, { has: (s: Settings) => boolean; clear: (s: Settings) => Settings }> = {
  sticky: {
    has: (s) => !!s.stickies?.length || s.stickyScope !== undefined || s.stickyFixed !== undefined,
    clear: ({ stickies: _a, stickyScope: _b, stickyFixed: _c, ...s }) => s,
  },
  stickyArt: {
    has: (s) => !!s.stickies?.some((x) => x.pattern),
    clear: (s) => (s.stickies ? { ...s, stickies: stripPatterns(s.stickies) } : s),
  },
  stickyShape: {
    has: (s) => !!s.stickies?.some((x) => x.shape),
    clear: (s) => (s.stickies ? { ...s, stickies: stripShapes(s.stickies) } : s),
  },
  otd: {
    has: (s) => s.otdLang !== undefined || !!s.homeLayout?.some((x) => x.id === 'otd'),
    clear: ({ otdLang: _a, ...s }) => ({ ...s, homeLayout: s.homeLayout?.filter((x) => x.id !== 'otd') }),
  },
  drivemeter: {
    has: (s) => s.meter !== undefined || !!s.homeLayout?.some((x) => x.id === 'drivemeter'),
    clear: ({ meter: _a, ...s }) => ({ ...s, homeLayout: s.homeLayout?.filter((x) => x.id !== 'drivemeter') }),
  },
};

export const hasPluginData = (id: PluginId, s: Settings) => DATA[id].has(s);

export function usePluginData(id: PluginId) {
  return useStore((s) => DATA[id].has(s.settings));
}

/** Eklentiyi kaldırır ve ayarlarda bıraktığı verileri de siler (geri alınamaz) */
export function purgePlugin(id: PluginId) {
  const s = useStore.getState().settings;
  if (id === 'sticky') try { localStorage.removeItem('stickyHidden'); } catch { /* yok say */ }
  if (id === 'drivemeter') try { localStorage.removeItem('driveMeter'); } catch { /* yok say */ }
  return saveSettings({ ...DATA[id].clear(s), installed: withoutPlugin(installedList(s), id) });
}
