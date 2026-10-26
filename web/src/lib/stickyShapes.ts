import { t } from '../i18n';

// Şekilli not kâğıtları ("Şekilli not kâğıtları" eklentisi): kâğıdın kendisi bir nesnenin yandan görünen silueti.
// Her şekil kendi koordinatlarında (w × h) SVG yollarından oluşur; StickyNotes bunları objectBoundingBox
// <clipPath>'lerine çevirir. clip-path tıklamayı da keser, böylece siluetin dışı kâğıt sayılmaz.
// Colt tek istisna: kendi renkleriyle çizilmiş resmi var (public/stickies/colt.svg), kâğıt rengi uygulanmaz.

export type StickyShape =
  | 'bmw' | 'colt' | 'papatya' | 'ev' | 'kalp' | 'bulut' | 'fincan'
  | 'okSag' | 'okSol' | 'okYukari' | 'okAsagi';

export interface ShapeDef {
  id: StickyShape;
  /** çizim koordinat kutusu; en-boy oranı buradan gelir */
  w: number;
  h: number;
  /** ilk seçildiğinde kâğıdın genişliği (px); yazı bu genişlikte 14.5px */
  width: number;
  /** yazının varsayılan sol üst köşesi (kâğıda göre kesir) */
  tx: number;
  ty: number;
  /** kendi renkleriyle çizilmiş resim: kâğıt rengi uygulanmaz */
  art?: boolean;
  /** siluet parçaları (birleşimi); `evenodd`: içinde delik olan parça */
  paths: { d: string; evenodd?: boolean }[];
  readonly label: string;
}

// ---- yol yardımcıları ----
const n = (v: number) => Math.round(v * 100) / 100;
const circle = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${cy} A${r} ${r} 0 1 0 ${n(cx + r)} ${cy} A${r} ${r} 0 1 0 ${n(cx - r)} ${cy} Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
/** (x, y) noktasını (cx, cy) çevresinde saat yönünde `deg` derece döndürür */
const rotate = (x: number, y: number, cx: number, cy: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [n(cx + dx * Math.cos(a) - dy * Math.sin(a)), n(cy + dx * Math.sin(a) + dy * Math.cos(a))];
};

// Papatya: göbeğin çevresinde 30°'de bir dönen 12 elips yaprak
const PETALS = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30;
  const [x1, y1] = rotate(100, 6, 100, 92, deg);
  const [x2, y2] = rotate(100, 82, 100, 92, deg);
  // elipsin uzun ekseni dikeydi: döndürülünce x ekseni açısı da aynı miktarda döner
  return { d: `M${x1} ${y1} A17 38 ${deg} 1 0 ${x2} ${y2} A17 38 ${deg} 1 0 ${x1} ${y1} Z` };
});

// Ok: sağa bakan tek çokgen, diğer yönler onun döndürülmüşü
const ARROW: [number, number][] = [[0, 42], [148, 42], [148, 0], [240, 70], [148, 140], [148, 98], [0, 98]];
function arrow(id: StickyShape, deg: 0 | 90 | 180 | 270): Omit<ShapeDef, 'label'> {
  const vertical = deg % 180 !== 0;
  const w = vertical ? 140 : 240;
  const h = vertical ? 240 : 140;
  const pts = ARROW.map(([x, y]) => {
    const [rx, ry] = rotate(x, y, 120, 70, deg);
    return `${n(rx - 120 + w / 2)} ${n(ry - 70 + h / 2)}`;
  });
  // yazı okun gövdesinde başlar
  const text = { 0: [0.06, 0.36], 180: [0.42, 0.36], 90: [0.33, 0.12], 270: [0.33, 0.45] }[deg];
  return { id, w, h, width: w, tx: text[0], ty: text[1], paths: [{ d: `M${pts.join(' L')} Z` }] };
}

const DEFS: Omit<ShapeDef, 'label'>[] = [
  {
    id: 'bmw', w: 400, h: 150, width: 340, tx: 0.09, ty: 0.53,
    paths: [
      { d: 'M26 125 L19 119 L16 101 Q16 93 22 90 L24 85 L140 76 L147 75 L190 32 Q193 28 200 28 L268 28 Q274 28 277 32 L308 70 L364 71 L366 63 L384 60 L387 65 L385 72 L391 78 L393 104 L389 120 L374 125 Z' },
      { d: circle(90, 114, 26) },
      { d: circle(308, 114, 26) },
    ],
  },
  {
    id: 'colt', w: 420, h: 290, width: 320, tx: 0.12, ty: 0.2, art: true,
    paths: [
      { d: 'M338 70 L350 53 Q356 45 364 49 Q369 54 362 60 L353 74 L340 82 Z' },
      { d: 'M62 100 L338 100 L352 97 Q372 96 371 106 Q369 114 354 117 L397 262 Q399 271 390 272 L311 272 Q302 272 301 263 L268 140 Q264 128 256 128 L256 158 Q256 172 242 172 L210 172 Q186 172 184 148 L182 116 L64 116 Q58 116 58 110 L58 104 Q58 100 62 100 Z M194 120 L246 120 Q250 120 250 126 L250 152 Q250 164 238 164 L212 164 Q196 164 194 146 Z', evenodd: true },
      { d: roundRect(15, 58, 10, 30, 3) },
      { d: 'M34 46 L37 37 L46 37 L48 46 Z' },
      { d: 'M305 46 L308 37 L327 37 L329 46 Z' },
      { d: 'M22 52 Q22 46 28 46 L332 46 Q338 46 338 52 L338 100 L22 100 Z' },
      { d: 'M226 121 L235 121 L234 146 Q233 153 228 151 Q224 149 225 141 Z' },
    ],
  },
  { id: 'papatya', w: 200, h: 184, width: 220, tx: 0.32, ty: 0.42, paths: [...PETALS, { d: circle(100, 92, 34) }] },
  {
    id: 'ev', w: 200, h: 200, width: 220, tx: 0.2, ty: 0.5,
    paths: [{ d: 'M100 10 L194 96 L172 96 L172 192 L28 192 L28 96 L6 96 Z' }, { d: 'M136 56 V22 H160 V78 Z' }],
  },
  {
    id: 'kalp', w: 200, h: 180, width: 220, tx: 0.2, ty: 0.28,
    paths: [{ d: 'M100 176 C40 132 0 98 0 56 C0 22 25 0 55 0 C76 0 92 12 100 30 C108 12 124 0 145 0 C175 0 200 22 200 56 C200 98 160 132 100 176 Z' }],
  },
  {
    id: 'bulut', w: 240, h: 150, width: 260, tx: 0.2, ty: 0.42,
    paths: [
      { d: circle(72, 88, 44) }, { d: circle(122, 60, 52) }, { d: circle(178, 84, 42) },
      { d: circle(38, 112, 32) }, { d: circle(206, 112, 30) }, { d: roundRect(38, 96, 168, 48, 20) },
    ],
  },
  {
    id: 'fincan', w: 220, h: 200, width: 220, tx: 0.14, ty: 0.26,
    paths: [
      { d: 'M18 36 H172 V112 Q172 168 95 168 Q18 168 18 112 Z' },
      { d: 'M168 56 C218 56 218 132 160 134 L162 116 C196 112 196 74 168 74 Z' },
      { d: ellipse(100, 180, 96, 15) },
    ],
  },
  arrow('okSag', 0),
  arrow('okSol', 180),
  arrow('okYukari', 270),
  arrow('okAsagi', 90),
];

export const SHAPES: ShapeDef[] = DEFS.map((d) => ({ ...d, get label() { return t(`study.sticky.shapes.${d.id}`); } }));

export const shapeDef = (id: string | undefined) => SHAPES.find((s) => s.id === id);

/** <clipPath> kimliği: StickyNotes çizer, kâğıt ve menü kutucukları kullanır */
export const clipId = (id: StickyShape) => `sk-shape-${id}`;
