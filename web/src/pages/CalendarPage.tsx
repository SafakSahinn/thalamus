import { useCallback, useEffect, useMemo, useState } from 'react';
import ExtEventDialog from '../components/ExtEventDialog';
import { openPeek, peekClick } from '../components/Peek';
import { addDays, displayTitle, noteIcon, parseDay } from '../lib/format';
import { calSettings, parseTime } from '../lib/gcal';
import { listCalendars, listEvents, moveEvent, type ExtCal, type ExtEvent } from '../lib/gcalFull';
import { loadAuth } from '../lib/google';
import { setProp, todayStr, useStore } from '../lib/store';
import { createDefault, isTemplate } from '../lib/templates';
import { typeOf, TYPES, type Note } from '../lib/types';

const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const dayDiff = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);

interface Item {
  note: Note;
  /** Taşınınca değişecek alan */
  key: string;
  label: string;
  /** Çok günlü aralığın bitiş alanı (taşınınca o da kayar) */
  endKey?: string;
}

type Entry = { kind: 'g'; ev: ExtEvent; at: string } | { kind: 'n'; it: Item; at: string };

const WDAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });
const MAX_PER_DAY = 4;
const VIEW_KEY = 'calendarView';

const HIDDEN_KEY = 'calendarHidden';
const loadHidden = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/** Bütün koleksiyonlardaki tarihler tek takvimde: son başvurular, konferanslar, teslimler, deneyler… */
export default function CalendarPage() {
  const notes = useStore((s) => s.notes);
  const settings = useStore((s) => s.settings);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [hidden, setHidden] = useState<string[]>(loadHidden);
  const [over, setOver] = useState<string | null>(null);
  /** "+" ile açılan gün menüsü */
  const [adding, setAdding] = useState<string | null>(null);
  // Diğer Google takvimleri (tam takvim izniyle)
  const external = calSettings(settings).external ?? [];
  const [cals, setCals] = useState<ExtCal[]>([]);
  const [ext, setExt] = useState<ExtEvent[]>([]);
  const [extErr, setExtErr] = useState('');
  const [extLoading, setExtLoading] = useState(false);
  const [dialog, setDialog] = useState<{ ev?: ExtEvent; day?: string } | null>(null);
  /** "+N daha" ile açılan gün */
  const [openDay, setOpenDay] = useState<string | null>(null);
  // Telefonda ajanda varsayılan
  const [view, setViewState] = useState<'month' | 'agenda'>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === 'month' || v === 'agenda') return v;
    } catch {
      /* yok say */
    }
    return innerWidth < 700 ? 'agenda' : 'month';
  });
  const setView = (v: 'month' | 'agenda') => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* yok say */
    }
  };

  // Tarih alanı olan koleksiyonlar (günlük kendi sayfasında)
  const types = useMemo(() => TYPES.filter((t) => t.id !== 'daily' && t.props.some((p) => p.kind === 'date')), [settings]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (day: string, it: Item) => map.set(day, [...(map.get(day) ?? []), it]);
    for (const n of Object.values(notes)) {
      if (n.deleted_at || isTemplate(n) || n.type === 'daily' || hidden.includes(n.type)) continue;
      const t = typeOf(n.type);
      const dates = t.props.filter((p) => p.kind === 'date');
      const multi = dates.length > 1;
      for (const def of dates) {
        const v = n.props[def.key];
        if (!isDay(v)) continue;
        const start = v.slice(0, 10);
        const end = n.props.end;
        // Başlangıç + bitiş: aralığın her gününde göster, bitişi ayrıca gösterme
        if (def.key === 'start' && isDay(end) && end.slice(0, 10) > start && dayDiff(start, end.slice(0, 10)) <= 62) {
          for (let d = start; d <= end.slice(0, 10); d = addDays(d, 1)) add(d, { note: n, key: 'start', endKey: 'end', label: '' });
          continue;
        }
        if (def.key === 'end' && isDay(n.props.start) && dates.some((p) => p.key === 'start') && start > String(n.props.start).slice(0, 10)) continue;
        add(start, { note: n, key: def.key, label: multi ? def.label : '' });
      }
    }
    // Gün içinde saatliler saat sırasıyla, saatsizler önce
    const at = (it: Item) => (it.note.type === 'event' && it.key === 'date' ? parseTime(it.note.props.time) ?? '' : '');
    for (const list of map.values()) list.sort((a, b) => at(a).localeCompare(at(b)));
    return map;
  }, [notes, hidden, settings]);

  const addOn = (typeId: string, day: string) => {
    const t = typeOf(typeId);
    const key = t.props.find((p) => p.kind === 'date')?.key;
    if (!key) return;
    setAdding(null);
    openPeek(createDefault(typeId, { [key]: day }).id);
  };

  const days = useMemo(() => {
    const offset = (cursor.getDay() + 6) % 7; // pazartesi başlangıç
    const start = new Date(cursor);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const from = ymd(days[0]);
  const to = ymd(days[days.length - 1]);
  const extKey = external.join(',');
  const loadExt = useCallback(async () => {
    if (!extKey || !navigator.onLine || !(await loadAuth())?.fullCalendar) {
      setCals([]);
      setExt([]);
      return;
    }
    setExtLoading(true);
    try {
      const all = await listCalendars();
      const shown = all.filter((c) => extKey.split(',').includes(c.id));
      setCals(shown);
      setExt((await Promise.all(shown.map((c) => listEvents(c, from, to)))).flat());
      setExtErr('');
    } catch (e) {
      setExtErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExtLoading(false);
    }
  }, [extKey, from, to]);
  useEffect(() => {
    void loadExt();
    // Başka yerde (telefonda) yapılan değişiklikler için ara ara yenile
    const id = setInterval(() => document.visibilityState === 'visible' && void loadExt(), 120_000);
    return () => clearInterval(id);
  }, [loadExt]);

  const extByDay = useMemo(() => {
    const map = new Map<string, ExtEvent[]>();
    for (const e of ext) {
      if (hidden.includes(`g:${e.calId}`)) continue;
      for (let d = e.date, i = 0; d <= e.endDate && i < 62; d = addDays(d, 1), i++) map.set(d, [...(map.get(d) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
  }, [ext, hidden]);
  const calOf = (id: string) => cals.find((c) => c.id === id);

  const toggleType = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* yok say */
    }
  };

  const dropExt = async (raw: string, day: string) => {
    const ev = ext.find((e) => `${e.calId}|${e.id}` === raw);
    if (!ev || !calOf(ev.calId)?.writable) return;
    const delta = dayDiff(ev.date, day);
    if (!delta) return;
    // Hemen ekranda taşı, sonra Google'a yaz
    setExt((list) => list.map((e) => (e === ev ? { ...e, date: addDays(e.date, delta), endDate: addDays(e.endDate, delta) } : e)));
    try {
      await moveEvent(ev, delta);
    } catch (e) {
      setExtErr(e instanceof Error ? e.message : String(e));
    }
    void loadExt();
  };

  const drop = (raw: string, day: string) => {
    const [id, key, endKey] = raw.split('|');
    const n = useStore.getState().notes[id];
    if (!n || !isDay(n.props[key])) return;
    const delta = dayDiff(String(n.props[key]).slice(0, 10), day);
    if (!delta) return;
    setProp(id, key, day);
    if (endKey && isDay(n.props[endKey])) setProp(id, endKey, addDays(String(n.props[endKey]).slice(0, 10), delta));
  };


  const today = todayStr();
  const move = (m: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + m, 1));
  const gcalOn = calSettings(settings).enabled;

  /** Bir günün bütün öğeleri, saat sırasıyla (tüm gün olanlar önce) */
  const entriesOf = (k: string): Entry[] => {
    const g: Entry[] = (extByDay.get(k) ?? []).map((ev) => ({ kind: 'g', ev, at: ev.time && ev.date === k ? ev.time : '' }));
    const n: Entry[] = (byDay.get(k) ?? []).map((it) => ({ kind: 'n', it, at: it.note.type === 'event' && it.key === 'date' ? parseTime(it.note.props.time) ?? '' : '' }));
    return [...g, ...n].sort((a, b) => a.at.localeCompare(b.at));
  };

  const renderEntry = (e: Entry, k: string, wide = false) => {
    if (e.kind === 'g') {
      const c = calOf(e.ev.calId);
      return (
        <button
          key={`g.${e.ev.calId}.${e.ev.id}`}
          type="button"
          className={`cal-item ${wide ? 'wide' : ''}`}
          style={{ '--c': c?.color } as React.CSSProperties}
          draggable={Boolean(c?.writable)}
          title={`${e.ev.summary}${c ? ` · ${c.summary}` : ''}`}
          onClick={() => setDialog({ ev: e.ev })}
          onDragStart={(ev) => ev.dataTransfer.setData('text/thalamus-gevent', `${e.ev.calId}|${e.ev.id}`)}
        >
          {e.at && <span className="cal-time">{e.at}</span>}
          <span className="cal-txt">{e.ev.summary}</span>
          {wide && c && <span className="cal-src">{c.summary}</span>}
        </button>
      );
    }
    const { note, key, label, endKey } = e.it;
    const t = typeOf(note.type);
    return (
      <a
        key={`n.${note.id}.${key}`}
        href={`#/n/${note.id}`}
        onClick={peekClick(note.id)}
        className={`cal-item ${wide ? 'wide' : ''}`}
        style={{ '--c': t.color } as React.CSSProperties}
        draggable
        title={`${displayTitle(note)}${label ? ` · ${label}` : ''}`}
        onDragStart={(ev) => ev.dataTransfer.setData('text/thalamus-date', [note.id, key, endKey ?? ''].join('|'))}
      >
        {e.at && <span className="cal-time">{e.at}</span>}
        <span className="cal-txt">{noteIcon(note)} {label && <span className="cal-lbl">{label}: </span>}{displayTitle(note)}</span>
        {wide && <span className="cal-src">{t.plural}</span>}
      </a>
    );
  };

  // Ajanda: bu ayın öğeleri olan günleri
  const monthDays = days.filter((d) => d.getMonth() === cursor.getMonth()).map(ymd);

  return (
    <div className="page calendar-page">
      <div className="cal-top">
        <h1>📆 Takvim</h1>
        <div className="seg cal-view">
          <button type="button" className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Ay</button>
          <button type="button" className={view === 'agenda' ? 'on' : ''} onClick={() => setView('agenda')}>Ajanda</button>
        </div>
      </div>
      <p className="muted small">
        Notlarındaki bütün tarihler{cals.length ? ' ve Google takvimlerin' : ''} tek yerde. Bir günün köşesindeki ＋ ile etkinlik, ▾ ile başka bir şey eklersin; öğeleri sürükleyerek taşırsın.
        {' '}Google Takvim eşitlemesi {gcalOn ? <><b>açık</b>.</> : <>kapalı. <a className="btn small primary cal-connect" href="#/settings">Google Takvim’i bağla</a></>}
      </p>
      <div className="chips cal-types">
        {types.map((t) => (
          <button key={t.id} type="button" className={`cal-type ${hidden.includes(t.id) ? '' : 'on'}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => toggleType(t.id)} aria-pressed={!hidden.includes(t.id)}>
            {t.icon} {t.plural}
          </button>
        ))}
        {cals.map((c) => (
          <button key={c.id} type="button" className={`cal-type ${hidden.includes(`g:${c.id}`) ? '' : 'on'}`} style={{ '--c': c.color } as React.CSSProperties} onClick={() => toggleType(`g:${c.id}`)} aria-pressed={!hidden.includes(`g:${c.id}`)}>
            <span className="ext-dot" style={{ background: c.color }} /> {c.summary}
          </button>
        ))}
      </div>
      {extErr && <p className="err small">{extErr}</p>}
      <div className="calendar" data-tour="calendar">
        <div className="cal-head">
          <b className="cal-month">{MONTH.format(cursor)}</b>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Bugün</button>
          <button type="button" className="cal-nav" onClick={() => move(-1)} aria-label="Önceki ay">‹</button>
          <button type="button" className="cal-nav" onClick={() => move(1)} aria-label="Sonraki ay">›</button>
          {cals.length > 0 && <button type="button" className="cal-nav" title="Google takvimlerini yenile" aria-label="Google takvimlerini yenile" disabled={extLoading} onClick={() => void loadExt()}>{extLoading ? '…' : '⟳'}</button>}
        </div>

        {view === 'month' ? (
          <div className="cal-grid">
            {WEEK.map((w, i) => <div key={w} className={`cal-wd ${i > 4 ? 'we' : ''}`}>{w}</div>)}
            {days.map((d, i) => {
              const k = ymd(d);
              const all = entriesOf(k);
              const open = openDay === k;
              const shown = open ? all : all.slice(0, MAX_PER_DAY);
              const other = d.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={k}
                  className={`cal-day ${other ? 'other' : ''} ${k === today ? 'today' : ''} ${over === k ? 'over' : ''} ${i % 7 > 4 ? 'we' : ''} ${open ? 'open' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(k); }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    const raw = e.dataTransfer.getData('text/thalamus-date');
                    if (raw) drop(raw, k);
                    const g = e.dataTransfer.getData('text/thalamus-gevent');
                    if (g) void dropExt(g, k);
                  }}
                >
                  <div className="cal-num">
                    <span className="cal-n">{parseDay(k).getDate()}</span>
                    <button type="button" className="cal-add" title="Bu güne etkinlik ekle" aria-label="Bu güne ekle" onClick={() => addOn('event', k)}>＋</button>
                    <button type="button" className="cal-add" title="Bu güne başka bir şey ekle" aria-label="Başka bir şey ekle" onClick={() => setAdding(adding === k ? null : k)}>▾</button>
                  </div>
                  {adding === k && (
                    <div className="cal-addmenu" role="menu">
                      {cals.some((c) => c.writable) && (
                        <button type="button" role="menuitem" onClick={() => { setAdding(null); setDialog({ day: k }); }}>📅 Google Takvim etkinliği</button>
                      )}
                      {types.map((t) => (
                        <button key={t.id} type="button" role="menuitem" onClick={() => addOn(t.id, k)}>{t.icon} {t.label}</button>
                      ))}
                    </div>
                  )}
                  {shown.map((e) => renderEntry(e, k))}
                  {all.length > MAX_PER_DAY && (
                    <button type="button" className="cal-more" onClick={() => setOpenDay(open ? null : k)}>
                      {open ? 'Daha az' : `+${all.length - MAX_PER_DAY} daha`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="agenda">
            {monthDays.filter((k) => entriesOf(k).length).map((k) => (
              <div key={k} className={`agenda-day ${k === today ? 'today' : ''} ${k < today ? 'past' : ''}`}>
                <div className="agenda-date">
                  <span className="agenda-n">{parseDay(k).getDate()}</span>
                  <span className="agenda-wd">{WDAY.format(parseDay(k))}</span>
                </div>
                <div className="agenda-items">{entriesOf(k).map((e) => renderEntry(e, k, true))}</div>
              </div>
            ))}
            {!monthDays.some((k) => entriesOf(k).length) && <p className="muted">Bu ay için bir şey yok.</p>}
          </div>
        )}
      </div>
      {dialog && <ExtEventDialog ev={dialog.ev} day={dialog.day} cals={cals} onClose={() => setDialog(null)} onChanged={() => void loadExt()} />}
    </div>
  );
}
