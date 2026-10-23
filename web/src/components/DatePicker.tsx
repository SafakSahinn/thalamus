import { localeTag, t, weekdays } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { parseDay } from '../lib/format';
import { todayStr } from '../lib/store';


const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Açılır ay takvimi (tarayıcının kendi tarih seçicisi yerine). marks: noktayla işaretlenecek günler (0–1 doluluk) */
export default function DatePicker({ value, onChange, marks, label = t('pages.datePicker.pick') }: {
  value: string;
  onChange: (day: string) => void;
  marks?: Map<string, number>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = parseDay(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const d = parseDay(value);
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open, value]);

  const offset = (cursor.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset + i));
  const today = todayStr();
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <div className="dp" ref={box}>
      <button type="button" className="dp-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        📅 {label}
      </button>
      {open && (
        <div className="dp-pop" role="dialog" aria-label={t('pages.datePicker.pick')}>
          <div className="dp-head">
            <button type="button" className="cal-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label={t('pages.datePicker.prevMonth')}>‹</button>
            <b>{cursor.toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' })}</b>
            <button type="button" className="cal-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label={t('pages.datePicker.nextMonth')}>›</button>
          </div>
          <div className="dp-grid">
            {weekdays('short').map((w) => <span key={w} className="dp-wd">{w}</span>)}
            {days.map((d) => {
              const k = ymd(d);
              const m = marks?.get(k);
              return (
                <button
                  key={k}
                  type="button"
                  className={`dp-day ${d.getMonth() !== cursor.getMonth() ? 'other' : ''} ${k === today ? 'today' : ''} ${k === value ? 'sel' : ''}`}
                  onClick={() => pick(k)}
                >
                  {d.getDate()}
                  {m !== undefined && <span className="dp-dot" style={{ opacity: 0.35 + 0.65 * m }} />}
                </button>
              );
            })}
          </div>
          <div className="dp-foot">
            <button type="button" className="btn small" onClick={() => pick(today)}>{t('pages.datePicker.today')}</button>
            {marks && <span className="muted small"><span className="dp-dot inline" /> {t('pages.datePicker.written')}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
