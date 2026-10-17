import { useMemo, useState } from 'react';
import { openPeek, peekClick } from '../components/Peek';
import { addDays, displayTitle, noteIcon, parseDay } from '../lib/format';
import { calSettings } from '../lib/gcal';
import { setProp, todayStr, useStore } from '../lib/store';
import { isTemplate } from '../lib/templates';
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
    return map;
  }, [notes, hidden, settings]);

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

  const toggleType = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      /* yok say */
    }
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
        Bütün notlarındaki tarihler: son başvurular, konferanslar, teslimler, deneyler… Bir öğeyi başka güne sürükleyerek tarihini değiştirebilirsin.
        {' '}Google Takvim eşitlemesi {gcalOn ? <b>açık</b> : <>kapalı · <a href="#/settings">Ayarlar’dan bağla</a></>}.
      </p>
      <div className="chips cal-types">
        {types.map((t) => (
          <button key={t.id} type="button" className={`cal-type ${hidden.includes(t.id) ? '' : 'on'}`} onClick={() => toggleType(t.id)} aria-pressed={!hidden.includes(t.id)}>
            {t.icon} {t.plural}
          </button>
        ))}
      </div>
      <div className="calendar">
        <div className="cal-head">
          <button type="button" className="iconbtn" onClick={() => move(-1)} aria-label="Önceki ay">‹</button>
          <b className="cal-month">{MONTH.format(cursor)}</b>
          <button type="button" className="iconbtn" onClick={() => move(1)} aria-label="Sonraki ay">›</button>
          <button type="button" className="btn small" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Bugün</button>
        </div>
        <div className="cal-grid">
          {WEEK.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          {days.map((d) => {
            const k = ymd(d);
            const items = byDay.get(k) ?? [];
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
                }}
              >
                <div className="cal-num">{parseDay(k).getDate()}</div>
                {items.slice(0, 5).map((it) => (
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
                    {noteIcon(it.note)} {it.label && <span className="muted">{it.label}: </span>}{displayTitle(it.note)}
                  </a>
                ))}
                {items.length > 5 && <div className="muted small">+{items.length - 5} daha</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
