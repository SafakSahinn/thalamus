import { useMemo, useState } from 'react';
import { displayTitle, noteIcon, parseDay, relTime } from '../../lib/format';
import { go } from '../../lib/router';
import { deleteNote, duplicateNote, setProp, todayStr, updateNote, useStore } from '../../lib/store';
import { createDefault } from '../../lib/templates';
import type { Note, PropDef, SavedView, TypeDef } from '../../lib/types';
import { groupNotes, type Group } from '../../lib/views';
import { openPeek, peekClick } from '../../components/Peek';
import { Cell, Cover, EditCell } from './Cells';

export interface ViewProps {
  t: TypeDef;
  rows: Note[];
  view: SavedView;
  /** Yeni not oluştururken varsayılan alanlar (aktif filtrelerden) */
  newProps: () => Record<string, unknown>;
}

/** Koleksiyondan açılan notlar yan panelde açılır */
const open = (id: string) => openPeek(id);
void go;

// ---------- tablo ----------

function TitleCell({ n }: { n: Note }) {
  return (
    <div className="tname-cell">
      <span className="ticon">{noteIcon(n)}</span>
      <input
        key={n.id}
        defaultValue={n.title}
        placeholder="Adsız"
        onBlur={(e) => e.target.value !== n.title && updateNote(n.id, { title: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" className="open-btn" onClick={() => open(n.id)} title="Yan panelde aç (Ctrl ile tam sayfa)">Aç</button>
    </div>
  );
}

function TableRows({ rows, cols, sel, toggle }: { rows: Note[]; cols: PropDef[]; sel: Set<string>; toggle: (id: string, e: React.MouseEvent | React.ChangeEvent) => void }) {
  return (
    <>
      {rows.map((n) => (
        <tr key={n.id} className={sel.has(n.id) ? 'row-sel' : ''}>
          <td className="sel-cell"><input type="checkbox" className="check" checked={sel.has(n.id)} onChange={(e) => toggle(n.id, e)} aria-label="Seç" /></td>
          <td className="tname">{n.type === 'daily' ? <a href={`#/n/${n.id}`}>{displayTitle(n)}</a> : <TitleCell n={n} />}</td>
          {cols.map((c) => <td key={c.key}><EditCell note={n} def={c} /></td>)}
          <td className="muted small nowrap">{relTime(n.updated_at)}</td>
        </tr>
      ))}
    </>
  );
}

/** Seçili satırlara toplu işlem */
function BulkBar({ t, ids, clear }: { t: TypeDef; ids: string[]; clear: () => void }) {
  const editable = t.props.filter((p) => ['select', 'checkbox', 'date', 'rating', 'multiselect'].includes(p.kind));
  const [key, setKey] = useState(editable[0]?.key ?? '');
  const def = editable.find((p) => p.key === key);
  const apply = (value: unknown) => {
    if (!def) return;
    for (const id of ids) {
      if (def.kind === 'multiselect') {
        const cur = useStore.getState().notes[id]?.props[def.key];
        const arr = Array.isArray(cur) ? (cur as string[]) : [];
        if (value && !arr.includes(String(value))) setProp(id, def.key, [...arr, String(value)]);
      } else setProp(id, def.key, value);
    }
  };
  return (
    <div className="bulk-bar">
      <b>{ids.length} seçili</b>
      {editable.length > 0 && (
        <>
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            {editable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {def && (def.kind === 'select' || def.kind === 'multiselect') && (
            <select value="" onChange={(e) => e.target.value && apply(e.target.value === '__none' ? undefined : e.target.value)}>
              <option value="">{def.kind === 'multiselect' ? 'ekle…' : 'değer seç…'}</option>
              {def.kind === 'select' && <option value="__none">— boşalt</option>}
              {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {def?.kind === 'checkbox' && (
            <>
              <button type="button" className="btn small" onClick={() => apply(true)}>✓ İşaretle</button>
              <button type="button" className="btn small" onClick={() => apply(undefined)}>İşareti kaldır</button>
            </>
          )}
          {def?.kind === 'date' && <input type="date" onChange={(e) => apply(e.target.value || undefined)} />}
          {def?.kind === 'rating' && (
            <select value="" onChange={(e) => e.target.value && apply(Number(e.target.value) || undefined)}>
              <option value="">puan…</option>
              {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{'★'.repeat(r)}</option>)}
              <option value="0">— boşalt</option>
            </select>
          )}
        </>
      )}
      <span className="spacer" />
      <button type="button" className="btn small" onClick={() => { ids.forEach((id) => duplicateNote(id)); clear(); }}>⧉ Çoğalt</button>
      <button type="button" className="btn small danger" onClick={() => { ids.forEach((id) => deleteNote(id)); clear(); }}>🗑 Çöpe taşı</button>
      <button type="button" className="iconbtn" title="Seçimi temizle" onClick={clear}>×</button>
    </div>
  );
}

export function TableView({ t, rows, view, newProps }: ViewProps) {
  const notes = useStore((s) => s.notes);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const hidden = new Set(view.hidden ?? t.props.filter((p) => !p.table).map((p) => p.key));
  const cols = t.props.filter((p) => !hidden.has(p.key));
  const gdef = view.groupBy ? t.props.find((p) => p.key === view.groupBy) : undefined;
  const groups: Group[] = gdef ? groupNotes(rows, gdef, notes) : [{ key: '*', label: '', notes: rows }];
  const visible = new Set(rows.map((r) => r.id));
  const selected = [...sel].filter((id) => visible.has(id));
  const order = groups.flatMap((g) => g.notes.map((n) => n.id));
  // Shift ile tıklayınca aralığı seç
  const toggle = (id: string, e: React.MouseEvent | React.ChangeEvent) => {
    const next = new Set(sel);
    const shift = (e.nativeEvent as MouseEvent).shiftKey;
    if (shift && anchor) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(id)].sort((x, y) => x - y);
      order.slice(a, b + 1).forEach((x) => next.add(x));
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    setAnchor(id);
    setSel(next);
  };
  const allOn = selected.length > 0 && selected.length === rows.length;
  const add = (g?: Group) => {
    const props = newProps();
    if (gdef && g && g.key) props[gdef.key] = gdef.kind === 'multiselect' || gdef.kind === 'relation' ? [g.key] : gdef.kind === 'checkbox' ? g.key === 'true' : g.key;
    openPeek(createDefault(t.id, props).id);
  };
  return (
    <>
      {selected.length > 0 && <BulkBar t={t} ids={selected} clear={() => setSel(new Set())} />}
      <div className="tablewrap">
        <table className="dbtable editable">
          <thead>
            <tr>
              <th className="sel-cell"><input type="checkbox" className="check" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Tümünü seç" /></th>
              <th>Ad</th>
              {cols.map((c) => <th key={c.key}>{c.label}</th>)}
              <th>Düzenlendi</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.key}>
              {gdef && (
                <tr className="group-row"><td colSpan={cols.length + 3}><b>{g.label}</b> <span className="muted small">{g.notes.length}</span></td></tr>
              )}
              <TableRows rows={g.notes} cols={cols} sel={sel} toggle={toggle} />
              <tr className="add-row"><td colSpan={cols.length + 3}><button type="button" className="linkbtn muted small" onClick={() => add(g)}>＋ Yeni</button></td></tr>
            </tbody>
          ))}
        </table>
      </div>
    </>
  );
}

// ---------- galeri ----------

export function CardsView({ t, rows, view }: ViewProps) {
  const hidden = new Set(view.hidden ?? t.props.filter((p) => !p.table).map((p) => p.key));
  const cols = t.props.filter((p) => !hidden.has(p.key) && p.key !== t.cover).slice(0, 4);
  return (
    <div className="cards">
      {rows.map((n) => (
        <a key={n.id} className="card" href={`#/n/${n.id}`} onClick={peekClick(n.id)}>
          {t.cover && <Cover src={n.props[t.cover] as string | undefined} icon={noteIcon(n)} />}
          <div className="card-body">
            <div className="card-title">{!t.cover && <span>{noteIcon(n)} </span>}{displayTitle(n)}</div>
            {cols.map((c) => (n.props[c.key] !== undefined || ['formula', 'rollup'].includes(c.kind) ? <div key={c.key} className="card-prop"><Cell note={n} def={c} /></div> : null))}
            {!t.cover && n.text && <div className="card-snip">{n.text.slice(0, 140)}</div>}
          </div>
        </a>
      ))}
    </div>
  );
}

// ---------- liste ----------

export function ListView({ t, rows, view }: ViewProps) {
  const hidden = new Set(view.hidden ?? t.props.filter((p) => !p.table).map((p) => p.key));
  const cols = t.props.filter((p) => !hidden.has(p.key)).slice(0, 4);
  return (
    <div className="list dblist">
      {rows.map((n) => (
        <a key={n.id} className="rowlink" href={`#/n/${n.id}`} onClick={peekClick(n.id)}>
          <span>{noteIcon(n)}</span>
          <span className="grow">{displayTitle(n)}</span>
          {cols.map((c) => <span key={c.key} className="list-prop"><Cell note={n} def={c} /></span>)}
        </a>
      ))}
    </div>
  );
}

// ---------- pano (kanban) ----------

export function BoardView({ t, rows, view, newProps }: ViewProps) {
  const notes = useStore((s) => s.notes);
  const [over, setOver] = useState<string | null>(null);
  const gdef = t.props.find((p) => p.key === view.groupBy && (p.kind === 'select' || p.kind === 'checkbox'));
  if (!gdef) return <p className="muted">Pano için bir “Seçim” alanı gerekli. Görünüm ayarlarından gruplama alanını seç ya da ⚙ Alanlar’dan bir seçim alanı ekle.</p>;
  const groups = groupNotes(rows, gdef, notes);
  const hidden = new Set(view.hidden ?? t.props.filter((p) => !p.table).map((p) => p.key));
  const cols = t.props.filter((p) => !hidden.has(p.key) && p.key !== gdef.key && p.key !== t.cover).slice(0, 3);
  const valueFor = (g: Group) => (gdef.kind === 'checkbox' ? g.key === 'true' || undefined : g.key || undefined);
  const drop = (e: React.DragEvent, g: Group) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/thalamus-note');
    if (id) setProp(id, gdef.key, valueFor(g));
  };
  return (
    <div className="board">
      {groups.map((g) => (
        <div
          key={g.key}
          className={`board-col ${over === g.key ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(g.key); }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => drop(e, g)}
        >
          <div className="board-head">{g.label} <span className="muted small">{g.notes.length}</span></div>
          {g.notes.map((n) => (
            <a
              key={n.id}
              href={`#/n/${n.id}`}
              onClick={peekClick(n.id)}
              className="board-card"
              draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/thalamus-note', n.id); e.dataTransfer.effectAllowed = 'move'; }}
            >
              {t.cover && typeof n.props[t.cover] === 'string' && <Cover src={n.props[t.cover] as string} icon={noteIcon(n)} />}
              <div className="board-title">{!t.cover && <span>{noteIcon(n)} </span>}{displayTitle(n)}</div>
              {cols.map((c) => (n.props[c.key] !== undefined ? <div key={c.key} className="card-prop"><Cell note={n} def={c} /></div> : null))}
              {/* Dokunmatik ekranlarda sürükleme yerine */}
              <select className="board-move" value={g.key} onClick={(e) => e.preventDefault()} onChange={(e) => { const to = groups.find((x) => x.key === e.target.value); if (to) setProp(n.id, gdef.key, valueFor(to)); }} aria-label="Taşı">
                {groups.map((x) => <option key={x.key} value={x.key}>→ {x.label}</option>)}
              </select>
            </a>
          ))}
          <button type="button" className="linkbtn muted small board-add" onClick={() => open(createDefault(t.id, { ...newProps(), [gdef.key]: valueFor(g) }).id)}>＋ Yeni</button>
        </div>
      ))}
    </div>
  );
}

// ---------- takvim ----------

const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export function CalendarView({ t, rows, view, newProps }: ViewProps) {
  const notes = useStore((s) => s.notes);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [over, setOver] = useState<string | null>(null);
  const ddef = t.props.find((p) => p.key === view.dateKey && ['date', 'created', 'updated'].includes(p.kind));
  const days = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7; // pazartesi başlangıç
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);
  if (!ddef) return <p className="muted">Takvim için bir “Tarih” alanı gerekli. Görünüm ayarlarından tarih alanını seç ya da ⚙ Alanlar’dan ekle.</p>;
  const byDay = new Map<string, Note[]>();
  for (const n of rows) {
    const raw = ddef.kind === 'date' ? n.props[ddef.key] : ddef.kind === 'created' ? n.created_at : n.updated_at;
    if (typeof raw !== 'string' || !raw) continue;
    const k = raw.length > 10 ? ymd(new Date(raw)) : raw.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), n]);
  }
  void notes;
  const editable = ddef.kind === 'date';
  const today = todayStr();
  const move = (m: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + m, 1));
  return (
    <div className="calendar">
      <div className="cal-head">
        <button type="button" className="iconbtn" onClick={() => move(-1)}>‹</button>
        <b className="cal-month">{MONTH.format(cursor)}</b>
        <button type="button" className="iconbtn" onClick={() => move(1)}>›</button>
        <button type="button" className="btn small" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Bugün</button>
        <span className="muted small">{ddef.label} alanına göre</span>
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
              onDragOver={editable ? (e) => { e.preventDefault(); setOver(k); } : undefined}
              onDragLeave={() => setOver(null)}
              onDrop={editable ? (e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData('text/thalamus-note');
                if (id) setProp(id, ddef.key, k);
              } : undefined}
            >
              <div className="cal-num">
                {parseDay(k).getDate()}
                {editable && <button type="button" className="cal-add" title="Bu güne ekle" onClick={() => open(createDefault(t.id, { ...newProps(), [ddef.key]: k }).id)}>＋</button>}
              </div>
              {items.slice(0, 4).map((n) => (
                <a key={n.id} href={`#/n/${n.id}`} onClick={peekClick(n.id)} className="cal-item" draggable={editable}
                  onDragStart={(e) => e.dataTransfer.setData('text/thalamus-note', n.id)}>
                  {noteIcon(n)} {displayTitle(n)}
                </a>
              ))}
              {items.length > 4 && <div className="muted small">+{items.length - 4} daha</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
