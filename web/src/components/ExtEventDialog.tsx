import { useState } from 'react';
import { openPeek } from './Peek';
import { createEvent, deleteEvent, plainDescription, updateEvent, type ExtCal, type ExtEvent } from '../lib/gcalFull';
import { createNote } from '../lib/store';

/** Google takvim etkinliğini gör / düzenle / sil, ya da yeni etkinlik ekle */
export default function ExtEventDialog({ ev, day, cals, onClose, onChanged }: {
  /** Varolan etkinlik; yoksa yeni etkinlik */
  ev?: ExtEvent;
  /** Yeni etkinliğin günü */
  day?: string;
  cals: ExtCal[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const writableCals = cals.filter((c) => c.writable);
  const cal = ev ? cals.find((c) => c.id === ev.calId) : undefined;
  const editable = ev ? Boolean(cal?.writable) : true;
  const [summary, setSummary] = useState(ev?.summary ?? '');
  const [date, setDate] = useState(ev?.date ?? day ?? '');
  const [time, setTime] = useState(ev?.time ?? '');
  const [endTime, setEndTime] = useState(ev?.endTime ?? '');
  const [location, setLocation] = useState(ev?.location ?? '');
  const [calId, setCalId] = useState(ev?.calId ?? writableCals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState('');
  const desc = plainDescription(ev?.description);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  const input = { summary: summary.trim() || '(başlıksız)', date, time: time || undefined, endTime: endTime || undefined, location: location.trim() || undefined };
  const save = () => run(() => (ev ? updateEvent(ev, input) : createEvent(calId, input)));

  const toNote = () => {
    const n = createNote('event', input.summary, { date, ...(time ? { time } : {}), ...(endTime ? { endTime } : {}), ...(input.location ? { location: input.location } : {}) });
    onClose();
    openPeek(n.id);
  };

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal ext-event" role="dialog" aria-label={ev ? 'Takvim etkinliği' : 'Yeni takvim etkinliği'}>
        <div className="ext-event-head">
          {cal && <span className="ext-dot" style={{ background: cal.color }} />}
          <span className="muted small">{ev ? cal?.summary ?? 'Google Takvim' : 'Yeni Google Takvim etkinliği'}{ev?.recurring ? ' · tekrar eden etkinliğin bu günü' : ''}</span>
        </div>
        <input className="ext-title" value={summary} placeholder="Başlık" autoFocus={!ev} disabled={!editable} onChange={(e) => setSummary(e.target.value)} />
        <div className="ext-row">
          <label className="small">Gün <input type="date" value={date} disabled={!editable} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="small">Saat <input type="time" value={time} disabled={!editable} onChange={(e) => setTime(e.target.value)} /></label>
          {time && <label className="small">Bitiş <input type="time" value={endTime} disabled={!editable} onChange={(e) => setEndTime(e.target.value)} /></label>}
        </div>
        {!time && <p className="muted small">Saat boşsa tüm gün etkinliği olur.</p>}
        <label className="small ext-loc">Yer <input value={location} disabled={!editable} onChange={(e) => setLocation(e.target.value)} placeholder="—" /></label>
        {!ev && writableCals.length > 1 && (
          <label className="small ext-loc">Takvim{' '}
            <select value={calId} onChange={(e) => setCalId(e.target.value)}>
              {writableCals.map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}
            </select>
          </label>
        )}
        {desc && <div className="ext-desc">{desc}</div>}
        {!editable && <p className="muted small">Bu takvim salt okunur; yalnızca görüntüleyebilirsin.</p>}
        {err && <p className="err small">{err}</p>}
        <div className="row ext-actions">
          {ev?.htmlLink && <a className="btn ghost small" href={ev.htmlLink} target="_blank" rel="noopener noreferrer">Google’da aç ↗</a>}
          {ev && <button type="button" className="btn ghost small" onClick={toNote} title="Bu etkinliğin bir kopyasını Etkinlikler koleksiyonuna ekle">📝 Not olarak kopyala</button>}
          <span className="spacer" />
          {ev && editable && (
            <button type="button" className="btn ghost small danger" disabled={busy} onClick={() => (sure ? void run(() => deleteEvent(ev)) : setSure(true))}>
              {sure ? 'Emin misin? Sil' : 'Sil'}
            </button>
          )}
          <button type="button" className="btn ghost small" onClick={onClose}>{editable ? 'Vazgeç' : 'Kapat'}</button>
          {editable && <button type="button" className="btn primary small" disabled={busy || !date || (!ev && !calId)} onClick={() => void save()}>{busy ? 'Kaydediliyor…' : ev ? 'Kaydet' : 'Ekle'}</button>}
        </div>
      </div>
    </div>
  );
}
