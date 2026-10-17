import { useMemo, useState } from 'react';
import { displayTitle, noteIcon, parseDay, relTime } from '../../lib/format';
import { go } from '../../lib/router';
import { deleteNote, duplicateNote, setProp, todayStr, updateNote, useStore } from '../../lib/store';
import { createDefault } from '../../lib/templates';
import { relationIds, type Note, type PropDef, type SavedView, type TypeDef } from '../../lib/types';
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

interface Nest {
  /** Üst öğe alanının anahtarı */
  key: string;
  open: Set<string>;
  toggle: (id: string) => void;
  addChild: (parent: string) => void;
}

function TitleCell({ n, depth = 0, kids = 0, nest }: { n: Note; depth?: number; kids?: number; nest?: Nest }) {
  return (
    <div className="tname-cell" style={depth ? { paddingLeft: depth * 22 } : undefined}>
      {nest && (
        <button type="button" className={`sub-toggle ${kids ? '' : 'empty'} ${nest.open.has(n.id) ? 'open' : ''}`} onClick={() => nest.toggle(n.id)} title={kids ? `${kids} alt öğe` : 'Alt öğe yok'} aria-label="Alt öğeleri aç/kapat">▸</button>
      )}
      <span className="ticon">{noteIcon(n)}</span>
      <input
        key={n.id}
        defaultValue={n.title}
        placeholder="Adsız"
        onBlur={(e) => e.target.value !== n.title && updateNote(n.id, { title: e.target.value })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {nest && <button type="button" className="open-btn" onClick={() => nest.addChild(n.id)} title="Alt öğe ekle">＋</button>}
      <button type="button" className="open-btn" onClick={() => open(n.id)} title="Yan panelde aç (Ctrl ile tam sayfa)">Aç</button>
    </div>
  );
}

function TableRows({ rows, cols, sel, toggle, nest }: { rows: Note[]; cols: PropDef[]; sel: Set<string>; toggle: (id: string, e: React.MouseEvent | React.ChangeEvent) => void; nest?: Nest }) {
  // Alt öğeler açıksa: bu listedeki üst öğesi de listede olanlar onun altında gösterilir
  const ids = new Set(rows.map((r) => r.id));
  const children = new Map<string, Note[]>();
  const top: Note[] = [];
  for (const r of rows) {
    const parent = nest ? relationIds(r.props[nest.key]).find((x) => ids.has(x) && x !== r.id) : undefined;
    if (parent) children.set(parent, [...(children.get(parent) ?? []), r]);
    else top.push(r);
  }
  const row = (n: Note, depth: number, seen: Set<string>): React.ReactNode[] => {
    const kids = children.get(n.id) ?? [];
    const out: React.ReactNode[] = [
      <tr key={n.id} className={`${sel.has(n.id) ? 'row-sel' : ''} ${depth ? 'sub-row' : ''}`}>
        <td className="sel-cell"><input type="checkbox" className="check" checked={sel.has(n.id)} onChange={(e) => toggle(n.id, e)} aria-label="Seç" /></td>
        <td className="tname">{n.type === 'daily' ? <a href={`#/n/${n.id}`}>{displayTitle(n)}</a> : <TitleCell n={n} depth={depth} kids={kids.length} nest={nest} />}</td>
        {cols.map((c) => <td key={c.key}><EditCell note={n} def={c} /></td>)}
        <td className="muted small nowrap">{relTime(n.updated_at)}</td>
      </tr>,
    ];
    if (nest?.open.has(n.id) && !seen.has(n.id)) {
      const next = new Set(seen).add(n.id); // döngüye karşı
      for (const k of kids) out.push(...row(k, depth + 1, next));
    }
    return out;
  };
  return <>{top.flatMap((n) => row(n, 0, new Set()))}</>;
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
  const [openSub, setOpenSub] = useState<Set<string>>(new Set());
  const nest: Nest | undefined = t.subItems
    ? {
        key: t.subItems,
        open: openSub,
        toggle: (id) => setOpenSub((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; }),
        addChild: (parent) => {
          setOpenSub((s) => new Set(s).add(parent));
          openPeek(createDefault(t.id, { ...newProps(), [t.subItems!]: [parent] }).id);
        },
      }
    : undefined;
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
              <TableRows rows={g.notes} cols={cols} sel={sel} toggle={toggle} nest={nest} />
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
                <span className="cal-n">{parseDay(k).getDate()}</span>
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

// ---------- zaman çizelgesi ----------

const SCALES = { gün: 36, hafta: 14, ay: 4 } as const;
type Scale = keyof typeof SCALES;
const dayNum = (s: string) => Math.round(new Date(`${s}T12:00:00`).getTime() / 864e5);
const fromNum = (n: number) => ymd(new Date(n * 864e5));
const MONTH_SHORT = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' });

const TL_SCALE_H = 26;
const TL_ROW_H = 34;

/** Bağımlılık okları: "beklenen" çubuğun sonundan "bekleyen"in başına. Bekleyen, beklediği bitmeden başlıyorsa kırmızı. */
function DependencyArrows({ dated, depKey, min, px, width }: { dated: { n: Note; s: number; e: number }[]; depKey: string; min: number; px: number; width: number }) {
  const row = new Map(dated.map((x, i) => [x.n.id, i]));
  const arrows: { d: string; bad: boolean; key: string }[] = [];
  dated.forEach((b, i) => {
    for (const id of relationIds(b.n.props[depKey])) {
      const j = row.get(id);
      if (j === undefined) continue;
      const a = dated[j];
      const x1 = (a.e + 1 - min) * px;
      const y1 = TL_SCALE_H + j * TL_ROW_H + TL_ROW_H / 2;
      const x2 = (b.s - min) * px;
      const y2 = TL_SCALE_H + i * TL_ROW_H + TL_ROW_H / 2;
      const bend = Math.max(14, Math.abs(x2 - x1) / 2);
      arrows.push({ key: `${id}>${b.n.id}`, bad: b.s <= a.e, d: `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2 - 2},${y2}` });
    }
  });
  if (!arrows.length) return null;
  return (
    <svg className="tl-deps" style={{ left: 220, width, height: TL_SCALE_H + dated.length * TL_ROW_H }} aria-hidden="true">
      <defs>
        <marker id="tl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" /></marker>
        <marker id="tl-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="var(--danger)" /></marker>
      </defs>
      {arrows.map((a) => (
        <path key={a.key} d={a.d} className={a.bad ? 'bad' : ''} markerEnd={`url(#${a.bad ? 'tl-arrow-bad' : 'tl-arrow'})`}>
          {a.bad && <title>Çakışma: beklediği iş bitmeden başlıyor</title>}
        </path>
      ))}
    </svg>
  );
}

export function TimelineView({ t, rows, view, newProps }: ViewProps) {
  const [scale, setScale] = useState<Scale>(() => (localStorage.getItem('tlScale') as Scale) || 'hafta');
  const [drag, setDrag] = useState<{ id: string; mode: 'move' | 'end'; x0: number; s0: number; e0: number; dx: number } | null>(null);
  const sdef = t.props.find((p) => p.key === view.dateKey && p.kind === 'date');
  const edef = t.props.find((p) => p.key === view.endKey && p.kind === 'date');
  if (!sdef) return <p className="muted">Zaman çizelgesi için bir “Tarih” alanı gerekli. Görünüm ayarlarından başlangıç alanını seç.</p>;
  const px = SCALES[scale];
  const today = dayNum(todayStr());
  const items = rows.map((n) => {
    const s = typeof n.props[sdef.key] === 'string' ? dayNum(n.props[sdef.key] as string) : null;
    const eRaw = edef && typeof n.props[edef.key] === 'string' ? dayNum(n.props[edef.key] as string) : null;
    return { n, s, e: s !== null ? Math.max(s, eRaw ?? s) : null };
  });
  const dated = items.filter((x) => x.s !== null) as { n: Note; s: number; e: number }[];
  const undated = items.filter((x) => x.s === null);
  const min = Math.min(today - 14, ...dated.map((x) => x.s)) - 7;
  const max = Math.max(today + 45, ...dated.map((x) => x.e)) + 14;
  const width = (max - min + 1) * px;
  // Ay başları (ölçek çizgisi)
  const marks: { x: number; label: string }[] = [];
  for (let d = min; d <= max; d++) {
    const date = new Date(d * 864e5);
    if (date.getUTCDate() === 1) marks.push({ x: (d - min) * px, label: MONTH_SHORT.format(date) });
  }
  const shift = (x: { s: number; e: number }, id: string) => {
    if (!drag || drag.id !== id) return x;
    const dd = Math.round(drag.dx / px);
    return drag.mode === 'move' ? { s: x.s + dd, e: x.e + dd } : { s: x.s, e: Math.max(x.s, x.e + dd) };
  };
  const startDrag = (e: React.PointerEvent, x: { n: Note; s: number; e: number }, mode: 'move' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: x.n.id, mode, x0: e.clientX, s0: x.s, e0: x.e, dx: 0 });
  };
  const endDrag = () => {
    if (!drag) return;
    const dd = Math.round(drag.dx / px);
    if (dd !== 0) {
      if (drag.mode === 'move') {
        setProp(drag.id, sdef.key, fromNum(drag.s0 + dd));
        if (edef && drag.e0 !== drag.s0) setProp(drag.id, edef.key, fromNum(drag.e0 + dd));
        else if (edef && useStore.getState().notes[drag.id]?.props[edef.key]) setProp(drag.id, edef.key, fromNum(drag.e0 + dd));
      } else if (edef) setProp(drag.id, edef.key, fromNum(Math.max(drag.s0, drag.e0 + dd)));
    } else if (drag.mode === 'move') open(drag.id);
    setDrag(null);
  };
  return (
    <div className="timeline">
      <div className="tl-head">
        <div className="seg">
          {(Object.keys(SCALES) as Scale[]).map((k) => (
            <button key={k} className={scale === k ? 'on' : ''} onClick={() => { setScale(k); localStorage.setItem('tlScale', k); }}>{k[0].toLocaleUpperCase('tr') + k.slice(1)}</button>
          ))}
        </div>
        <span className="muted small">{sdef.label}{edef ? ` → ${edef.label}` : ''} · çubuğu sürükle: tarih kayar{edef ? ', sağ ucu çek: bitiş değişir' : ''}{t.blockedBy ? ' · oklar bağımlılıkları gösterir (kırmızı: çakışma)' : ''}</span>
      </div>
      <div className="tl-scroll" ref={(el) => {
        if (el && !el.dataset.done) {
          el.dataset.done = '1';
          el.scrollLeft = Math.max(0, (today - min - 10) * px);
        }
      }}>
        <div className="tl-grid" style={{ width: width + 220 }}>
          <div className="tl-scale" style={{ marginLeft: 220, width }}>
            {marks.map((m) => <span key={m.x} className="tl-month" style={{ left: m.x }}>{m.label}</span>)}
            <span className="tl-today" style={{ left: (today - min) * px }} title="Bugün" />
          </div>
          {t.blockedBy && <DependencyArrows dated={dated.map((x) => ({ ...x, ...shift(x, x.n.id) }))} depKey={t.blockedBy} min={min} px={px} width={width} />}
          {dated.map((x) => {
            const p = shift(x, x.n.id);
            return (
              <div key={x.n.id} className="tl-row">
                <div className="tl-label" onClick={() => open(x.n.id)}>{noteIcon(x.n)} {displayTitle(x.n)}</div>
                <div className="tl-track" style={{ width }}>
                  <span className="tl-today-line" style={{ left: (today - min) * px }} />
                  <div
                    className={`tl-bar ${drag?.id === x.n.id ? 'dragging' : ''}`}
                    style={{ left: (p.s - min) * px, width: Math.max(px, (p.e - p.s + 1) * px), '--c': t.color } as React.CSSProperties}
                    onPointerDown={(e) => startDrag(e, x, 'move')}
                    onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
                    onPointerUp={endDrag}
                    title={`${displayTitle(x.n)}: ${fromNum(p.s)}${p.e !== p.s ? ` → ${fromNum(p.e)}` : ''}`}
                  >
                    <span className="tl-bar-label">{displayTitle(x.n)}</span>
                    {edef && (
                      <span
                        className="tl-resize"
                        onPointerDown={(e) => startDrag(e, x, 'end')}
                        onPointerMove={(e) => drag && setDrag({ ...drag, dx: e.clientX - drag.x0 })}
                        onPointerUp={endDrag}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {undated.length > 0 && (
        <div className="tl-undated">
          <span className="muted small">Tarihsiz ({undated.length}):</span>
          {undated.map((x) => <button key={x.n.id} type="button" className="chip-soft small" onClick={() => open(x.n.id)}>{noteIcon(x.n)} {displayTitle(x.n)}</button>)}
        </div>
      )}
      <button type="button" className="linkbtn muted small" onClick={() => open(createDefault(t.id, { ...newProps(), [sdef.key]: todayStr() }).id)}>＋ Yeni</button>
    </div>
  );
}
