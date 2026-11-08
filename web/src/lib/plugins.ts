import { getLocale, SOURCE_LOCALE, t, tList, type Locale } from '../i18n';
import { stripPatterns, stripShapes } from './sticky';
import { deleteNote, saveSettings, useStore } from './store';
import type { Note, Settings } from './types';

// Eklenti marketi: çekirdek dışındaki özellikler varsayılan olarak kurulu gelmez, Market sayfasından kurulur.
// Katalog şimdilik yalnız bizim yayınladığımız yerleşik eklentilerden oluşur (kodla birlikte gelir).
// Kurulu listesi Settings.installed'da tutulur ve Drive'a eşitlenir. Kaldırmak veriyi silmez, yalnız gizler.

export type PluginId = 'sticky' | 'stickyArt' | 'stickyShape' | 'otd' | 'drivemeter' | 'wallpaper' | 'clock' | 'games';
/** collection: kurulunca yeni bir koleksiyon tipi ekler (bkz. types.ts PLUGIN_TYPES) */
export type PluginCategory = 'home' | 'tool' | 'collection';

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

export const CATEGORIES: PluginCategory[] = ['home', 'tool', 'collection'];
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
  plugin({ id: 'wallpaper', icon: '🏞', category: 'tool', author: 'Thalamus' }),
  plugin({ id: 'clock', icon: '🕒', category: 'tool', author: 'Thalamus' }),
  plugin({ id: 'games', icon: '🎮', category: 'collection', author: 'Thalamus' }),
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

/** Koleksiyon eklentisinin tipine ait ayarlar (görünümler, alan değişiklikleri, otomasyonlar, varsayılan şablon) */
const typeSettingsOf = (s: Settings, type: string) =>
  !!(s.views?.[type] || s.types?.overrides[type] || s.types?.extra[type] || s.automations?.[type] || s.defaultTemplates?.[type]);
function clearTypeSettings(s: Settings, type: string): Settings {
  const drop = <T,>(r: Record<string, T> | undefined) => {
    if (!r || !(type in r)) return r;
    const { [type]: _, ...rest } = r;
    return rest;
  };
  return {
    ...s,
    views: drop(s.views),
    automations: drop(s.automations),
    defaultTemplates: drop(s.defaultTemplates),
    types: s.types && { ...s.types, overrides: drop(s.types.overrides)!, extra: drop(s.types.extra)! },
  };
}
const hasNotesOf = (notes: Record<string, Note> | undefined, type: string) =>
  !!notes && Object.values(notes).some((n) => n.type === type && !n.deleted_at);

// Eklentilerin bıraktığı veriler ("Verisiyle birlikte kaldır"): ayarlar ve koleksiyon eklentilerinde notlar
const DATA: Record<PluginId, { has: (s: Settings, notes?: Record<string, Note>) => boolean; clear: (s: Settings) => Settings; type?: string }> = {
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
  wallpaper: {
    has: (s) => s.wallpaper !== undefined,
    clear: ({ wallpaper: _a, ...s }) => s,
  },
  clock: {
    has: (s) => s.clock !== undefined || !!s.homeLayout?.some((x) => x.id === 'clock'),
    clear: ({ clock: _a, ...s }) => ({ ...s, homeLayout: s.homeLayout?.filter((x) => x.id !== 'clock') }),
  },
  games: {
    type: 'game',
    has: (s, notes) => typeSettingsOf(s, 'game') || hasNotesOf(notes, 'game'),
    clear: (s) => clearTypeSettings(s, 'game'),
  },
};

export const hasPluginData = (id: PluginId, s: Settings, notes?: Record<string, Note>) => DATA[id].has(s, notes);

export function usePluginData(id: PluginId) {
  return useStore((s) => DATA[id].has(s.settings, s.notes));
}

/** Eklentiyi kaldırır ve ayarlarda bıraktığı verileri de siler (geri alınamaz) */
export function purgePlugin(id: PluginId) {
  const s = useStore.getState().settings;
  if (id === 'sticky') try { localStorage.removeItem('stickyHidden'); } catch { /* yok say */ }
  if (id === 'drivemeter') try { localStorage.removeItem('driveMeter'); } catch { /* yok say */ }
  // Koleksiyon eklentisi: o tipteki notlar çöp kutusuna taşınır (30 gün içinde geri alınabilir)
  const type = DATA[id].type;
  if (type) for (const n of Object.values(useStore.getState().notes)) if (n.type === type && !n.deleted_at) deleteNote(n.id);
  return saveSettings({ ...DATA[id].clear(s), installed: withoutPlugin(installedList(s), id) });
}
