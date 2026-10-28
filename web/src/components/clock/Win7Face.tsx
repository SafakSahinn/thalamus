import type { Win7Skin } from '../../lib/clock';

// Windows 7 Saat gadget'ının kendi kadranları: gövde + akrep/yelkovan/saniye/göbek görselleri (public/clocks/).
// Ölçüler gadget'ın kendisinden: 130×130'luk gövde; ibre görselleri 12'yi gösterir ve kendi ortalarından döner.
// Ad etiketi her kadranda orijinaldeki yazı tipi, renk ve konumla yazılır.

const FILE: Record<Win7Skin, string> = {
  trad: 'trad', system: 'system', cronometer: 'cronometer', diner: 'diner', flower7: 'flower', modern: 'modern', square: 'square', novelty: 'novelty',
};

interface Geo {
  /** ibre görselinin sol üst köşesi ve boyutu */
  hand: [x: number, y: number, w: number, h: number];
  /** gövde genişliği (yalnız novelty 118) */
  bodyW?: number;
  font: string;
  color: string;
  /** yazı boyu (pt) */
  size?: number;
  /** etiketin dikey/yatay kayması (px) */
  dy?: number;
  dx?: number;
  /** etiketin en geniş hâli (px) */
  max: number;
}

const SEGOE = '"Segoe UI", Tahoma, sans-serif';
const NARROW = `"Arial Narrow", ${SEGOE}`;

const GEO: Record<Win7Skin, Geo> = {
  trad: { hand: [57, -1, 13, 129], font: `Constantia, Georgia, ${SEGOE}`, color: '#2F2E2E', dy: -3, dx: -1, max: 66 },
  system: { hand: [58, 0, 13, 129], font: NARROW, color: '#666666', dy: 3, dx: 1, max: 72 },
  cronometer: { hand: [57, -1, 13, 129], font: NARROW, color: '#FF0000', dy: 6, max: 70 },
  diner: { hand: [58, -1, 13, 129], font: `"Segoe Script", cursive, ${SEGOE}`, color: '#D3D9E3', size: 9, max: 56 },
  flower7: { hand: [59, 0, 13, 129], font: `"Arial Rounded MT Bold", ${SEGOE}`, color: '#FE8E08', size: 9, dy: 2, dx: 2, max: 71 },
  modern: { hand: [58, -1, 13, 129], font: NARROW, color: '#FFFFFF', dy: 3, max: 74 },
  square: { hand: [57, -1, 13, 129], font: `Calibri, ${SEGOE}`, color: '#000000', size: 9, max: 70 },
  novelty: { hand: [59, 46, 7, 81], bodyW: 118, font: `Calibri, ${SEGOE}`, color: '#6dadff', dy: 18, max: 60 },
};

interface Props {
  skin: Win7Skin;
  hour: number;
  minute: number;
  second: number;
  seconds: boolean;
  label?: string;
  title?: string;
  bare?: boolean;
}

export default function Win7Face(p: Props) {
  const g = GEO[p.skin];
  const src = (part: string) => `${import.meta.env.BASE_URL}clocks/${FILE[p.skin]}${part}.webp`;
  const [x, y, w, h] = g.hand;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hand = (part: string, a: number) => (
    <image href={src(part)} x={x} y={y} width={w} height={h} transform={a ? `rotate(${+a.toFixed(2)} ${cx} ${cy})` : undefined} />
  );
  const bw = g.bodyW ?? 130;
  // pt → px; etiket kadranın ortasının biraz altında (orijinalde üstten 75px + kayma, 8px yarım satır)
  const fs = ((g.size ?? 10) * 4) / 3;
  const label = p.label && p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label;
  return (
    <svg className="clock-face w7c" viewBox="0 0 130 130" role="img" aria-label={p.title}>
      {p.title && <title>{p.title}</title>}
      <image href={src('')} x={(130 - bw) / 2} y="0" width={bw} height="130" />
      {!p.bare && label && (
        <text x={65 + (g.dx ?? 0)} y={75 + (g.dy ?? 0) + 8} fill={g.color} fontFamily={g.font} fontSize={fs}
          textAnchor="middle" dominantBaseline="central">
          {label}
        </text>
      )}
      {hand('_h', p.hour)}
      {hand('_m', p.minute)}
      {p.seconds && hand('_s', p.second)}
      {hand('_dot', 0)}
    </svg>
  );
}
