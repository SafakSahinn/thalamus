import { localeTag, t } from '../../i18n';
import { fmtBytes, fmtPct, meterValues, type MeterData, type MeterSettings } from '../../lib/driveMeter';
import Win7Meter from './Win7Meter';

// Depolama göstergesinin dört görünümü: Win7 CPU meter, halka, pasta, rozet.
// Hem serbest gadget hem ana sayfa bileşeni bunu kullanır.

export function meterTooltip(d: MeterData | null, error?: string | null) {
  if (!d) return error ? t('meter.error', { msg: error }) : t('meter.loading');
  const at = new Date(d.at).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
  const used = d.limit ? t('meter.tipUsed', { used: fmtBytes(d.usage), total: fmtBytes(d.limit) }) : t('meter.tipUsedNoLimit', { used: fmtBytes(d.usage) });
  return [d.local ? t('meter.localNote') : used, d.local ? '' : t('meter.tipThalamus', { size: fmtBytes(d.thalamus) }), t('meter.tipAt', { time: at }), error ? t('meter.error', { msg: error }) : '']
    .filter(Boolean).join('\n');
}

export default function MeterView({ data: d, s }: { data: MeterData; s: MeterSettings }) {
  const view = s.view ?? 'win7';
  if (view === 'ring') return <Ring d={d} />;
  if (view === 'pie') return <Pie d={d} />;
  if (view === 'badge') return <Badge d={d} />;
  const v = meterValues(d);
  return (
    <div className={`meter-w7 ${s.size === 'small' ? 'small' : ''}`}>
      <Win7Meter skin={s.skin ?? 'original'} big={v.fill} small={d.local ? 0 : v.small}
        bigText={d.limit ? fmtPct(v.fill) : fmtBytes(d.usage)} smallText={d.local ? '—' : fmtBytes(d.thalamus)} dim={d.local}
        bigLabel={d.local ? t('meter.dialDevice') : t('meter.dialDrive')} smallLabel={d.local ? t('meter.dialNoDrive') : t('meter.dialThalamus')}
        title={t('meter.title')} />
    </div>
  );
}

/** Dilimler: Thalamus, diğer dosyalar, boş (yerel modda Thalamus + boş) */
function parts(d: MeterData) {
  const total = d.limit ?? d.usage;
  const thal = d.local ? d.usage : Math.min(d.thalamus, d.usage);
  return { total, thal, other: d.local ? 0 : d.usage - thal, free: Math.max(total - d.usage, 0) };
}

function Legend({ d }: { d: MeterData }) {
  const p = parts(d);
  if (d.local) {
    return (
      <div className="meter-legend">
        <div><i className="m-thal" />{t('meter.legendLocal')}<small>{fmtBytes(d.usage)}{d.limit ? ` / ${fmtBytes(d.limit)}` : ''}</small></div>
        <div className="meter-note">{t('meter.localNote')}</div>
      </div>
    );
  }
  return (
    <div className="meter-legend">
      <div><i className="m-thal" />Thalamus<small>{fmtBytes(p.thal)}</small></div>
      <div><i className="m-other" />{t('meter.legendOther')}<small>{fmtBytes(p.other)}</small></div>
      <div><i className="m-free" />{t('meter.legendFree')}<small>{d.limit ? `${fmtBytes(p.free)} / ${fmtBytes(d.limit)}` : t('meter.unlimited')}</small></div>
    </div>
  );
}

function Ring({ d }: { d: MeterData }) {
  const p = parts(d);
  const R = 46;
  const C = 2 * Math.PI * R;
  const len = (x: number) => (p.total ? (x / p.total) * C : 0);
  // Thalamus çok küçükse bile ince bir çizgi görünsün
  const thal = Math.max(len(p.thal), p.thal > 0 ? 2 : 0);
  const other = len(p.other);
  return (
    <div className="meter-chart ring">
      <svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label={t('meter.title')}>
        <circle cx="62" cy="62" r={R} fill="none" className="m-track" strokeWidth="13" />
        <g transform="rotate(-90 62 62)">
          <circle cx="62" cy="62" r={R} fill="none" className="m-other" strokeWidth="13" strokeDasharray={`${other} ${C}`} strokeDashoffset={-thal} />
          <circle cx="62" cy="62" r={R} fill="none" className="m-thal" strokeWidth="13" strokeDasharray={`${thal} ${C}`} />
        </g>
        <text x="62" y="62" textAnchor="middle" className="m-big">{d.limit ? fmtPct(d.usage / d.limit) : fmtBytes(d.usage)}</text>
        <text x="62" y="79" textAnchor="middle" className="m-sub">{t('meter.full')}</text>
      </svg>
      <Legend d={d} />
    </div>
  );
}

function Pie({ d }: { d: MeterData }) {
  const p = parts(d);
  const cx = 60;
  const cy = 60;
  const r = 54;
  const slices: [number, string][] = [[p.thal, 'm-thal'], [p.other, 'm-other'], [p.free, 'm-track']];
  let a0 = 0;
  const paths: React.ReactNode[] = [];
  for (const [val, cls] of slices) {
    let da = p.total ? (val / p.total) * 360 : 0;
    if (cls === 'm-thal' && val > 0) da = Math.max(da, 1.5);
    if (da <= 0) continue;
    if (da >= 359.99) {
      paths.push(<circle key={cls} cx={cx} cy={cy} r={r} className={cls} />);
      break;
    }
    const at = (a: number) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)].map((n) => n.toFixed(2));
    const [x1, y1] = at(a0);
    const [x2, y2] = at(a0 + da);
    paths.push(<path key={cls} d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${da > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} className={`${cls} m-slice`} />);
    a0 += da;
  }
  return (
    <div className="meter-chart pie">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={t('meter.title')}>{paths}</svg>
      <Legend d={d} />
    </div>
  );
}

export function Badge({ d }: { d: MeterData }) {
  const p = parts(d);
  const w = (x: number) => `${p.total ? (x / p.total) * 100 : 0}%`;
  return (
    <span className="meter-badge">
      <span aria-hidden>{d.local ? '💾' : '☁'}</span>
      <span className="bar"><i className="m-thal" style={{ width: w(p.thal), minWidth: p.thal > 0 ? 2 : 0 }} /><i className="m-other" style={{ width: w(p.other) }} /></span>
      <span><b>{fmtBytes(d.usage)}</b>{d.limit ? <span className="dim"> / {fmtBytes(d.limit)}</span> : null}</span>
      <span className="sep" />
      {d.local ? <span className="dim">{t('meter.badgeNoDrive')}</span> : <span><span className="dim">Thalamus</span> <b>{fmtBytes(d.thalamus)}</b></span>}
    </span>
  );
}
