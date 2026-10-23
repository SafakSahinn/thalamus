import { saveSettings, useStore } from './store';
import type { Settings } from './types';

// Eklenti marketi: çekirdek dışındaki özellikler varsayılan olarak kurulu gelmez, Market sayfasından kurulur.
// Katalog şimdilik yalnız bizim yayınladığımız yerleşik eklentilerden oluşur (kodla birlikte gelir).
// Kurulu listesi Settings.installed'da tutulur ve Drive'a eşitlenir. Kaldırmak veriyi silmez, yalnız gizler.

export type PluginId = 'sticky' | 'otd';
export type PluginCategory = 'home' | 'tool';

export interface Plugin {
  id: PluginId;
  name: string;
  icon: string;
  category: PluginCategory;
  /** kartta görünen tek satırlık tanıtım */
  summary: string;
  /** detay panelindeki paragraflar */
  description: string[];
  /** öne çıkan özellikler (madde listesi) */
  features: string[];
  author: string;
  /** tanıtım görseli (public/ altında) */
  image: string;
  /** kurulunca nerede görüneceği / nasıl kullanılacağı */
  usage: string;
  /** “Verisiyle birlikte kaldır” onayında silinecek verinin adı */
  dataLabel: string;
}

export const CATEGORIES: { id: PluginCategory; label: string }[] = [
  { id: 'home', label: 'Ana sayfa bileşeni' },
  { id: 'tool', label: 'Araç' },
];

export const PLUGINS: Plugin[] = [
  {
    id: 'sticky',
    name: 'Yapışkan notlar',
    icon: '🗒',
    category: 'tool',
    summary: 'Ekranın üstünde duran, Windows 7 tarzı renkli not kâğıtları.',
    description: [
      'Aklına gelen kısa şeyleri ekranın istediğin yerine yapıştır. Kâğıtlar sayfa değiştirsen de yerinde kalır, monitöre yapıştırılmış gibi.',
      'Bir kâğıdı istediğin zaman normal nota dönüştürebilirsin: ilk satırı başlık olur, gerisi not içeriği.',
    ],
    features: [
      'Sürükle, köşesinden boyutlandır, 6 renk',
      'Tüm sayfalarda ya da yalnız ana sayfada görünme seçeneği',
      'Alt Y ile bu cihazda gizle / göster',
      '“Not olarak kaydet” ile kalıcı nota dönüştürme',
      'Telefonda sağ altta renkli kareler, dokununca açılır',
    ],
    author: 'Thalamus',
    image: 'plugins/sticky.webp',
    usage: 'Ana sayfada boş bir yere sağ tıklayıp “Yapışkan not ekle” de ya da Ctrl K → “Yeni yapışkan not”.',
    dataLabel: 'tüm yapışkan notların ve ayarları',
  },
  {
    id: 'otd',
    name: 'Gazete: Tarihte bugün',
    icon: '📰',
    category: 'home',
    summary: 'Ana sayfada eski bir gazete sayfası gibi dizilmiş “tarihte bugün” olayları.',
    description: [
      'Bugünün tarihinde geçmişte yaşanmış olaylar, doğumlar ve ölümler; Wikipedia’dan alınıp gazete düzeninde, sütunlar hâlinde dizilir.',
      'Manşette günün öne çıkan olayı yer alır; sayfaları çevirerek geri kalanını okuyabilirsin.',
    ],
    features: [
      'Türkçe ya da İngilizce Wikipedia kaynağı',
      'Manşet, sütunlar ve sayfa çevirme',
      'Her olayın Wikipedia maddesine bağlantı',
    ],
    author: 'Thalamus',
    image: 'plugins/otd.webp',
    usage: 'Ana sayfada en altta görünür; sırasını Ayarlar > Ana sayfa’dan değiştirebilirsin.',
    dataLabel: 'dil tercihi ve ana sayfadaki yeri',
  },
];

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
  const installed = [...new Set([...installedList(s), id])];
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
  return saveSettings({ ...s, installed: installedList(s).filter((x) => x !== id) });
}

// Eklentilerin ayarlarda bıraktığı veriler ("Verisiyle birlikte kaldır")
const DATA: Record<PluginId, { has: (s: Settings) => boolean; clear: (s: Settings) => Settings }> = {
  sticky: {
    has: (s) => !!s.stickies?.length || s.stickyScope !== undefined,
    clear: ({ stickies: _a, stickyScope: _b, ...s }) => s,
  },
  otd: {
    has: (s) => s.otdLang !== undefined || !!s.homeLayout?.some((x) => x.id === 'otd'),
    clear: ({ otdLang: _a, ...s }) => ({ ...s, homeLayout: s.homeLayout?.filter((x) => x.id !== 'otd') }),
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
  return saveSettings({ ...DATA[id].clear(s), installed: installedList(s).filter((x) => x !== id) });
}
