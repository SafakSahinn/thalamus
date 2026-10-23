import { optionLabel } from '../lib/types';
import { fmtNumber, localeTag, t } from '../i18n';
import { useMemo, useState } from 'react';
import { promptText } from '../components/Prompt';
import { NoteChip } from '../components/PropertyPanel';
import { displayTitle, fmtDate, fmtNum, noteIcon } from '../lib/format';
import { pace, readDay, readingStats, type ReadingGoal } from '../lib/reading';
import { saveSettings, useStore } from '../lib/store';

// Okuma istatistikleri (#/okuma): yıllık hedef, aya göre kitap/sayfa/makale, konular, yazarlar, okunanlar listesi.

const monthShort = (i: number) => new Date(2024, i, 1).toLocaleDateString(localeTag(), { month: 'short' });

export async function editGoal(year: number) {
  const settings = useStore.getState().settings;
  const cur = settings.readingGoals?.[year] ?? {};
  const b = await promptText(t('reading.stats.bookGoal', { year }), cur.books ? String(cur.books) : '12');
  if (b === null) return;
  const p = await promptText(t('reading.stats.paperGoal', { year }), cur.papers ? String(cur.papers) : '');
  if (p === null) return;
  const num = (v: string) => (Number(v.replace(/\D/g, '')) || undefined);
  const g: ReadingGoal = { books: num(b), papers: num(p) };
  void saveSettings({ ...useStore.getState().settings, readingGoals: { ...settings.readingGoals, [year]: g } });
}

/** Hedef çubuğu: yapılan / hedef + takvime göre önde/geride */
export function GoalBar({ label, done, goal, year }: { label: string; done: number; goal?: number; year: number }) {
  if (!goal) return null;
  const p = pace(done, goal, year);
  const thisYear = year === new Date().getFullYear();
  return (
    <div className="goal">
      <div className="goal-head">
        <span>{label}</span>
        <b>{done} / {goal}</b>
        {thisYear && done < goal && <span className={`small ${p.diff >= 0 ? 'ahead' : 'behind'}`}>{p.diff >= 0 ? t('reading.stats.ahead', { count: p.diff }) : t('reading.stats.behind', { count: -p.diff })}</span>}
        {done >= goal && <span className="small ahead">{t('reading.stats.goalDone')}</span>}
      </div>
      <div className="goal-bar">
        <span style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
        {thisYear && <i style={{ left: `${Math.min(100, (p.expected / goal) * 100)}%` }} title={t('reading.stats.expected')} />}
      </div>
    </div>
  );
}

export default function ReadingPage() {
  const notes = useStore((s) => s.notes);
  const goals = useStore((s) => s.settings.readingGoals);
  const [year, setYear] = useState(new Date().getFullYear());
  const [metric, setMetric] = useState<'books' | 'pages' | 'papers'>('books');
  const s = useMemo(() => readingStats(notes, year), [notes, year]);
  const g = goals?.[year] ?? {};
  const W = 640;
  const H = 160;
  const bw = W / 12;
  const vals = s.months.map((m) => m[metric]);
  const max = Math.max(1, ...vals);
  const unit = t(`reading.stats.units.${metric}`);

  return (
    <div className="page study-page reading-page">
      <div className="review-top">
        <h1>{t('reading.stats.title')}</h1>
        <span className="spacer" />
        <button className="iconbtn" onClick={() => setYear(year - 1)} title={t('reading.stats.prevYear')}>‹</button>
        <b>{year}</b>
        <button className="iconbtn" onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()} title={t('reading.stats.nextYear')}>›</button>
      </div>

      <div className="goals">
        <GoalBar label={t('reading.stats.books')} done={s.books.length} goal={g.books} year={year} />
        <GoalBar label={t('reading.stats.papers')} done={s.papers.length} goal={g.papers} year={year} />
        <button className="btn small" onClick={() => void editGoal(year)}>🎯 {g.books || g.papers ? t('reading.stats.changeGoal') : t('reading.stats.setGoal', { year })}</button>
      </div>

      <div className="study-kpis reading-kpis">
        <div><b>{s.books.length}</b><span className="muted small">{t('reading.stats.booksDone')}</span></div>
        <div><b>{fmtNum(s.pages)}</b><span className="muted small">{t('reading.stats.pagesLabel')}</span></div>
        <div><b>{s.papers.length}</b><span className="muted small">{t('reading.stats.papersRead')}</span></div>
        <div><b>{s.rating ? fmtNumber(s.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}</b><span className="muted small">{t('reading.stats.avgRating')}</span></div>
      </div>

      <div className="row">
        <h3>{t('reading.stats.byMonth')}</h3>
        <span className="spacer" />
        <div className="seg">
          {(['books', 'pages', 'papers'] as const).map((m) => (
            <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{t(`reading.stats.metrics.${m}`)}</button>
          ))}
        </div>
      </div>
      <div className="chart-view">
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="study-chart" role="img" aria-label={t('reading.stats.chartAria', { unit })}>
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--border)" />
          {vals.map((v, i) => {
            const h = (v / max) * (H - 16);
            return (
              <g key={i}>
                <title>{`${monthShort(i)}: ${fmtNum(v)} ${unit}`}</title>
                {v > 0 && <rect x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={h} rx={3} fill="var(--series-1)" />}
                {v > 0 && <text x={i * bw + bw / 2} y={H - h - 4} textAnchor="middle" className="study-val">{fmtNum(v)}</text>}
                <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" className="study-axis">{monthShort(i)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {metric === 'pages' && <p className="muted small">{t('reading.stats.pagesHint')}</p>}

      <div className="reading-cols">
        <section>
          <h3>{t('reading.stats.topics')}</h3>
          {s.topics.length ? (
            <div className="study-groups">
              {s.topics.map((tp) => (
                <div key={tp.note.id} className="study-row">
                  <NoteChip note={tp.note} />
                  <div className="study-bar"><span style={{ width: `${(tp.c / s.topics[0].c) * 100}%` }} /></div>
                  <span className="small">{tp.c}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted small">{t('reading.stats.topicsEmpty')}</p>}
        </section>
        <section>
          <h3>{t('reading.stats.authors')}</h3>
          {s.authors.length ? <div className="chips">{s.authors.map((a) => <NoteChip key={a.note.id} note={a.note} />)}</div> : <p className="muted small">{t('reading.stats.none')}</p>}
        </section>
      </div>

      <h3>{t('reading.stats.yearList', { year })}</h3>
      {s.books.length + s.papers.length ? (
        <div className="list">
          {[...s.books, ...s.papers].sort((a, b) => (readDay(b) ?? '').localeCompare(readDay(a) ?? '')).map((n) => (
            <a key={n.id} className="rowlink" href={`#/n/${n.id}`}>
              <span>{noteIcon(n)}</span>
              <span className="grow">{displayTitle(n)}{typeof n.props.rating === 'number' && n.props.rating > 0 && <span className="muted small"> · {'★'.repeat(n.props.rating)}</span>}</span>
              <span className="muted small">{fmtDate(readDay(n))}</span>
            </a>
          ))}
        </div>
      ) : (
        <p className="muted">{t.rich('reading.stats.yearEmpty', { done: <b>{optionLabel('Bitti')}</b>, read: <b>{optionLabel('Okundu')}</b> })}</p>
      )}
    </div>
  );
}
