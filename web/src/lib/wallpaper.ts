import { saveSettings, useStore } from './store';

// "Arka plan" eklentisi (Gmail temaları gibi): uygulamanın arkasına hazır bir sahne ya da renk konur,
// kenar çubuğu ve sayfa yarı saydam olur. Görsel yükleme yok; sahneler public/wallpapers/*.svg altında,
// renkler CSS ile. Seçim Settings.wallpaper'da, Drive'a eşitlenir. Koyu temada sahne kısılır.

export type WallKind = 'scene' | 'color';
export type WallId =
  | 'pixel' | 'aero' | 'dunes' | 'mountains' | 'ocean' | 'night' | 'forest'
  | 'peach' | 'mint' | 'lavender' | 'sky' | 'graphite' | 'sand' | 'sage' | 'slate';

export interface Wall {
  id: WallId;
  kind: WallKind;
  /** CSS background değeri */
  css: string;
  /** koyu sahne: kenar çubuğundaki yazılar açık renge döner */
  dark?: boolean;
}

const scene = (id: WallId, dark = false): Wall => ({ id, kind: 'scene', dark, css: `url(${import.meta.env.BASE_URL}wallpapers/${id}.svg) center / cover no-repeat` });
const color = (id: WallId, css: string, dark = false): Wall => ({ id, kind: 'color', css, dark });

export const WALLS: Wall[] = [
  scene('pixel'),
  scene('aero', true),
  scene('dunes'),
  scene('mountains'),
  scene('ocean'),
  scene('night', true),
  scene('forest'),
  color('peach', 'linear-gradient(135deg, #ffd3a5, #fd6585)'),
  color('mint', 'linear-gradient(135deg, #d4fc79, #96e6a1)'),
  color('lavender', 'linear-gradient(135deg, #e0c3fc, #8ec5fc)'),
  color('sky', 'linear-gradient(180deg, #a1c4fd, #c2e9fb)'),
  color('graphite', 'linear-gradient(135deg, #434343, #1f1f1f)', true),
  color('sand', '#e9dcc4'),
  color('sage', '#b7c9b1'),
  color('slate', '#5b6b80', true),
];

export const wallOf = (id?: string) => WALLS.find((w) => w.id === id);

export function useWallpaper() {
  return useStore((s) => wallOf(s.settings.wallpaper));
}

export function setWallpaper(id: string | undefined) {
  const { wallpaper: _, ...s } = useStore.getState().settings;
  return saveSettings(id ? { ...s, wallpaper: id } : s);
}
