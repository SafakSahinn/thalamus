import { create } from 'zustand';
import { saveSettings, uid, useStore } from './store';

// Yapışkan notlar (Windows 7 "Sticky Notes" gibi): ekranın üstünde, sayfadan bağımsız duran kâğıtlar.
// Normal notlardan ayrıdır; ayarlarla birlikte Drive'a eşitlenir (Settings.stickies).
// Konum ekrana göre kesirdir (0-1), boyut piksel; ekran küçülünce kâğıt içeri kıstırılır.

export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'white';
export type StickyScope = 'all' | 'home';

export interface Sticky {
  id: string;
  text: string;
  color: StickyColor;
  /** sol üst köşe, ekran genişliğinin/yüksekliğinin kesri */
  x: number;
  y: number;
  w: number;
  h: number;
  /** desenli kâğıt ("Desenli not kâğıtları" eklentisi); eklenti kurulu değilse yok sayılır ve `color` görünür */
  pattern?: StickyPattern;
}

export const COLORS: { id: StickyColor; label: string }[] = [
  { id: 'yellow', label: 'Sarı' },
  { id: 'blue', label: 'Mavi' },
  { id: 'green', label: 'Yeşil' },
  { id: 'pink', label: 'Pembe' },
  { id: 'purple', label: 'Mor' },
  { id: 'white', label: 'Beyaz' },
];

export type StickyPattern = 'cicek' | 'lavanta' | 'sehir' | 'yaprak' | 'deniz' | 'dag' | 'gece' | 'kiraz';

/** Kurşun kalem desenleri (public/stickies/*.svg). `color`: eklenti kaldırılınca kâğıdın düşeceği düz renk. */
export const PATTERNS: { id: StickyPattern; label: string; color: StickyColor }[] = [
  { id: 'cicek', label: 'Çiçekler', color: 'yellow' },
  { id: 'lavanta', label: 'Lavanta', color: 'purple' },
  { id: 'sehir', label: 'Şehir', color: 'blue' },
  { id: 'yaprak', label: 'Yapraklar', color: 'yellow' },
  { id: 'deniz', label: 'Deniz', color: 'blue' },
  { id: 'dag', label: 'Dağlar', color: 'green' },
  { id: 'gece', label: 'Gece', color: 'purple' },
  { id: 'kiraz', label: 'Kiraz çiçeği', color: 'pink' },
];

export const isPattern = (id: string): id is StickyPattern => PATTERNS.some((p) => p.id === id);

/** Renk ya da desen seçimi: desen seçilince düz rengi de desenin baz rengine çekilir */
export function paperPatch(id: string): Partial<Sticky> {
  const p = PATTERNS.find((x) => x.id === id);
  return p ? { pattern: p.id, color: p.color } : { color: id as StickyColor, pattern: undefined };
}

/** Kâğıdın sınıfı: desen yalnız eklenti kuruluyken */
export const paperClass = (s: Pick<Sticky, 'color' | 'pattern'>, art: boolean) =>
  art && s.pattern && isPattern(s.pattern) ? `c-${s.pattern} pat` : `c-${s.color}`;

/** Eklenti verisiyle kaldırılınca: desen alanları silinir, kâğıtlar baz rengine döner */
export const stripPatterns = (list: Sticky[]) => list.map(({ pattern: _p, ...s }) => s);

export const MIN_W = 160;
export const MIN_H = 110;
const DEF_W = 220;
const DEF_H = 200;

/** Kâğıdın ekrandaki piksel kutusu: boyut ekrana sığar, konum kenardan taşmaz */
export function placeRect(s: Pick<Sticky, 'x' | 'y' | 'w' | 'h'>, vw: number, vh: number) {
  const w = Math.max(MIN_W, Math.min(s.w, vw));
  const h = Math.max(MIN_H, Math.min(s.h, vh));
  const left = Math.max(0, Math.min(s.x * vw, vw - w));
  const top = Math.max(0, Math.min(s.y * vh, vh - h));
  return { left, top, w, h };
}

/** Yeni kâğıt: verilen noktada ya da öncekinin biraz sağ altında (üst üste binmesin) */
export function newSticky(list: Sticky[], vw: number, vh: number, at?: { x: number; y: number }, color: StickyColor = 'yellow'): Sticky {
  let px = at?.x ?? vw - DEF_W - 40;
  let py = at?.y ?? 80;
  if (!at) {
    while (list.some((s) => Math.abs(s.x * vw - px) < 8 && Math.abs(s.y * vh - py) < 8)) {
      px -= 24;
      py += 24;
    }
  }
  const r = placeRect({ x: px / vw, y: py / vh, w: DEF_W, h: DEF_H }, vw, vh);
  return { id: uid(), text: '', color, x: r.left / vw, y: r.top / vh, w: DEF_W, h: DEF_H };
}

// ---------- durum ----------

/** Bu cihazda kâğıtlar geçici olarak gizli mi (Alt Y) — yalnız yerel tercih */
const HIDE_KEY = 'stickyHidden';
const readHidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
};
/** focus: imlecin konacağı yeni kâğıt; open: telefonda açık olan kâğıt */
export const useStickyUi = create<{ hidden: boolean; focus: string | null; open: string | null }>(() => ({ hidden: readHidden(), focus: null, open: null }));
export function setStickiesHidden(hidden: boolean) {
  useStickyUi.setState({ hidden });
  try {
    localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
  } catch { /* yoksay */ }
}

const listOf = () => useStore.getState().settings.stickies ?? [];
const save = (stickies: Sticky[]) => void saveSettings({ ...useStore.getState().settings, stickies });

export function addSticky(at?: { x: number; y: number }, color?: StickyColor, pattern?: StickyPattern) {
  const s = newSticky(listOf(), innerWidth, innerHeight, at, color);
  if (pattern) s.pattern = pattern;
  save([...listOf(), s]);
  setStickiesHidden(false);
  useStickyUi.setState({ focus: s.id, open: s.id });
  return s;
}

export function patchSticky(id: string, patch: Partial<Sticky>) {
  save(listOf().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function removeSticky(id: string) {
  save(listOf().filter((s) => s.id !== id));
}

/** Öne getir: listenin sonundaki kâğıt en üstte çizilir */
export function raiseSticky(id: string) {
  const list = listOf();
  if (list[list.length - 1]?.id === id) return;
  const s = list.find((x) => x.id === id);
  if (s) save([...list.filter((x) => x.id !== id), s]);
}

/** Kâğıdın metninden normal not içeriği: ilk satır başlık, kalanı paragraflar */
export function stickyToNote(text: string): { title: string; content: unknown } {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.trim());
  if (first < 0) return { title: '', content: null };
  const rest = lines.slice(first + 1);
  while (rest.length && !rest[0].trim()) rest.shift();
  while (rest.length && !rest[rest.length - 1].trim()) rest.pop();
  const content = rest.length
    ? { type: 'doc', content: rest.map((l) => (l.trim() ? { type: 'paragraph', content: [{ type: 'text', text: l }] } : { type: 'paragraph' })) }
    : null;
  return { title: lines[first].trim(), content };
}
