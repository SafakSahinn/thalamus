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

  return (
    <div className="page calendar-page">
      <h1>📆 Takvim</h1>
      <p className="muted small">
        Bütün notlarındaki tarihler: etkinlikler, son başvurular, konferanslar, teslimler, deneyler… Bir güne ＋ ile etkinlik, ▾ ile başka koleksiyondan not ekleyebilir; öğeleri başka güne sürükleyebilirsin.
        {' '}Google Takvim eşitlemesi {gcalOn ? <b>açık</b> : <>kapalı · <a href="#/settings">Ayarlar’dan bağla</a></>}.
      </p>
      <div className="chips cal-types">
        {types.map((t) => (
          <button key={t.id} type="button" className={`cal-type ${hidden.includes(t.id) ? '' : 'on'}`} onClick={() => toggleType(t.id)} aria-pressed={!hidden.includes(t.id)}>
            {t.icon} {t.plural}
          </button>
        ))}
        {cals.map((c) => (
          <button key={c.id} type="button" className={`cal-type ${hidden.includes(`g:${c.id}`) ? '' : 'on'}`} onClick={() => toggleType(`g:${c.id}`)} aria-pressed={!hidden.includes(`g:${c.id}`)}>
            <span className="ext-dot" style={{ background: c.color }} /> {c.summary}
          </button>
        ))}
      </div>
      {extErr && <p className="err small">{extErr}</p>}
      <div className="calendar" data-tour="calendar">
        <div className="cal-head">
          <button type="button" className="iconbtn" onClick={() => move(-1)} aria-label="Önceki ay">‹</button>
          <b className="cal-month">{MONTH.format(cursor)}</b>
          <button type="button" className="iconbtn" onClick={() => move(1)} aria-label="Sonraki ay">›</button>
          <button type="button" className="btn small" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Bugün</button>
          {cals.length > 0 && <button type="button" className="iconbtn" title="Google takvimlerini yenile" aria-label="Google takvimlerini yenile" disabled={extLoading} onClick={() => void loadExt()}>{extLoading ? '…' : '⟳'}</button>}
        </div>
        <div className="cal-grid">
          {WEEK.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {days.map((d) => {
            const k = ymd(d);
            const items = byDay.get(k) ?? [];
            const gitems = extByDay.get(k) ?? [];
            const room = Math.max(0, 5 - gitems.length);
            const other = d.getMonth() !== cursor.getMonth();
            return (
              <div
                key={k}
                className={`cal-day ${other ? 'other' : ''} ${k === today ? 'today' : ''} ${over === k ? 'over' : ''}`}
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
                  {parseDay(k).getDate()}
                  <button type="button" className="cal-add" title="Bu güne etkinlik ekle" aria-label="Bu güne ekle" onClick={() => addOn('event', k)}>＋</button>
                  <button type="button" className="cal-add" title="Bu güne başka koleksiyondan ekle" aria-label="Başka koleksiyondan ekle" onClick={() => setAdding(adding === k ? null : k)}>▾</button>
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
                {gitems.slice(0, 5).map((ge) => {
                  const c = calOf(ge.calId);
                  return (
                    <button
                      key={`${ge.calId}.${ge.id}`}
                      type="button"
                      className="cal-item cal-gitem"
                      style={{ borderLeftColor: c?.color }}
                      draggable={Boolean(c?.writable)}
                      title={`${ge.summary}${c ? ` · ${c.summary}` : ''}`}
                      onClick={() => setDialog({ ev: ge })}
                      onDragStart={(e) => e.dataTransfer.setData('text/thalamus-gevent', `${ge.calId}|${ge.id}`)}
                    >
                      {ge.time && ge.date === k && <b>{ge.time} </b>}{ge.summary}
                    </button>
                  );
                })}
                {items.slice(0, room).map((it) => (
                  <a
                    key={`${it.note.id}.${it.key}`}
                    href={`#/n/${it.note.id}`}
                    onClick={peekClick(it.note.id)}
                    onDoubleClick={() => openPeek(it.note.id)}
                    className="cal-item"
                    draggable
                    title={`${displayTitle(it.note)}${it.label ? ` · ${it.label}` : ''}`}
                    onDragStart={(e) => e.dataTransfer.setData('text/thalamus-date', [it.note.id, it.key, it.endKey ?? ''].join('|'))}
                  >
                    {noteIcon(it.note)} {it.note.type === 'event' && parseTime(it.note.props.time) && <b>{parseTime(it.note.props.time)} </b>}
                    {it.label && <span className="muted">{it.label}: </span>}{displayTitle(it.note)}
                  </a>
                ))}
                {items.length + gitems.length > 5 && <div className="muted small">+{items.length + gitems.length - Math.min(5, gitems.length) - Math.min(room, items.length)} daha</div>}
              </div>
            );
          })}
        </div>
      </div>
      {dialog && <ExtEventDialog ev={dialog.ev} day={dialog.day} cals={cals} onClose={() => setDialog(null)} onChanged={() => void loadExt()} />}
    </div>
  );
}
