import { useId } from 'react';
import type { MeterSkin } from '../../lib/driveMeter';

// Windows 7 CPU meter gadget'ının SVG çizimi: büyük kadran (Drive doluluğu) önde, küçük kadran (Thalamus) arkada sağ üstte.
// 'original' asıl gadget'ın kendisi: beyaz yüz, kalın krom çerçeve, sarı→kırmızı bölge, kısa kırmızı ok ibre, simgeli göbek.
// Diğer kaplamalar o dönemin üçüncü taraf gadget'larından esinli: koyu/açık yüz, rakamlı kadran, uzun ibre.
// İbre açısı: 0 → -135°, 1 → +135° (saat 12 yönünden saat yönünde).

type Dial = { cx: number; cy: number; r: number };
const BIG: Dial = { cx: 80, cy: 86, r: 66 };
const SMALL_ORIG: Dial = { cx: 170, cy: 50, r: 45 };
const SMALL: Dial = { cx: 166, cy: 54, r: 42 };

const ang = (v: number) => -135 + 270 * v;
const pt = (c: Dial, r: number, a: number): [number, number] => [c.cx + r * Math.sin((a * Math.PI) / 180), c.cy - r * Math.cos((a * Math.PI) / 180)];
const f = (n: number) => +n.toFixed(2);

/** İki yarıçap arasında, iki değer (0-1) arasındaki halka dilimi */
function band(c: Dial, rO: number, rI: number, v0: number, v1: number) {
  const [a1, b1] = pt(c, rO, ang(v0));
  const [a2, b2] = pt(c, rO, ang(v1));
  const [a3, b3] = pt(c, rI, ang(v1));
  const [a4, b4] = pt(c, rI, ang(v0));
  const large = (v1 - v0) * 270 > 180 ? 1 : 0;
  return `M${f(a1)} ${f(b1)} A${rO} ${rO} 0 ${large} 1 ${f(a2)} ${f(b2)} L${f(a3)} ${f(b3)} A${rI} ${rI} 0 ${large} 0 ${f(a4)} ${f(b4)} Z`;
}

interface Props {
  skin: MeterSkin;
  /** büyük kadran 0-1 */
  big: number;
  /** küçük kadran 0-1 */
  small: number;
  bigText: string;
  smallText: string;
  /** küçük kadran soluk (Drive yok) */
  dim?: boolean;
  /** kadran etiketleri (yalnız rakamlı kaplamalarda görünür) */
  bigLabel: string;
  smallLabel: string;
  title?: string;
}

export default function Win7Meter(p: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="w7" viewBox="0 0 220 160" role="img" aria-label={p.title}>
      {p.skin === 'original' ? <Original {...p} id={id} /> : <Classic {...p} id={id} />}
    </svg>
  );
}

const needleStyle = (c: Dial, v: number): React.CSSProperties => ({ transform: `rotate(${ang(v)}deg)`, transformOrigin: `${c.cx}px ${c.cy}px` });

// ---------- asıl Windows 7 görünümü ----------

const ZONE = [[255, 226, 150], [255, 146, 60], [226, 28, 14]];
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',');

function Original(p: Props & { id: string }) {
  const { id } = p;
  return (
    <>
      <defs>
        <linearGradient id={`${id}bez`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#d9dde1" /><stop offset=".55" stopColor="#8f969d" />
          <stop offset=".75" stopColor="#eef0f2" /><stop offset="1" stopColor="#7c838a" />
        </linearGradient>
        <radialGradient id={`${id}face`} cx=".5" cy=".62" r=".6">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".72" stopColor="#f6f6f6" /><stop offset="1" stopColor="#c9cccf" />
        </radialGradient>
        <radialGradient id={`${id}cap`} cx=".38" cy=".3" r=".75">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#e3e5e7" /><stop offset="1" stopColor="#9da3a9" />
        </radialGradient>
        <radialGradient id={`${id}ball`} cx=".35" cy=".3" r=".7">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#a7adb3" />
        </radialGradient>
        <linearGradient id={`${id}arrow`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff3b2f" /><stop offset=".5" stopColor="#e3120b" /><stop offset="1" stopColor="#9c0a05" />
        </linearGradient>
      </defs>
      {/* küçük kadran arkada, büyük kadran önde (orijinaldeki gibi) */}
      <OrigBody c={SMALL_ORIG} inset={7} id={id} />
      <g opacity={p.dim ? 0.55 : 1}><OrigDial c={SMALL_ORIG} big={false} v={p.small} text={p.smallText} id={id} /></g>
      <OrigBody c={BIG} inset={8} id={id} />
      <OrigDial c={BIG} big v={p.big} text={p.bigText} id={id} />
    </>
  );
}

function OrigBody({ c, inset, id }: { c: Dial; inset: number; id: string }) {
  return (
    <>
      <circle cx={c.cx} cy={c.cy} r={c.r} fill={`url(#${id}bez)`} stroke="#55595e" strokeWidth="1" />
      <circle cx={c.cx} cy={c.cy} r={c.r - inset} fill="#6c7278" />
      <circle cx={c.cx} cy={c.cy} r={c.r - inset - 1} fill={`url(#${id}face)`} />
    </>
  );
}

function OrigDial({ c, big, v, text, id }: { c: Dial; big: boolean; v: number; text: string; id: string }) {
  const face = c.r - (big ? 9 : 8);
  const rO = face - 1.5;
  // sarı→turuncu→kırmızı bölge: %62'den %100'e, sona doğru kalınlaşan dilimler
  const N = 26;
  const zone = Array.from({ length: N }, (_, i) => {
    const t0 = i / N;
    const v0 = 0.62 + 0.38 * t0;
    const v1 = 0.62 + 0.38 * Math.min((i + 1.15) / N, 1);
    const col = t0 < 0.5 ? mix(ZONE[0], ZONE[1], t0 * 2) : mix(ZONE[1], ZONE[2], (t0 - 0.5) * 2);
    return <path key={i} d={band(c, rO, rO - face * (0.1 + 0.17 * t0), v0, v1)} fill={`rgb(${col})`} opacity={0.55 + 0.45 * t0} />;
  });
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const [x1, y1] = pt(c, face - 2, ang(i / 10));
    const [x2, y2] = pt(c, face * 0.8, ang(i / 10));
    return <line key={i} x1={f(x1)} y1={f(y1)} x2={f(x2)} y2={f(y2)} stroke="#c4161c" strokeWidth={big ? 1.6 : 1.3} strokeLinecap="round" />;
  });
  const [bx, by] = pt(c, face * 0.55, ang(0.06));
  const r0 = face * 0.3;
  const r1 = face * 0.55;
  const hw = big ? 4.2 : 3.4;
  const cr = face * 0.3;
  const w = big ? 40 : 34;
  const h = big ? 13 : 11;
  const ry = c.cy + face * (big ? 0.42 : 0.4);
  return (
    <g>
      {zone}
      <path d={band(c, rO, rO - face * 0.16, 0, 0.05)} fill="#c8150d" />
      {ticks}
      {big && <circle cx={f(bx)} cy={f(by)} r="3.6" fill={`url(#${id}ball)`} stroke="#9aa0a6" strokeWidth=".4" />}
      <g className="w7-needle" style={needleStyle(c, v)}>
        <polygon
          points={`${c.cx - hw},${c.cy - r0} ${c.cx - hw * 0.9},${c.cy - r1 + hw * 1.6} ${c.cx},${c.cy - r1} ${c.cx + hw * 0.9},${c.cy - r1 + hw * 1.6} ${c.cx + hw},${c.cy - r0}`}
          fill={`url(#${id}arrow)`} stroke="#7d0904" strokeWidth=".4" strokeLinejoin="round" />
      </g>
      <circle cx={c.cx} cy={c.cy} r={cr + 1.2} fill="#b8bdc2" />
      <circle cx={c.cx} cy={c.cy} r={cr} fill={`url(#${id}cap)`} />
      <g transform={`translate(${c.cx} ${c.cy}) scale(${f(cr / 12)})`}>
        {big ? (
          <>
            <path d="M-7 4 H6.5 A3.8 3.8 0 0 0 6 -3.5 A5.2 5.2 0 0 0 -3.8 -4.6 A4.2 4.2 0 0 0 -7 4 Z" fill="#3d4248" stroke="#1d2024" strokeWidth=".6" />
            <path d="M-4.6 1.6 H4.4" stroke="#9aa1a8" strokeWidth=".8" />
          </>
        ) : (
          <>
            <circle r="6.3" fill="#3d4248" stroke="#1d2024" strokeWidth=".6" />
            <circle r="2.6" fill="#ff8a1c" />
          </>
        )}
      </g>
      <rect x={c.cx - w / 2} y={f(ry)} width={w} height={h} rx="1.5" fill="#0b0c0d" stroke="#45494e" strokeWidth=".6" />
      <rect x={c.cx - w / 2 + 1} y={f(ry + 1)} width={w - 2} height={f(h * 0.42)} rx="1" fill="#fff" opacity=".1" />
      <text x={c.cx} y={f(ry + h * 0.76)} textAnchor="middle" fill="#fff" fontSize={big ? 9 : 7.2} fontFamily="Segoe UI, Arial, sans-serif" fontWeight="700">{text}</text>
    </g>
  );
}

// ---------- rakamlı kaplamalar ----------

interface Skin {
  chrome: string[];
  face: string[];
  rim: string;
  ink: string;
  label: string;
  needle: string[];
  red: string;
  lcd: string;
  lcdInk: string;
  gloss: number;
}

const CHROME = ['#f4f6f8', '#9aa1a8', '#4b5056', '#b8bec4', '#5a5f65'];
const CLASSIC: Record<Exclude<MeterSkin, 'original'>, Skin> = {
  night: { chrome: CHROME, face: ['#34383d', '#121417', '#030303'], rim: '#050505', ink: '#e9eef2', label: '#8e979f',
    needle: ['#ff5a3c', '#ff2a12', '#a50e00'], red: '#d8261a', lcd: '#020304', lcdInk: '#f2f6f8', gloss: 0.38 },
  silver: { chrome: ['#ffffff', '#c9ced3', '#7d848b', '#e2e6ea', '#8e959c'], face: ['#ffffff', '#e4e7ea', '#b9bfc5'], rim: '#6d737a',
    ink: '#24292e', label: '#5d656d', needle: ['#ff5a3c', '#e3200b', '#8f0c00'], red: '#d8261a', lcd: '#2a2f34', lcdInk: '#f2f6f8', gloss: 0.55 },
  aero: { chrome: ['#e8f3ff', '#7fb2e6', '#1f4f86', '#9cc8f2', '#2c5f96'], face: ['#2b5d93', '#0f2c4f', '#04101e'], rim: '#03111f',
    ink: '#dff0ff', label: '#86b5e3', needle: ['#ffffff', '#cfe6ff', '#6fa6dd'], red: '#ff6a4d', lcd: '#03101d', lcdInk: '#bfe1ff', gloss: 0.42 },
  green: { chrome: CHROME, face: ['#13261a', '#08130c', '#020503'], rim: '#020503', ink: '#7dff9a', label: '#4fae66',
    needle: ['#b6ffc4', '#4dff74', '#13a339'], red: '#ffcf3d', lcd: '#010402', lcdInk: '#7dff9a', gloss: 0.3 },
  carbon: { chrome: ['#ff9a8a', '#d3301f', '#6e0d05', '#e8564a', '#7d140b'], face: ['#2d2d2d', '#151515', '#050505'], rim: '#060606',
    ink: '#f1f1f1', label: '#a8a8a8', needle: ['#ffc070', '#ff8a1c', '#b04b00'], red: '#ff3b2a', lcd: '#050505', lcdInk: '#ffb35c', gloss: 0.3 },
};

const stops = (cols: string[], offs: number[]) => cols.map((c, i) => <stop key={i} offset={offs[i]} stopColor={c} />);

function Classic(p: Props & { id: string }) {
  const k = CLASSIC[p.skin as Exclude<MeterSkin, 'original'>] ?? CLASSIC.night;
  const { id } = p;
  return (
    <>
      <defs>
        <linearGradient id={`${id}chrome`} x1="0" y1="0" x2="0" y2="1">{stops(k.chrome, [0, 0.35, 0.55, 0.8, 1])}</linearGradient>
        <radialGradient id={`${id}face`} cx=".5" cy=".42" r=".62">{stops(k.face, [0, 0.7, 1])}</radialGradient>
        <linearGradient id={`${id}gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={k.gloss} /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}cap`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor="#9ca3aa" /><stop offset="1" stopColor="#2d3136" />
        </radialGradient>
        <linearGradient id={`${id}needle`} x1="0" y1="0" x2="1" y2="0">{stops(k.needle, [0, 0.5, 1])}</linearGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id={`${id}clipBig`}><circle cx={BIG.cx} cy={BIG.cy} r={BIG.r - 6} /></clipPath>
        <clipPath id={`${id}clipSmall`}><circle cx={SMALL.cx} cy={SMALL.cy} r={SMALL.r - 5} /></clipPath>
      </defs>
      {/* krom kenar: önce iki kalın çember, sonra iç dolgular → birleşik siluet */}
      <circle cx={BIG.cx} cy={BIG.cy} r={BIG.r} fill={`url(#${id}chrome)`} stroke="#1a1c1f" strokeWidth="1.2" />
      <circle cx={SMALL.cx} cy={SMALL.cy} r={SMALL.r} fill={`url(#${id}chrome)`} stroke="#1a1c1f" strokeWidth="1.2" />
      <circle cx={BIG.cx} cy={BIG.cy} r={BIG.r - 4.5} fill={k.rim} />
      <circle cx={SMALL.cx} cy={SMALL.cy} r={SMALL.r - 4} fill={k.rim} />
      <circle cx={BIG.cx} cy={BIG.cy} r={BIG.r - 6} fill={`url(#${id}face)`} />
      <circle cx={SMALL.cx} cy={SMALL.cy} r={SMALL.r - 5} fill={`url(#${id}face)`} />
      <ClassicDial c={BIG} big k={k} id={id} v={p.big} text={p.bigText} label={p.bigLabel} />
      <g opacity={p.dim ? 0.55 : 1}><ClassicDial c={SMALL} big={false} k={k} id={id} v={p.small} text={p.smallText} label={p.smallLabel} /></g>
    </>
  );
}

function ClassicDial({ c, big, k, id, v, text, label }: { c: Dial; big: boolean; k: Skin; id: string; v: number; text: string; label: string }) {
  const rOut = c.r - 10;
  const steps = big ? 50 : 25;
  const nums = big ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] : [0, 20, 40, 60, 80, 100];
  const [x1, y1] = pt(c, rOut - 1, ang(0.8));
  const [x2, y2] = pt(c, rOut - 1, ang(1));
  const L = rOut - 2;
  const W = big ? 2.6 : 2;
  const tail = big ? 12 : 8;
  const w = big ? 40 : 30;
  const h = big ? 13 : 10;
  const ry = c.cy + c.r * (big ? 0.38 : 0.36);
  return (
    <g>
      <path d={`M${f(x1)} ${f(y1)} A${rOut - 1} ${rOut - 1} 0 0 1 ${f(x2)} ${f(y2)}`} fill="none" stroke={k.red} strokeWidth={big ? 3 : 2.4} opacity=".85" />
      {Array.from({ length: steps + 1 }, (_, i) => {
        const major = i % 5 === 0;
        const a = ang(i / steps);
        const len = major ? (big ? 7 : 5) : big ? 3.5 : 2.5;
        const [ax, ay] = pt(c, rOut, a);
        const [bx, by] = pt(c, rOut - len, a);
        return <line key={i} x1={f(ax)} y1={f(ay)} x2={f(bx)} y2={f(by)} stroke={k.ink} strokeWidth={major ? (big ? 1.4 : 1.1) : 0.6} opacity={major ? 1 : 0.7} />;
      })}
      {nums.map((n) => {
        const [tx, ty] = pt(c, rOut - (big ? 15 : 11), ang(n / 100));
        return <text key={n} x={f(tx)} y={f(ty + (big ? 2.6 : 2))} textAnchor="middle" fill={k.ink} fontSize={big ? 7.2 : 5.4} fontFamily="Segoe UI, sans-serif">{n}</text>;
      })}
      <text x={c.cx} y={f(c.cy - c.r * (big ? 0.3 : 0.28))} textAnchor="middle" fill={k.label} fontSize={big ? 6.2 : 4.8} letterSpacing=".8" fontFamily="Segoe UI, sans-serif">{label}</text>
      <rect x={c.cx - w / 2} y={f(ry)} width={w} height={h} rx="2.5" fill={k.lcd} stroke="#3a4046" strokeWidth=".7" />
      <text x={c.cx} y={f(ry + h * 0.74)} textAnchor="middle" fill={k.lcdInk} fontSize={big ? 8.4 : 6.4} fontFamily="Consolas, monospace" fontWeight="700">{text}</text>
      <g className="w7-needle" filter={`url(#${id}glow)`} style={needleStyle(c, v)}>
        <polygon points={`${c.cx - W},${c.cy + tail} ${c.cx - 0.5},${c.cy - L} ${c.cx + 0.5},${c.cy - L} ${c.cx + W},${c.cy + tail}`} fill={`url(#${id}needle)`} />
      </g>
      <circle cx={c.cx} cy={c.cy} r={big ? 7 : 5} fill={`url(#${id}cap)`} stroke="#111" strokeWidth=".6" />
      <g clipPath={`url(#${id}${big ? 'clipBig' : 'clipSmall'})`} pointerEvents="none">
        <ellipse cx={c.cx} cy={f(c.cy - c.r * 0.45)} rx={f(c.r * 0.82)} ry={f(c.r * 0.5)} fill={`url(#${id}gloss)`} />
      </g>
    </g>
  );
}
