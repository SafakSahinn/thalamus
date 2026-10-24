import { t, type Messages } from '../i18n';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { openMenu, type MenuItem } from '../components/ContextMenu';
import { NoteChip } from '../components/PropertyPanel';
import { displayTitle, relTime, noteIcon } from '../lib/format';
import { calSettings } from '../lib/gcal';
import { listCalendars, listEvents, type ExtEvent } from '../lib/gcalFull';
import { loadAuth } from '../lib/google';
import { go } from '../lib/router';
import { dueCards, isCard, newPerDay } from '../lib/srs';
import { saveSettings, todayStr, useIndex, useStore } from '../lib/store';
import { createDefault } from '../lib/templates';
import { fmtMin, studyStats, useTimer } from '../lib/timer';
import { upcoming, whenText } from '../lib/upcoming';
import { optionLabel, typeOf, TYPES, type Note, type TypeId } from '../lib/types';
import { RoutineChecks } from './DailyPage';
import { editGoal, GoalBar } from './ReadingPage';
import { readingStats } from '../lib/reading';
import { addSticky } from '../lib/sticky';
import { meterSettings, patchMeter } from '../lib/driveMeter';
import { installedList, isInstalled, type PluginId } from '../lib/plugins';

const OnThisDayLazy = lazy(() => import('../components/OnThisDay'));
const OnThisDay = () => <Suspense fallback={null}><OnThisDayLazy /></Suspense>;
const MeterWidgetLazy = lazy(() => import('../components/meter/MeterWidget'));
const MeterWidget = () => <Suspense fallback={null}><MeterWidgetLazy /></Suspense>;

// Ana sayfa: bileşenlerden oluşur; hangilerinin görüneceği ve sırası Ayarlar > Ana sayfa'dan seçilir
// (ayarlar.homeLayout, Drive'da eşitlenir). Boş bileşenler kendini gizler.

const QUICK: TypeId[] = ['note', 'book', 'paper', 'lab', 'conference', 'talk', 'movie', 'word', 'concept'];
const ACTIVE = new Set(['Okunuyor', 'İzleniyor', 'Devam ediyor']);

type WidgetId = keyof Messages['home']['widgets'];
interface Widget {
  id: WidgetId;
  readonly label: string;
  /** tam genişlik (ızgarada iki sütunu kaplar) */
  wide?: boolean;
  /** varsayılan olarak kapalı (Ayarlar'dan açılır) */
  off?: boolean;
  /** eklentiye ait bileşen: yalnız marketten kurulduysa var olur (kurulunca görünür gelir) */
  plugin?: PluginId;
  C: () => React.ReactNode;
}

const widget = (id: WidgetId, C: () => React.ReactNode, o: Pick<Widget, 'wide' | 'off' | 'plugin'> = {}): Widget => ({
  id, C, ...o, get label() { return t(`home.widgets.${id}`); },
});

const WIDGETS: Widget[] = [
  widget('today', Today, { wide: true }),
  widget('quick', Quick, { wide: true }),
  widget('upcoming', Soon, { wide: true }),
  widget('review', Review),
  widget('study', Study),
  widget('active', Active),
  widget('recent', Recent),
  widget('word', Word),
  widget('hubs', Hubs),
  widget('agenda', Agenda, { off: true }),
  widget('reading', Reading, { off: true }),
  widget('colls', Colls, { off: true }),
  widget('otd', OnThisDay, { wide: true, plugin: 'otd' }),
  // varsayılan kapalı: eklenti asıl olarak serbest gadget hâliyle görünür
  widget('drivemeter', MeterWidget, { off: true, plugin: 'drivemeter' }),
];

type Layout = { id: string; on: boolean }[];

/** Kayıtlı düzen + sonradan eklenen bileşenler (sona, varsayılan görünürlükle); kurulu olmayan eklentilerin bileşenleri çıkarılır */
export function homeLayout(saved?: Layout, installed: string[] = []): Layout {
  const known = new Set<string>(WIDGETS.filter((w) => !w.plugin || installed.includes(w.plugin)).map((w) => w.id));
  const list = (saved ?? []).filter((x) => known.has(x.id));
  for (const w of WIDGETS) if (known.has(w.id) && !list.some((x) => x.id === w.id)) list.push({ id: w.id, on: !w.off });
  return list;
}

/** Ana sayfada (içerik alanının herhangi bir yerinde) sağ tık menüsü (yazı alanları, bağlantılar ve seçili metin tarayıcının kendi menüsünde kalır) */
export function homeContextMenu(e: React.MouseEvent) {
  const el = e.target as HTMLElement;
  if (el.closest('input, textarea, select, a, [contenteditable="true"]') || String(getSelection() ?? '').trim()) return;
  const at = { x: e.clientX, y: e.clientY };
  const items: MenuItem[] = [];
  if (isInstalled('sticky')) items.push({ key: 'sticky', icon: '🗒', label: t('home.addSticky'), run: () => addSticky(at) });
  // gizlenmiş depolama göstergesini geri getir (konumu sağ tıklanan yer olur)
  if (isInstalled('drivemeter') && meterSettings().hidden) {
    items.push({ key: 'meter', icon: '⏲', label: t('meter.show'), run: () => void patchMeter({ hidden: false, x: at.x / innerWidth, y: at.y / innerHeight }) });
  }
  if (!items.length) return;
  e.preventDefault();
  openMenu(e.clientX, e.clientY, items);
}

export default function Home() {
  const settings = useStore((s) => s.settings);
  const layout = homeLayout(settings.homeLayout, installedList(settings));
  return (
    <div className="page wide home">
      <div className="home-grid">
        {layout.map((x) => {
          const w = WIDGETS.find((y) => y.id === x.id)!;
          return x.on ? <section key={w.id} className={`widget ${w.wide ? 'wide' : ''}`}><w.C /></section> : null;
        })}
      </div>
    </div>
  );
}

/** Ayarlar > Ana sayfa: bileşenleri aç/kapat ve sırala */
export function HomeSettings() {
  const settings = useStore((s) => s.settings);
  const saved = settings.homeLayout;
  const layout = homeLayout(saved, installedList(settings));
  const save = (homeLayout: Layout | undefined) => void saveSettings({ ...useStore.getState().settings, homeLayout });
  const move = (i: number, d: number) => {
    const l = [...layout];
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    save(l);
  };
  return (
    <div className="home-settings">
      {layout.map((x, i) => (
        <div key={x.id} className={`home-set-row ${x.on ? '' : 'off'}`}>
          <label><input type="checkbox" checked={x.on} onChange={() => save(layout.map((y) => (y.id === x.id ? { ...y, on: !y.on } : y)))} /> {WIDGETS.find((w) => w.id === x.id)!.label}</label>
          <span className="spacer" />
          <button className="iconbtn" disabled={i === 0} title={t('home.up')} onClick={() => move(i, -1)}>↑</button>
          <button className="iconbtn" disabled={i === layout.length - 1} title={t('home.down')} onClick={() => move(i, 1)}>↓</button>
        </div>
      ))}
      {saved && <button className="btn small" onClick={() => save(undefined)}>{t('home.reset')}</button>}
    </div>
  );
}

// ---------- bileşenler ----------

function Today() {
  return (
    <div className="home-today">
      <div className="row">
        <h2>{t('home.today')}</h2>
        <span className="spacer" />
        <a className="btn small" href={`#/daily/${todayStr()}`}>{t('home.openDaily')}</a>
      </div>
      <RoutineChecks date={todayStr()} compact />
    </div>
  );
}

function Agenda() {
  const { alive } = useIndex();
  const settings = useStore((s) => s.settings);
  const today = todayStr();
  const mine = useMemo(() => upcoming(alive, 0, 0).filter((u) => u.days === 0), [alive]);
  const [ext, setExt] = useState<ExtEvent[]>([]);
  const extKey = (calSettings(settings).external ?? []).join(',');
  useEffect(() => {
    let off = false;
    void (async () => {
      if (!extKey || !navigator.onLine || !(await loadAuth())?.fullCalendar) return;
      const cals = (await listCalendars()).filter((c) => extKey.split(',').includes(c.id));
      const evs = (await Promise.all(cals.map((c) => listEvents(c, today, today)))).flat();
      if (!off) setExt(evs.filter((e) => e.date <= today && e.endDate >= today).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')));
    })().catch(() => undefined);
    return () => { off = true; };
  }, [extKey, today]);

  if (!mine.length && !ext.length) return null;
  return (
    <>
      <h3>{t('home.widgets.agenda')}</h3>
      <div className="list">
        {mine.map((u) => (
          <a key={u.note.id + u.def.key} className="rowlink" href={`#/n/${u.note.id}`}>
            <span>{noteIcon(u.note)}</span>
            <span className="grow">{displayTitle(u.note)} <span className="muted small">· {u.def.label}</span></span>
          </a>
        ))}
        {ext.map((e) => (
          <a key={e.calId + e.id} className="rowlink" href="#/takvim">
            <span>📅</span>
            <span className="grow">{e.summary || t('dialogs.extEvent.untitled')}</span>
            <span className="muted small">{e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ''}` : t('home.allDay')}</span>
          </a>
        ))}
      </div>
      <a href="#/takvim" className="small">{t('home.openCalendar')}</a>
    </>
  );
}

function Review() {
  const notes = useStore((s) => s.notes);
  const { due, fresh } = useMemo(() => dueCards(Object.values(notes), todayStr(), newPerDay()), [notes]);
  const any = useMemo(() => Object.values(notes).some(isCard), [notes]);
  if (!any) return null;
  return (
    <>
      <h3>{t('home.widgets.review')}</h3>
      {due.length + fresh.length ? (
        <div className="widget-kpi">
          <b>{due.length + fresh.length}</b>
          <span className="muted small">{fresh.length ? t('home.cardsWaitingNew', { count: fresh.length }) : t('home.cardsWaiting')}</span>
          <span className="spacer" />
          <a className="btn small primary" href="#/tekrar">{t('home.start')}</a>
        </div>
      ) : <p className="muted small">{t('home.noReview')}</p>}
    </>
  );
}

function Study() {
  const notes = useStore((s) => s.notes);
  const running = useTimer((s) => s.running);
  const s = useMemo(() => studyStats(notes, 7), [notes]);
  const today = s.days.at(-1)?.min ?? 0;
  return (
    <>
      <h3>{t('home.widgets.study')}</h3>
      <div className="widget-kpi">
        <b>{fmtMin(today)}</b><span className="muted small">{t('home.todayLabel')}</span>
        <b>{fmtMin(s.total)}</b><span className="muted small">{t('home.thisWeek')}</span>
        <span className="spacer" />
        <a className="small" href="#/calisma">{t('home.details')}</a>
      </div>
      {running && notes[running.noteId] && <p className="small">{t('home.now')} <a href={`#/n/${running.noteId}`}>{displayTitle(notes[running.noteId])}</a></p>}
      {s.groups.length > 0 && <div className="chips">{s.groups.slice(0, 4).map((g) => <NoteChip key={g.note.id} note={g.note} />)}</div>}
    </>
  );
}

function Quick() {
  return (
    <>
      <h3>{t('home.widgets.quick')}</h3>
      <div className="quick">
        {QUICK.map((ty) => (
          <button key={ty} className="quickbtn" style={{ '--c': typeOf(ty).color } as React.CSSProperties} onClick={() => go(`/n/${createDefault(ty).id}`)}>
            <span>{typeOf(ty).icon}</span>{typeOf(ty).label}
          </button>
        ))}
      </div>
    </>
  );
}

function Soon() {
  const { alive } = useIndex();
  const soon = useMemo(() => upcoming(alive), [alive]);
  if (!soon.length) return null;
  return (
    <>
      <h3>{t('home.widgets.upcoming')}</h3>
      {(
        <div className="list upcoming">
          {soon.map((u) => (
            <a key={u.note.id + u.def.key} className={`rowlink ${u.days < 0 ? 'overdue' : u.days <= 2 ? 'near' : ''}`} href={`#/n/${u.note.id}`}>
              <span>{noteIcon(u.note)}</span>
              <span className="grow">{displayTitle(u.note)} <span className="muted small">· {u.def.label}</span></span>
              <span className="when small">{whenText(u.days)}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function Active() {
  const { alive } = useIndex();
  const active = useMemo(() => alive.filter((n) => ACTIVE.has(n.props.status as string)), [alive]);
  if (!active.length) return null;
  return (
    <>
      <h3>{t('home.widgets.active')}</h3>
      <div className="list">
        {active.map((n) => <Row key={n.id} n={n} meta={optionLabel(String(n.props.status))} />)}
      </div>
    </>
  );
}

function Recent() {
  const { alive } = useIndex();
  const recent = useMemo(
    () => alive.filter((n) => n.type !== 'daily').sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 10),
    [alive],
  );
  return (
    <>
      <h3>{t('home.widgets.recent')}</h3>
      <div className="list">
        {recent.length ? recent.map((n) => <Row key={n.id} n={n} meta={relTime(n.updated_at)} />) : <p className="muted">{t('home.noNotes')}</p>}
      </div>
    </>
  );
}

function Word() {
  const { alive } = useIndex();
  const word = useMemo(() => {
    const words = alive.filter((n) => n.type === 'word' && !n.props.learned && n.props.meaning);
    if (!words.length) return null;
    const day = Math.floor(Date.now() / 86_400_000);
    return words[day % words.length];
  }, [alive]);
  if (!word) return null;
  return (
    <div className="wotd">
      <h3>{t('home.widgets.word')}</h3>
      <a href={`#/n/${word.id}`} className="wotd-word">{word.title}</a>
      <div className="wotd-meaning">{String(word.props.meaning)}</div>
      <a href="#/dictionary" className="small">{t('home.toDict')}</a>
    </div>
  );
}

function Hubs() {
  const { alive, backlinks } = useIndex();
  const hubs = useMemo(
    () => alive.filter((n) => n.type !== 'daily')
      .map((n) => ({ n, c: (backlinks.get(n.id)?.length ?? 0) + n.links.length }))
      .filter((x) => x.c > 1).sort((a, b) => b.c - a.c).slice(0, 8),
    [alive, backlinks],
  );
  if (!hubs.length) return null;
  return (
    <>
      <h3>{t('home.widgets.hubs')}</h3>
      <div className="chips">{hubs.map(({ n }) => <NoteChip key={n.id} note={n} />)}</div>
      <a href="#/graph" className="small">{t('home.openMap')}</a>
    </>
  );
}

function Colls() {
  const { alive } = useIndex();
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of alive) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [alive]);
  return (
    <>
      <h3>{t('home.widgets.colls')}</h3>
      <div className="colls">
        {TYPES.map((ty) => (
          <a key={ty.id} href={ty.id === 'word' ? '#/dictionary' : ty.id === 'daily' ? '#/daily' : `#/c/${ty.id}`} className="coll">
            <span>{ty.icon}</span> {ty.plural} <span className="muted">{counts.get(ty.id) ?? 0}</span>
          </a>
        ))}
      </div>
    </>
  );
}

function Row({ n, meta }: { n: Note; meta: string }) {
  return (
    <a className="rowlink" href={`#/n/${n.id}`}>
      <span>{noteIcon(n)}</span>
      <span className="grow">{displayTitle(n)}</span>
      <span className="muted small">{meta}</span>
    </a>
  );
}

function Reading() {
  const notes = useStore((s) => s.notes);
  const year = new Date().getFullYear();
  const g = useStore((s) => s.settings.readingGoals?.[year]);
  const s = useMemo(() => readingStats(notes, year), [notes, year]);
  const now = useMemo(() => Object.values(notes).filter((n) => !n.deleted_at && n.type === 'book' && n.props.status === 'Okunuyor'), [notes]);
  return (
    <>
      <h3>{t('home.widgets.reading')}</h3>
      {g?.books || g?.papers ? (
        <>
          <GoalBar label={t('reading.stats.books')} done={s.books.length} goal={g.books} year={year} />
          <GoalBar label={t('reading.stats.papers')} done={s.papers.length} goal={g.papers} year={year} />
        </>
      ) : (
        <p className="muted small">{t('home.yearSummary', { books: s.books.length, papers: s.papers.length })} <button className="linkbtn" onClick={() => void editGoal(year)}>{t('home.setGoal')}</button></p>
      )}
      {now.length > 0 && <div className="chips">{now.slice(0, 4).map((n) => <NoteChip key={n.id} note={n} />)}</div>}
      <a href="#/okuma" className="small">{t('home.stats')}</a>
    </>
  );
}
