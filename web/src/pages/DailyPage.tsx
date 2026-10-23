import { t } from '../i18n';
import { useMemo } from 'react';
import DatePicker from '../components/DatePicker';
import NoteEditor from '../editor/Editor';
import { addDays, fmtDay, parseDay } from '../lib/format';
import { go } from '../lib/router';
import { ensureDaily, findDaily, setProp, todayStr, updateNote, useStore } from '../lib/store';
import type { Routine } from '../lib/types';
import { Backlinks } from './NotePage';

type Checks = Record<string, boolean>;

export function RoutineChecks({ date, compact }: { date: string; compact?: boolean }) {
  const notes = useStore((s) => s.notes);
  const routines = useStore((s) => s.settings.routines);
  const daily = findDaily(date, notes);
  const checks = (daily?.props.routines as Checks) ?? {};
  const toggle = (r: Routine) => {
    const n = ensureDaily(date);
    const cur = (useStore.getState().notes[n.id].props.routines as Checks) ?? {};
    setProp(n.id, 'routines', { ...cur, [r.id]: !cur[r.id] });
  };
  if (!routines.length) return <p className="muted small">{t.rich('writing.daily.noRoutines', { link: <a href="#/settings">{t('writing.daily.settings')}</a> })}</p>;
  return (
    <div className={`routines ${compact ? 'compact' : ''}`} data-tour="routines">
      {routines.map((r) => (
        <button key={r.id} className={`routine ${checks[r.id] ? 'done' : ''}`} onClick={() => toggle(r)}>
          <span className="ric">{r.icon}</span> {r.label} {checks[r.id] && <span className="tick">✓</span>}
        </button>
      ))}
    </div>
  );
}

/** Son 5 haftanın rutin ızgarası */
function Heatmap({ date }: { date: string }) {
  const notes = useStore((s) => s.notes);
  const routines = useStore((s) => s.settings.routines);
  const byDate = useMemo(() => {
    const m = new Map<string, Checks>();
    for (const n of Object.values(notes)) {
      if (n.type === 'daily' && !n.deleted_at && typeof n.props.date === 'string') m.set(n.props.date, (n.props.routines as Checks) ?? {});
    }
    return m;
  }, [notes]);
  const days = useMemo(() => {
    const out: { d: string; done: number }[] = [];
    for (let i = 34; i >= 0; i--) {
      const d = addDays(date, -i);
      const c = byDate.get(d) ?? {};
      out.push({ d, done: routines.filter((r) => c[r.id]).length });
    }
    return out;
  }, [date, byDate, routines]);
  const streaks = routines.map((r) => {
    let s = 0;
    for (let i = 0; i < 3650; i++) {
      if (byDate.get(addDays(todayStr(), -i))?.[r.id]) s++;
      else if (i > 0) break;
    }
    return { r, s };
  });
  const max = Math.max(1, routines.length);
  return (
    <div className="heat-wrap">
      <div className="heat">
        {days.map(({ d, done }) => (
          <button
            key={d}
            className={`hc ${d === date ? 'cur' : ''}`}
            style={{ '--a': done / max } as React.CSSProperties}
            title={`${fmtDay(d)}: ${done}/${routines.length}`}
            onClick={() => go(`/daily/${d}`)}
          >
            {parseDay(d).getDate()}
          </button>
        ))}
      </div>
      <div className="streaks">
        {streaks.map(({ r, s }) => (
          <span key={r.id} className="streak" title={t('writing.daily.streakTitle')}>{r.icon} {t('writing.daily.streak', { count: s })}</span>
        ))}
      </div>
    </div>
  );
}

export default function DailyPage({ date: d }: { date?: string }) {
  const date = d ?? todayStr();
  const notes = useStore((s) => s.notes);
  const daily = findDaily(date, notes);
  const rev = useStore((s) => (daily ? s.remoteRev[daily.id] : 0));
  const isToday = date === todayStr();
  const routineCount = useStore((s) => s.settings.routines.length);
  // Takvimde günlüğü olan günler; nokta rutinlerin ne kadarının yapıldığına göre koyulaşır
  const marks = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of Object.values(notes)) {
      if (n.type !== 'daily' || n.deleted_at || typeof n.props.date !== 'string') continue;
      const done = Object.values((n.props.routines as Record<string, boolean>) ?? {}).filter(Boolean).length;
      if (n.content || done) m.set(n.props.date, routineCount ? Math.min(1, done / routineCount) : 1);
    }
    return m;
  }, [notes, routineCount]);

  return (
    <div className="page">
      <div className="daily-nav">
        <button className="iconbtn" onClick={() => go(`/daily/${addDays(date, -1)}`)} title={t('writing.daily.prevDay')}>‹</button>
        <h1 className="daily-title">{fmtDay(date)}</h1>
        <button className="iconbtn" onClick={() => go(`/daily/${addDays(date, 1)}`)} title={t('writing.daily.nextDay')}>›</button>
        {!isToday && <button className="btn small" onClick={() => go('/daily')}>{t('writing.daily.today')}</button>}
        <span className="spacer" />
        <DatePicker value={date} marks={marks} label={t('writing.daily.pickDay')} onChange={(v) => go(`/daily/${v}`)} />
      </div>
      <h3>{t('writing.daily.routines')}</h3>
      <RoutineChecks date={date} />
      <Heatmap date={date} />
      <h3>{t('writing.daily.note')}</h3>
      <NoteEditor
        docKey={`daily-${date}`}
        content={daily?.content ?? null}
        rev={rev}
        placeholder={t('writing.daily.placeholder')}
        onChange={(doc) => updateNote(ensureDaily(date).id, { content: doc })}
      />
      {daily && <Backlinks note={daily} />}
    </div>
  );
}
