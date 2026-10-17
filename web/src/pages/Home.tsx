import { useEffect, useMemo, useState } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { displayTitle, relTime, noteIcon } from '../lib/format';
import { calSettings } from '../lib/gcal';
import { listCalendars, listEvents, type ExtEvent } from '../lib/gcalFull';
import { loadAuth } from '../lib/google';
import { go } from '../lib/router';
import { dueCards, newPerDay } from '../lib/srs';
import { saveSettings, todayStr, useIndex, useStore } from '../lib/store';
import { createDefault } from '../lib/templates';
import { fmtMin, studyStats, useTimer } from '../lib/timer';
import { upcoming, whenText } from '../lib/upcoming';
import { TYPES, typeOf, type Note, type TypeId } from '../lib/types';
import { RoutineChecks } from './DailyPage';

// Ana sayfa: kullanıcının seçip sıraladığı bileşenlerden oluşur (ayarlar.home, Drive'da eşitlenir).

const QUICK: TypeId[] = ['note', 'book', 'paper', 'lab', 'conference', 'talk', 'movie', 'word', 'concept'];
const ACTIVE = new Set(['Okunuyor', 'İzleniyor', 'Devam ediyor']);

interface Widget {
  id: string;
  label: string;
  /** tam genişlik (ızgarada iki sütunu kaplar) */
  wide?: boolean;
  C: () => React.ReactNode;
}

const WIDGETS: Widget[] = [
  { id: 'today', label: 'Bugün (rutinler)', wide: true, C: Today },
  { id: 'agenda', label: 'Bugünün takvimi', C: Agenda },
  { id: 'review', label: 'Tekrar kartları', C: Review },
  { id: 'study', label: 'Çalışma süresi', C: Study },
  { id: 'quick', label: 'Hızlı ekle', wide: true, C: Quick },
  { id: 'upcoming', label: 'Yaklaşanlar', wide: true, C: Soon },
  { id: 'active', label: 'Devam edenler', C: Active },
  { id: 'recent', label: 'Son düzenlenenler', C: Recent },
  { id: 'word', label: 'Günün kelimesi', C: Word },
  { id: 'hubs', label: 'En bağlantılı notlar', C: Hubs },
  { id: 'colls', label: 'Koleksiyonlar', C: Colls },
];

/** Kayıtlı düzen + sonradan eklenen bileşenler (sona, açık olarak) */
export function homeLayout(saved?: { id: string; on: boolean }[]) {
  const known = new Set(WIDGETS.map((w) => w.id));
  const list = (saved ?? []).filter((x) => known.has(x.id));
  for (const w of WIDGETS) if (!list.some((x) => x.id === w.id)) list.push({ id: w.id, on: true });
  return list;
}

export default function Home() {
  const settings = useStore((s) => s.settings);
  const layout = homeLayout(settings.home);
  const [edit, setEdit] = useState(false);
  const save = (home: { id: string; on: boolean }[]) => void saveSettings({ ...useStore.getState().settings, home });
  const move = (i: number, d: number) => {
    const l = [...layout];
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    save(l);
  };

  return (
    <div className={`page wide home ${edit ? 'home-edit' : ''}`}>
      <div className="row home-top">
        <span className="spacer" />
        {edit && <button className="btn small" onClick={() => save(homeLayout())}>Varsayılana dön</button>}
        <button className={`btn small ${edit ? 'primary' : ''}`} onClick={() => setEdit(!edit)}>{edit ? '✓ Bitti' : '⚙ Ana sayfayı düzenle'}</button>
      </div>
      <div className="home-grid">
        {layout.map((x, i) => {
          const w = WIDGETS.find((y) => y.id === x.id)!;
          if (!x.on && !edit) return null;
          return (
            <section key={w.id} className={`widget ${w.wide ? 'wide' : ''} ${x.on ? '' : 'hidden'}`}>
              {edit && (
                <div className="widget-bar">
                  <label><input type="checkbox" checked={x.on} onChange={() => save(layout.map((y) => (y.id === x.id ? { ...y, on: !y.on } : y)))} /> {w.label}</label>
                  <span className="spacer" />
                  <button className="iconbtn" disabled={i === 0} title="Yukarı" onClick={() => move(i, -1)}>↑</button>
                  <button className="iconbtn" disabled={i === layout.length - 1} title="Aşağı" onClick={() => move(i, 1)}>↓</button>
                </div>
              )}
              {x.on && <w.C />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------- bileşenler ----------

function Today() {
  return (
    <div className="home-today">
      <div className="row">
        <h2>Bugün</h2>
        <span className="spacer" />
        <a className="btn small" href={`#/daily/${todayStr()}`}>Günlüğü aç →</a>
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

  return (
    <>
      <h3>Bugünün takvimi</h3>
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
            <span className="grow">{e.summary || '(başlıksız)'}</span>
            <span className="muted small">{e.time ? `${e.time}${e.endTime ? `–${e.endTime}` : ''}` : 'tüm gün'}</span>
          </a>
        ))}
        {!mine.length && !ext.length && <p className="muted small">Bugün için takvimde bir şey yok.</p>}
      </div>
      <a href="#/takvim" className="small">Takvimi aç →</a>
    </>
  );
}

function Review() {
  const notes = useStore((s) => s.notes);
  const { due, fresh } = useMemo(() => dueCards(Object.values(notes), todayStr(), newPerDay()), [notes]);
  return (
    <>
      <h3>Tekrar kartları</h3>
      {due.length + fresh.length ? (
        <div className="widget-kpi">
          <b>{due.length + fresh.length}</b>
          <span className="muted small">kart bekliyor{fresh.length ? ` (${fresh.length} yeni)` : ''}</span>
          <span className="spacer" />
          <a className="btn small primary" href="#/tekrar">🧠 Başla</a>
        </div>
      ) : <p className="muted small">Bugünlük tekrar yok 🎉</p>}
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
      <h3>Çalışma süresi</h3>
      <div className="widget-kpi">
        <b>{fmtMin(today)}</b><span className="muted small">bugün</span>
        <b>{fmtMin(s.total)}</b><span className="muted small">bu hafta</span>
        <span className="spacer" />
        <a className="small" href="#/calisma">Ayrıntılar →</a>
      </div>
      {running && notes[running.noteId] && <p className="small">⏱ Şu an: <a href={`#/n/${running.noteId}`}>{displayTitle(notes[running.noteId])}</a></p>}
      {s.groups.length > 0 && <div className="chips">{s.groups.slice(0, 4).map((g) => <NoteChip key={g.note.id} note={g.note} />)}</div>}
    </>
  );
}

function Quick() {
  return (
    <>
      <h3>Hızlı ekle</h3>
      <div className="quick">
        {QUICK.map((t) => (
          <button key={t} className="quickbtn" style={{ '--c': typeOf(t).color } as React.CSSProperties} onClick={() => go(`/n/${createDefault(t).id}`)}>
            <span>{typeOf(t).icon}</span>{typeOf(t).label}
          </button>
        ))}
      </div>
    </>
  );
}

function Soon() {
  const { alive } = useIndex();
  const soon = useMemo(() => upcoming(alive), [alive]);
  return (
    <>
      <h3>Yaklaşanlar</h3>
      {soon.length ? (
        <div className="list upcoming">
          {soon.map((u) => (
            <a key={u.note.id + u.def.key} className={`rowlink ${u.days < 0 ? 'overdue' : u.days <= 2 ? 'near' : ''}`} href={`#/n/${u.note.id}`}>
              <span>{noteIcon(u.note)}</span>
              <span className="grow">{displayTitle(u.note)} <span className="muted small">· {u.def.label}</span></span>
              <span className="when small">{whenText(u.days)}</span>
            </a>
          ))}
        </div>
      ) : <p className="muted small">Önümüzdeki iki haftada tarihli bir şey yok.</p>}
    </>
  );
}

function Active() {
  const { alive } = useIndex();
  const active = useMemo(() => alive.filter((n) => ACTIVE.has(n.props.status as string)), [alive]);
  return (
    <>
      <h3>Devam edenler</h3>
      <div className="list">
        {active.length ? active.map((n) => <Row key={n.id} n={n} meta={String(n.props.status)} />) : <p className="muted small">Okunan, izlenen ya da devam eden bir şey yok.</p>}
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
      <h3>Son düzenlenenler</h3>
      <div className="list">
        {recent.length ? recent.map((n) => <Row key={n.id} n={n} meta={relTime(n.updated_at)} />) : <p className="muted">Henüz not yok. “Hızlı ekle”den bir şey ekleyerek başla.</p>}
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
  return (
    <div className="wotd">
      <h3>Günün kelimesi</h3>
      {word ? (
        <>
          <a href={`#/n/${word.id}`} className="wotd-word">{word.title}</a>
          <div className="wotd-meaning">{String(word.props.meaning)}</div>
        </>
      ) : <p className="muted small">Sözlüğe anlamıyla birlikte kelime ekleyince burada her gün biri çıkar.</p>}
      <a href="#/dictionary" className="small">Sözlüğe git →</a>
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
  return (
    <>
      <h3>En bağlantılı notlar</h3>
      {hubs.length ? <div className="chips">{hubs.map(({ n }) => <NoteChip key={n.id} note={n} />)}</div> : <p className="muted small">Notlar arasında [[bağlantı]] kurdukça burada görünür.</p>}
      <a href="#/graph" className="small">Haritayı aç →</a>
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
      <h3>Koleksiyonlar</h3>
      <div className="colls">
        {TYPES.map((t) => (
          <a key={t.id} href={t.id === 'word' ? '#/dictionary' : t.id === 'daily' ? '#/daily' : `#/c/${t.id}`} className="coll">
            <span>{t.icon}</span> {t.plural} <span className="muted">{counts.get(t.id) ?? 0}</span>
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
