import { useMemo, useState } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { useStore } from '../lib/store';
import { fmtMin, studyStats } from '../lib/timer';

// Çalışma istatistikleri (#/calisma): günlük toplam süre (çubuk grafik) + ders/proje bazında dağılım.

const DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export default function StudyPage() {
  const notes = useStore((s) => s.notes);
  const [days, setDays] = useState(7);
  const s = useMemo(() => studyStats(notes, days), [notes, days]);
  const max = Math.max(60, ...s.days.map((d) => d.min));
  const avg = Math.round(s.total / days);
  const W = 640;
  const H = 180;
  const bw = W / s.days.length;
  const label = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return days === 7 ? DAY_NAMES[new Date(y, m - 1, d).getDay()] : String(d);
  };

  return (
    <div className="page study-page">
      <div className="review-top">
        <h1>⏱ Çalışma</h1>
        <span className="spacer" />
        <div className="seg">
          {[7, 30].map((d) => <button key={d} className={`${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>Son {d} gün</button>)}
        </div>
      </div>
      <div className="study-kpis">
        <div><b>{fmtMin(s.total)}</b><span className="muted small">toplam</span></div>
        <div><b>{fmtMin(avg)}</b><span className="muted small">günlük ortalama</span></div>
        <div><b>{s.days.filter((d) => d.min > 0).length} / {days}</b><span className="muted small">çalışılan gün</span></div>
      </div>
      <div className="chart-view">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="study-chart" role="img" aria-label="Günlük çalışma süresi">
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border)" />
          {s.days.map((d, i) => {
            const h = (d.min / max) * (H - 16);
            const show = days === 7 || i % 5 === 0 || i === s.days.length - 1;
            return (
              <g key={d.day}>
                <title>{`${d.day}: ${fmtMin(d.min)}`}</title>
                {d.min > 0 && <rect x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={h} rx={3} fill="var(--series-1)" />}
                {d.min > 0 && days === 7 && <text x={i * bw + bw / 2} y={H - h - 4} textAnchor="middle" className="study-val">{fmtMin(d.min)}</text>}
                {show && <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" className="study-axis">{label(d.day)}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <h3>Nerede çalıştım?</h3>
      {s.groups.length === 0 ? (
        <p className="muted">Bu dönemde kayıtlı çalışma yok. Bir notun (ders, makale, proje…) başlığındaki <b>⏱ Çalış</b> düğmesiyle zamanlayıcıyı başlat; makale ve deneyler bağlı oldukları dersin altında toplanır.</p>
      ) : (
        <div className="study-groups">
          {s.groups.map((g) => (
            <div key={g.note.id} className="study-row">
              <NoteChip note={g.note} />
              <div className="study-bar"><span style={{ width: `${(g.min / s.groups[0].min) * 100}%` }} /></div>
              <span className="small">{fmtMin(g.min)} <span className="muted">· %{Math.round((g.min / Math.max(1, s.total)) * 100)}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
