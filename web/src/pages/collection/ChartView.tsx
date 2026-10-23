import { useEffect, useMemo, useRef, useState } from 'react';
import { openPeek } from '../../components/Peek';
import { propValue } from '../../lib/compute';
import { displayTitle, fmtNum, noteIcon } from '../../lib/format';
import { toNum } from '../../lib/formula';
import { useStore } from '../../lib/store';
import type { Note, PropDef, SavedView, TypeDef } from '../../lib/types';
import { groupNotes } from '../../lib/views';
import type { ViewProps } from './Views';

// Grafik görünümü (Notion'daki Grafikler): bir alana göre gruplanmış kayıt sayısı ya da bir sayı alanının toplamı/ortalaması.
// Tek seri tek renk (ölçü, kimlik değil); her çubukta üzerine gelince ipucu; erişilebilirlik için tablo görünümü.

export type ChartType = 'bar' | 'hbar' | 'line';
export interface ChartConfig {
  type: ChartType;
  /** Gruplama alanı (seçim, durum, çoklu seçim, onay, bağlantı ya da tarih) */
  x?: string;
  /** Tarih alanında aralık */
  bucket?: 'week' | 'month' | 'year';
  fn: 'count' | 'sum' | 'avg';
  /** sum/avg için sayı alanı */
  y?: string;
}

export const chartableX = (ty: TypeDef) => ty.props.filter((p) => ['select', 'multiselect', 'checkbox', 'relation', 'date', 'created', 'updated'].includes(p.kind));
export const chartableY = (ty: TypeDef) => ty.props.filter((p) => ['number', 'rating', 'formula', 'rollup'].includes(p.kind));

export function chartConfig(ty: TypeDef, view: SavedView): ChartConfig {
  const c = (view.chart ?? {}) as Partial<ChartConfig>;
  const xs = chartableX(ty);
  const x = c.x && xs.some((p) => p.key === c.x) ? c.x : (xs.find((p) => p.kind === 'select') ?? xs[0])?.key;
  return { type: c.type ?? 'bar', x, bucket: c.bucket ?? 'month', fn: c.fn ?? 'count', y: c.y };
}

interface Bucket {
  key: string;
  label: string;
  notes: Note[];
  value: number;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Tarihi aralığın anahtarına çevir (hafta: pazartesi günü) */
function bucketKey(d: Date, b: 'week' | 'month' | 'year'): string {
  if (b === 'year') return String(d.getFullYear());
  if (b === 'month') return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${p2(m.getMonth() + 1)}-${p2(m.getDate())}`;
}
function bucketLabel(k: string, b: 'week' | 'month' | 'year'): string {
  if (b === 'year') return k;
  const [y, m, d] = k.split('-').map(Number);
  return b === 'month' ? `${MONTHS[m - 1]} ${String(y).slice(2)}` : `${d} ${MONTHS[m - 1]}`;
}
function nextKey(k: string, b: 'week' | 'month' | 'year'): string {
  if (b === 'year') return String(Number(k) + 1);
  const [y, m, d] = k.split('-').map(Number);
  return bucketKey(b === 'month' ? new Date(y, m, 1) : new Date(y, m - 1, d + 7), b);
}

function measure(list: Note[], cfg: ChartConfig, ydef: PropDef | undefined, notes: Record<string, Note>): number {
  if (cfg.fn === 'count' || !ydef) return list.length;
  const vals = list.map((n) => toNum(propValue(n, ydef, notes))).filter((v) => Number.isFinite(v));
  if (!vals.length) return 0;
  const sum = vals.reduce((a, b) => a + b, 0);
  return cfg.fn === 'sum' ? sum : sum / vals.length;
}

export function buildBuckets(rows: Note[], ty: TypeDef, cfg: ChartConfig, notes: Record<string, Note>): Bucket[] {
  const xdef = ty.props.find((p) => p.key === cfg.x);
  const ydef = ty.props.find((p) => p.key === cfg.y);
  if (!xdef) return [];
  if (['date', 'created', 'updated'].includes(xdef.kind)) {
    const b = cfg.bucket ?? 'month';
    const map = new Map<string, Note[]>();
    for (const n of rows) {
      const raw = xdef.kind === 'date' ? n.props[xdef.key] : xdef.kind === 'created' ? n.created_at : n.updated_at;
      if (typeof raw !== 'string' || !raw) continue;
      const d = raw.length > 10 ? new Date(raw) : new Date(`${raw.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const k = bucketKey(d, b);
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    const keys = [...map.keys()].sort();
    if (!keys.length) return [];
    // Aradaki boş dönemler de görünsün (en fazla 120 çubuk)
    const out: Bucket[] = [];
    for (let k = keys[0], i = 0; k <= keys[keys.length - 1] && i < 120; k = nextKey(k, b), i++) {
      const list = map.get(k) ?? [];
      out.push({ key: k, label: bucketLabel(k, b), notes: list, value: measure(list, cfg, ydef, notes) });
    }
    return out;
  }
  return groupNotes(rows, xdef, notes).map((g) => ({ key: g.key || '__empty', label: g.label, notes: g.notes, value: measure(g.notes, cfg, ydef, notes) }));
}

/** Okunaklı eksen adımları */
function niceTicks(max: number, count = 4, integer = false): number[] {
  if (max <= 0) return [0, 1];
  const raw = integer ? Math.max(1, max / count) : max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const fmtVal = (v: number) => fmtNum(Math.round(v * 10) / 10);

export function ChartView({ ty, rows, view }: ViewProps) {
  const notes = useStore((s) => s.notes);
  const cfg = chartConfig(ty, view);
  const buckets = useMemo(() => buildBuckets(rows, ty, cfg, notes), [rows, ty, cfg.x, cfg.y, cfg.fn, cfg.bucket, notes]);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xdef = ty.props.find((p) => p.key === cfg.x);
  const ydef = ty.props.find((p) => p.key === cfg.y);
  if (!xdef) return <p className="muted">Grafik için gruplanacak bir alan gerekli (seçim, durum, tarih…). Görünüm ayarlarından seç.</p>;

  const title = cfg.fn === 'count' || !ydef ? 'Kayıt sayısı' : `${ydef.label} (${cfg.fn === 'sum' ? 'toplam' : 'ortalama'})`;
  const max = Math.max(0, ...buckets.map((b) => b.value));
  const ticks = niceTicks(max, 4, cfg.fn === 'count');
  const top = ticks[ticks.length - 1] || 1;
  const sel = buckets.find((b) => b.key === picked);

  const horizontal = cfg.type === 'hbar';
  const padL = horizontal ? Math.min(180, Math.max(70, w * 0.28)) : 40;
  const padR = 16;
  const padT = 12;
  const padB = horizontal ? 26 : 40;
  const band = horizontal ? 30 : 0;
  const h = horizontal ? padT + padB + Math.max(1, buckets.length) * band : 300;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const step = buckets.length ? (horizontal ? plotH : plotW) / buckets.length : 0;
  const barW = Math.max(2, Math.min(56, step - 2 - step * 0.22)); // 2px boşluk + nefes
  const scale = (v: number) => (v / top) * (horizontal ? plotW : plotH);
  // Etiketler sığmıyorsa seyrekleştir
  const every = horizontal ? 1 : Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 64))));
  const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  const tip = hover !== null ? buckets[hover] : null;
  const tipPos = (i: number) => (horizontal ? { left: padL + scale(buckets[i].value) + 10, top: padT + i * step } : { left: padL + i * step + step / 2, top: padT + plotH - scale(buckets[i].value) - 10 });

  const linePath = buckets.map((b, i) => `${i ? 'L' : 'M'}${padL + i * step + step / 2},${padT + plotH - scale(b.value)}`).join(' ');

  return (
    <div className="chart-view">
      <div className="chart-head">
        <b>{title}</b>
        <span className="muted small">· “{xdef.label}” alanına göre{['date', 'created', 'updated'].includes(xdef.kind) ? ` (${cfg.bucket === 'week' ? 'haftalık' : cfg.bucket === 'year' ? 'yıllık' : 'aylık'})` : ''}</span>
        <span className="spacer" />
        <button type="button" className="btn small" onClick={() => setAsTable(!asTable)}>{asTable ? 'Grafik' : 'Tablo olarak göster'}</button>
      </div>

      {!buckets.length ? (
        <p className="muted">Bu görünümde gösterilecek kayıty yok.</p>
      ) : asTable ? (
        <table className="dbtable chart-table">
          <thead><tr><th>{xdef.label}</th><th className="num">{title}</th></tr></thead>
          <tbody>{buckets.map((b) => <tr key={b.key}><td>{b.label}</td><td className="num">{fmtVal(b.value)}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="chart-box" ref={box} onMouseLeave={() => setHover(null)}>
          <svg width={w} height={h} role="img" aria-label={`${title}, ${xdef.label} alanına göre`}>
            {/* ızgara ve değer ekseni */}
            {ticks.map((v) => {
              const p = horizontal ? padL + scale(v) : padT + plotH - scale(v);
              return horizontal ? (
                <g key={v}>
                  <line className="chart-grid" x1={p} x2={p} y1={padT} y2={padT + plotH} />
                  <text className="chart-tick" x={p} y={h - 8} textAnchor="middle">{fmtVal(v)}</text>
                </g>
              ) : (
                <g key={v}>
                  <line className="chart-grid" x1={padL} x2={w - padR} y1={p} y2={p} />
                  <text className="chart-tick" x={padL - 6} y={p + 4} textAnchor="end">{fmtVal(v)}</text>
                </g>
              );
            })}
            <line className="chart-axis" x1={padL} x2={horizontal ? padL : w - padR} y1={horizontal ? padT : padT + plotH} y2={padT + plotH} />

            {cfg.type === 'line' ? (
              <>
                {hover !== null && <line className="chart-cross" x1={padL + hover * step + step / 2} x2={padL + hover * step + step / 2} y1={padT} y2={padT + plotH} />}
                <path className="chart-line" d={linePath} />
                {hover !== null && <circle className="chart-dot" cx={padL + hover * step + step / 2} cy={padT + plotH - scale(buckets[hover].value)} r={5} />}
              </>
            ) : (
              buckets.map((b, i) => {
                const len = scale(b.value);
                const r = Math.min(4, barW / 2, len);
                // Veri ucu yuvarlak, taban düz
                const d = horizontal
                  ? (() => { const y = padT + i * step + (step - barW) / 2; const x0 = padL; const x1 = padL + len; return `M${x0},${y} H${x1 - r} Q${x1},${y} ${x1},${y + r} V${y + barW - r} Q${x1},${y + barW} ${x1 - r},${y + barW} H${x0} Z`; })()
                  : (() => { const x = padL + i * step + (step - barW) / 2; const y0 = padT + plotH; const y1 = y0 - len; return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`; })();
                return len > 0 ? <path key={b.key} className={`chart-bar ${hover === i ? 'on' : ''} ${picked === b.key ? 'picked' : ''}`} d={d} /> : null;
              })
            )}

            {/* kategori etiketleri */}
            {buckets.map((b, i) =>
              i % every ? null : horizontal ? (
                <text key={b.key} className="chart-label" x={padL - 8} y={padT + i * step + step / 2 + 4} textAnchor="end">{cut(b.label, Math.floor(padL / 7))}</text>
              ) : (
                <text key={b.key} className="chart-label" x={padL + i * step + step / 2} y={padT + plotH + 18} textAnchor="middle">{cut(b.label, Math.max(4, Math.floor((step * every) / 7)))}</text>
              ),
            )}

            {/* imleç hedefleri: çubuktan büyük */}
            {buckets.map((b, i) => (
              <rect
                key={b.key}
                className="chart-hit"
                x={horizontal ? padL : padL + i * step}
                y={horizontal ? padT + i * step : padT}
                width={horizontal ? plotW : step}
                height={horizontal ? step : plotH}
                onMouseEnter={() => setHover(i)}
                onClick={() => setPicked(picked === b.key ? null : b.key)}
              />
            ))}
          </svg>
          {tip && hover !== null && (
            <div className="chart-tip" style={{ ...tipPos(hover), ...(horizontal ? { transform: "none" } : {}) }}>
              <b>{tip.label}</b>
              <span>{fmtVal(tip.value)} {cfg.fn === 'count' || !ydef ? 'kayıt' : ''}</span>
            </div>
          )}
        </div>
      )}

      {sel && (
        <div className="chart-picked">
          <div className="muted small">{sel.label} · {sel.notes.length} kayıty</div>
          {sel.notes.map((n) => (
            <button key={n.id} type="button" className="chip-soft" onClick={() => openPeek(n.id)}>{noteIcon(n)} {displayTitle(n)}</button>
          ))}
        </div>
      )}
      {!sel && buckets.length > 0 && !asTable && <p className="muted small">Bir çubuğa tyıklarsan o gruptaki kayıtlar aşağıda listelenir.</p>}
    </div>
  );
}
