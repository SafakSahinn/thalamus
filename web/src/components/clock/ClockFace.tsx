import { useId } from 'react';
import { isWin7Skin, type ClockSkin, type SvgSkin } from '../../lib/clock';
import Win7Face from './Win7Face';

// Kendi çizdiğimiz 8 SVG kadran (orijinal Win7 kadranları Win7Face.tsx'te).
// Hepsi 200×200'lük kutuda, merkez (100,100). Kaplama: çerçeve + yüz + işaretler + ibre biçimi/renkleri.

const C = 100;
const f = (n: number) => +n.toFixed(2);
const pt = (r: number, a: number): [number, number] => [f(C + r * Math.sin((a * Math.PI) / 180)), f(C - r * Math.cos((a * Math.PI) / 180))];
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

interface Hands {
  hour: string;
  minute: string;
  second: string;
  /** ibre biçimi: sivri (klasik), çubuk (modern), oymalı (Roma) */
  shape: 'taper' | 'bar' | 'ornate';
  cap: string;
  /** istasyon saati gibi saniye ucunda yuvarlak */
  disc?: boolean;
}

interface Skin {
  hands: Hands;
  label: string;
  /** çerçeve ve yüz; işaretler ayrıca çizilir */
  Body: (p: { id: string }) => React.ReactNode;
  Marks: () => React.ReactNode;
}

/** Saat başı ve dakika çizgileri */
function ticks(o: { r: number; hour: [number, number, string]; minute?: [number, number, string]; quarter?: [number, number] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    if (!hour && !o.minute) continue;
    const [len, w, color] = hour ? o.hour : o.minute!;
    const big = o.quarter && i % 15 === 0;
    const l = big ? o.quarter![0] : len;
    const [x1, y1] = pt(o.r, i * 6);
    const [x2, y2] = pt(o.r - l, i * 6);
    out.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={big ? o.quarter![1] : w} strokeLinecap="butt" />);
  }
  return out;
}

function numerals(o: { r: number; color: string; size: number; font: string; weight?: number; list?: string[]; only?: number[] }) {
  return (o.list ?? ROMAN.map((_, i) => String(i || 12))).map((s, i) => {
    if (o.only && !o.only.includes(i)) return null;
    const [x, y] = pt(o.r, i * 30);
    return <text key={i} x={x} y={y} fill={o.color} fontSize={o.size} fontFamily={o.font} fontWeight={o.weight ?? 600}
      textAnchor="middle" dominantBaseline="central">{s}</text>;
  });
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Segoe UI", system-ui, sans-serif';

const SKINS: Record<SvgSkin, Skin> = {
  // Win7'nin varsayılanı gibi: krom çerçeve, beyaz yüz, siyah çizgiler, kırmızı saniye
  classic: {
    hands: { hour: '#1d1f22', minute: '#1d1f22', second: '#d8231b', shape: 'taper', cap: '#1d1f22' },
    label: '#5d6268',
    Body: ({ id }) => (
      <>
        <defs>
          <linearGradient id={`${id}rim`} x1="0" y1="0" x2=".35" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#c9ced3" /><stop offset=".55" stopColor="#7d858c" />
            <stop offset=".78" stopColor="#eceef0" /><stop offset="1" stopColor="#737a81" />
          </linearGradient>
          <radialGradient id={`${id}face`} cx=".5" cy=".4" r=".65">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".8" stopColor="#f3f4f5" /><stop offset="1" stopColor="#cfd3d6" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="96" fill={`url(#${id}rim)`} stroke="#50565c" />
        <circle cx={C} cy={C} r="86" fill="#5f666c" />
        <circle cx={C} cy={C} r="85" fill={`url(#${id}face)`} />
      </>
    ),
    Marks: () => <>{ticks({ r: 80, hour: [11, 3.2, '#202326'], minute: [4, 1, '#62686e'] })}</>,
  },
  // siyah yüz, ince krom kenar, saat başlarında beyaz noktalar
  night: {
    hands: { hour: '#f4f6f8', minute: '#f4f6f8', second: '#ff8a1c', shape: 'bar', cap: '#ff8a1c' },
    label: '#9aa3ab',
    Body: ({ id }) => (
      <>
        <defs>
          <linearGradient id={`${id}rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d7dbdf" /><stop offset=".5" stopColor="#5d646b" /><stop offset="1" stopColor="#c3c8cd" />
          </linearGradient>
          <radialGradient id={`${id}face`} cx=".45" cy=".35" r=".75">
            <stop offset="0" stopColor="#3a3f45" /><stop offset=".7" stopColor="#16191c" /><stop offset="1" stopColor="#050607" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="96" fill={`url(#${id}rim)`} />
        <circle cx={C} cy={C} r="91" fill={`url(#${id}face)`} />
        <ellipse cx={C} cy="52" rx="62" ry="34" fill="#fff" opacity=".07" />
      </>
    ),
    Marks: () => (
      <>
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = pt(78, i * 30);
          return <circle key={i} cx={x} cy={y} r={i % 3 ? 3 : 5} fill="#f4f6f8" />;
        })}
      </>
    ),
  },
  // ahşap çerçeve, krem yüz, kahverengi rakamlar, pirinç ibreler
  wood: {
    hands: { hour: '#4a2a12', minute: '#4a2a12', second: '#b07a2a', shape: 'taper', cap: '#b07a2a' },
    label: '#7a5532',
    Body: ({ id }) => (
      <>
        <defs>
          <radialGradient id={`${id}rim`} cx=".5" cy=".5" r=".5">
            <stop offset=".86" stopColor="#6b3d1c" /><stop offset=".9" stopColor="#a8693a" /><stop offset=".95" stopColor="#7d4723" /><stop offset="1" stopColor="#4c2a12" />
          </radialGradient>
          <pattern id={`${id}grain`} width="200" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <path d="M0 3 Q50 0 100 4 T200 3" stroke="#3b1f0b" strokeWidth="1.3" fill="none" opacity=".35" />
            <path d="M0 7 Q60 9 120 6 T200 8" stroke="#d29a64" strokeWidth=".8" fill="none" opacity=".35" />
          </pattern>
          <radialGradient id={`${id}face`} cx=".5" cy=".42" r=".6">
            <stop offset="0" stopColor="#fdf5e6" /><stop offset="1" stopColor="#e9d8b8" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="97" fill={`url(#${id}rim)`} />
        <circle cx={C} cy={C} r="97" fill={`url(#${id}grain)`} />
        <circle cx={C} cy={C} r="80" fill="#3b200c" />
        <circle cx={C} cy={C} r="78.5" fill={`url(#${id}face)`} />
      </>
    ),
    Marks: () => (
      <>
        {ticks({ r: 76, hour: [0, 0, 'none'], minute: [3, 1, '#9a7650'] })}
        {numerals({ r: 63, color: '#4a2a12', size: 17, font: SERIF })}
      </>
    ),
  },
  // taç yapraklı çiçek, sarı göbek
  flower: {
    hands: { hour: '#2f5d1e', minute: '#2f5d1e', second: '#e0455f', shape: 'bar', cap: '#e0455f' },
    label: '#8a5a1a',
    Body: ({ id }) => (
      <>
        <defs>
          <radialGradient id={`${id}pet`} cx=".5" cy=".9" r="1">
            <stop offset="0" stopColor="#ffd0dc" /><stop offset=".6" stopColor="#f47b9c" /><stop offset="1" stopColor="#d9466f" />
          </radialGradient>
          <radialGradient id={`${id}face`} cx=".45" cy=".4" r=".65">
            <stop offset="0" stopColor="#fffbe0" /><stop offset=".75" stopColor="#ffe17a" /><stop offset="1" stopColor="#f2b632" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }, (_, i) => (
          <ellipse key={i} cx={C} cy="28" rx="21" ry="30" fill={`url(#${id}pet)`} stroke="#c23b62" strokeWidth=".8"
            transform={`rotate(${i * 30 + 15} ${C} ${C})`} />
        ))}
        <circle cx={C} cy={C} r="70" fill={`url(#${id}face)`} stroke="#d99a1e" strokeWidth="2" />
      </>
    ),
    Marks: () => (
      <>
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = pt(60, i * 30);
          return <circle key={i} cx={x} cy={y} r={i % 3 ? 2.6 : 4.2} fill="#a8641a" />;
        })}
      </>
    ),
  },
  // koyu metal yüz, altın Roma rakamları, oymalı ibreler
  roman: {
    hands: { hour: '#e8c86a', minute: '#e8c86a', second: '#f3e2a6', shape: 'ornate', cap: '#d4ad48' },
    label: '#c9a94f',
    Body: ({ id }) => (
      <>
        <defs>
          <linearGradient id={`${id}rim`} x1="0" y1="0" x2=".4" y2="1">
            <stop offset="0" stopColor="#fbe8a6" /><stop offset=".35" stopColor="#c5962e" /><stop offset=".6" stopColor="#7a5813" />
            <stop offset=".8" stopColor="#e6c46a" /><stop offset="1" stopColor="#8c6418" />
          </linearGradient>
          <radialGradient id={`${id}face`} cx=".5" cy=".38" r=".7">
            <stop offset="0" stopColor="#4a4f57" /><stop offset=".75" stopColor="#24272c" /><stop offset="1" stopColor="#111316" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="96" fill={`url(#${id}rim)`} />
        <circle cx={C} cy={C} r="88" fill="#3d2c06" />
        <circle cx={C} cy={C} r="86.5" fill={`url(#${id}face)`} />
        <circle cx={C} cy={C} r="80" fill="none" stroke="#c9a94f" strokeWidth=".8" opacity=".7" />
      </>
    ),
    Marks: () => (
      <>
        {ticks({ r: 80, hour: [0, 0, 'none'], minute: [3, .8, '#c9a94f'] })}
        {numerals({ r: 66, color: '#e8c86a', size: 14, font: SERIF, list: ROMAN })}
      </>
    ),
  },
  // Aero cam: köşeleri yuvarlak kare, mavi parlak yüz
  aero: {
    hands: { hour: '#ffffff', minute: '#ffffff', second: '#9ff0ff', shape: 'bar', cap: '#ffffff' },
    label: '#d6f2ff',
    Body: ({ id }) => (
      <>
        <defs>
          <linearGradient id={`${id}face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5fb8f0" /><stop offset=".5" stopColor="#1f6fb8" /><stop offset="1" stopColor="#0b3d78" />
          </linearGradient>
          <linearGradient id={`${id}gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="190" height="190" rx="38" fill="#0a2d58" />
        <rect x="8" y="8" width="184" height="184" rx="35" fill={`url(#${id}face)`} />
        <path d="M43 10 H157 A34 34 0 0 1 190 44 V80 Q100 104 10 80 V44 A34 34 0 0 1 43 10 Z" fill={`url(#${id}gloss)`} />
      </>
    ),
    Marks: () => <>{ticks({ r: 84, hour: [12, 3, '#ffffff'], minute: [4, 1, 'rgba(255,255,255,.55)'] })}</>,
  },
  // istasyon saati: yalın beyaz yüz, kalın siyah çubuklar, ucu yuvarlak kırmızı saniye
  station: {
    hands: { hour: '#111', minute: '#111', second: '#e3170a', shape: 'bar', cap: '#111', disc: true },
    label: '#555',
    Body: () => (
      <>
        <circle cx={C} cy={C} r="96" fill="#2a2d30" />
        <circle cx={C} cy={C} r="91" fill="#ffffff" />
      </>
    ),
    Marks: () => <>{ticks({ r: 86, hour: [18, 6, '#111'], minute: [5, 2, '#111'] })}</>,
  },
  // 70'ler: turuncu yüz, kalın siyah çerçeve, büyük rakamlar
  retro: {
    hands: { hour: '#1b1b1b', minute: '#1b1b1b', second: '#fff4dc', shape: 'bar', cap: '#1b1b1b' },
    label: '#3a1a02',
    Body: ({ id }) => (
      <>
        <defs>
          <radialGradient id={`${id}face`} cx=".5" cy=".45" r=".6">
            <stop offset="0" stopColor="#ffb347" /><stop offset=".8" stopColor="#f2811d" /><stop offset="1" stopColor="#d4600b" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r="97" fill="#1b1b1b" />
        <circle cx={C} cy={C} r="90" fill="#fff4dc" />
        <circle cx={C} cy={C} r="85" fill={`url(#${id}face)`} />
      </>
    ),
    Marks: () => <>{numerals({ r: 68, color: '#1b1b1b', size: 21, font: SANS, weight: 800 })}</>,
  },
};

/** İbrenin yolu: 12 yönünü gösterir, merkezden döndürülür */
function handPath(shape: Hands['shape'], len: number, w: number, tail: number) {
  if (shape === 'bar') return `M${C - w / 2} ${C + tail} H${C + w / 2} V${C - len} H${C - w / 2} Z`;
  if (shape === 'ornate') {
    // gövde + ucun altında elmas biçimli şişkinlik
    const k = C - len * 0.72;
    return `M${C - w / 2} ${C + tail} L${C - w / 3} ${k + 6} L${C - w * 1.4} ${k} L${C} ${C - len} L${C + w * 1.4} ${k} L${C + w / 3} ${k + 6} L${C + w / 2} ${C + tail} Z`;
  }
  return `M${C - w / 2} ${C + tail} L${C - w / 4} ${C - len} L${C} ${C - len - 3} L${C + w / 4} ${C - len} L${C + w / 2} ${C + tail} Z`;
}

interface Props {
  skin: ClockSkin;
  hour: number;
  minute: number;
  second: number;
  seconds: boolean;
  label?: string;
  title?: string;
  /** küçük rozet ve kaplama önizlemesi: etiket yazılmaz */
  bare?: boolean;
}

/** Kaplamaya göre orijinal Win7 görselleri ya da bizim SVG çizimimiz */
export default function ClockFace(p: Props) {
  return isWin7Skin(p.skin) ? <Win7Face {...p} skin={p.skin} /> : <SvgFace {...p} skin={p.skin} />;
}

function SvgFace(p: Props & { skin: SvgSkin }) {
  const id = useId().replace(/:/g, '');
  const sk = SKINS[p.skin] ?? SKINS.classic;
  const h = sk.hands;
  const square = p.skin === 'aero';
  return (
    <svg className="clock-face" viewBox="0 0 200 200" role="img" aria-label={p.title}>
      {p.title && <title>{p.title}</title>}
      <sk.Body id={id} />
      <sk.Marks />
      {!p.bare && p.label && (
        <text x={C} y={square ? 136 : 132} fill={sk.label} fontSize="13" fontFamily={SANS} fontWeight="600" textAnchor="middle">
          {p.label.length > 16 ? `${p.label.slice(0, 15)}…` : p.label}
        </text>
      )}
      <g className="clock-hands">
        <path d={handPath(h.shape, 46, h.shape === 'bar' ? 7 : 8, 12)} fill={h.hour} transform={`rotate(${f(p.hour)} ${C} ${C})`} />
        <path d={handPath(h.shape, 68, h.shape === 'bar' ? 5 : 6, 14)} fill={h.minute} transform={`rotate(${f(p.minute)} ${C} ${C})`} />
        {p.seconds && (
          <g transform={`rotate(${p.second} ${C} ${C})`}>
            <path d={`M${C - 0.9} ${C + 22} H${C + 0.9} V${C - 76} H${C - 0.9} Z`} fill={h.second} />
            {h.disc && <circle cx={C} cy={C - 62} r="6" fill={h.second} />}
          </g>
        )}
        <circle cx={C} cy={C} r={p.seconds ? 4.5 : 5.5} fill={p.seconds ? h.second : h.cap} />
        <circle cx={C} cy={C} r="1.6" fill={h.cap} />
      </g>
    </svg>
  );
}
