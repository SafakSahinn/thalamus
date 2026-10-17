import { chartableX, chartableY, chartConfig } from './ChartView';
import { useEffect, useRef, useState } from 'react';
import { displayTitle } from '../../lib/format';
import { searchNotes } from '../../lib/search';
import { useIndex } from '../../lib/store';
import type { PropDef, SavedView, TypeDef, ViewFilter } from '../../lib/types';
import { opsFor } from '../../lib/views';

function Popover({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={`btn small ${count ? 'active-filter' : 'ghost'}`} onClick={() => setOpen(!open)}>
        {label}{count ? ` · ${count}` : ''}
      </button>
      {open && <div className="tb-pop">{children}</div>}
    </div>
  );
}

const SORTABLE = (t: TypeDef) => [
  { key: 'title', label: 'Ad' },
  ...t.props.filter((p) => !['relation', 'longtext'].includes(p.kind)).map((p) => ({ key: p.key, label: p.label })),
  { key: '__updated', label: 'Son düzenlenme' },
  { key: '__created', label: 'Oluşturulma' },
];

function RelationValue({ def, value, onChange }: { def: PropDef; value: unknown; onChange: (v: string) => void }) {
  const { alive } = useIndex();
  const options = searchNotes(alive, '', { types: def.target, limit: 200 });
  return (
    <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
      <option value="">seç…</option>
      {options.map((n) => <option key={n.id} value={n.id}>{displayTitle(n)}</option>)}
    </select>
  );
}

function ValueInput({ def, f, set }: { def: PropDef | 'title'; f: ViewFilter; set: (p: Partial<ViewFilter>) => void }) {
  const op = opsFor(def).find((o) => o.id === f.op);
  if (op?.noValue) return null;
  if (def !== 'title') {
    if (def.kind === 'select' || def.kind === 'multiselect') {
      return (
        <select value={String(f.value ?? '')} onChange={(e) => set({ value: e.target.value })}>
          <option value="">seç…</option>
          {def.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    }
    if (def.kind === 'relation') return <RelationValue def={def} value={f.value} onChange={(v) => set({ value: v })} />;
    if (['date', 'created', 'updated'].includes(def.kind)) return <input type="date" value={String(f.value ?? '')} onChange={(e) => set({ value: e.target.value })} />;
    if (['number', 'rating'].includes(def.kind)) return <input type="number" value={String(f.value ?? '')} onChange={(e) => set({ value: e.target.value === '' ? undefined : Number(e.target.value) })} />;
  }
  return <input value={String(f.value ?? '')} placeholder="değer" onChange={(e) => set({ value: e.target.value })} />;
}

export function FilterMenu({ t, view, update }: { t: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const fields: (PropDef | 'title')[] = ['title', ...t.props];
  const defOf = (key: string) => (key === 'title' ? 'title' : t.props.find((p) => p.key === key)) as PropDef | 'title' | undefined;
  const setAt = (i: number, p: Partial<ViewFilter>) => update({ filters: view.filters.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  return (
    <Popover label="Filtre" count={view.filters.length}>
      {view.filters.length === 0 && <p className="muted small">Henüz filtre yok.</p>}
      {view.filters.map((f, i) => {
        const def = defOf(f.key);
        if (!def) return null;
        return (
          <div key={i} className="filter-row">
            {i === 0 && <span className="muted small filter-join">Koşul</span>}
            {i === 1 && (
              <select className="filter-join" value={view.filterMode ?? 'and'} onChange={(e) => update({ filterMode: e.target.value as 'and' | 'or' })} title="Koşullar nasıl birleşsin">
                <option value="and">ve</option>
                <option value="or">veya</option>
              </select>
            )}
            {i > 1 && <span className="muted small filter-join">{view.filterMode === 'or' ? 'veya' : 've'}</span>}
            <select value={f.key} onChange={(e) => {
              const d = defOf(e.target.value)!;
              setAt(i, { key: e.target.value, op: opsFor(d)[0].id, value: undefined });
            }}>
              {fields.map((p) => (p === 'title' ? <option key="title" value="title">Ad</option> : <option key={p.key} value={p.key}>{p.label}</option>))}
            </select>
            <select value={f.op} onChange={(e) => setAt(i, { op: e.target.value })}>
              {opsFor(def).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <ValueInput def={def} f={f} set={(p) => setAt(i, p)} />
            <button type="button" className="iconbtn" onClick={() => update({ filters: view.filters.filter((_, j) => j !== i) })}>×</button>
          </div>
        );
      })}
      <button type="button" className="linkbtn small" onClick={() => {
        const first = t.props.find((p) => p.kind === 'select') ?? 'title';
        const key = first === 'title' ? 'title' : first.key;
        update({ filters: [...view.filters, { key, op: opsFor(first)[0].id }] });
      }}>＋ Filtre ekle</button>
    </Popover>
  );
}

export function SortMenu({ t, view, update }: { t: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const fields = SORTABLE(t);
  const setAt = (i: number, p: Partial<SavedView['sort'][number]>) => update({ sort: view.sort.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  return (
    <Popover label="Sırala" count={view.sort.length}>
      {view.sort.length === 0 && <p className="muted small">Varsayılan: son düzenlenen üstte.</p>}
      {view.sort.map((s, i) => (
        <div key={i} className="filter-row">
          <select value={s.key} onChange={(e) => setAt(i, { key: e.target.value })}>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={s.dir} onChange={(e) => setAt(i, { dir: e.target.value as 'asc' | 'desc' })}>
            <option value="asc">Artan (A→Z, eski→yeni)</option>
            <option value="desc">Azalan (Z→A, yeni→eski)</option>
          </select>
          <button type="button" className="iconbtn" onClick={() => update({ sort: view.sort.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button type="button" className="linkbtn small" onClick={() => update({ sort: [...view.sort, { key: 'title', dir: 'asc' }] })}>＋ Sıralama ekle</button>
    </Popover>
  );
}

export function ViewOptions({ t, view, update }: { t: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const groupable = t.props.filter((p) => ['select', 'multiselect', 'checkbox', 'relation'].includes(p.kind));
  const boardable = t.props.filter((p) => ['select', 'checkbox'].includes(p.kind));
  const dates = t.props.filter((p) => ['date', 'created', 'updated'].includes(p.kind));
  const hidden = new Set(view.hidden ?? t.props.filter((p) => !p.table).map((p) => p.key));
  const toggle = (key: string) => {
    const h = new Set(hidden);
    if (h.has(key)) h.delete(key);
    else h.add(key);
    update({ hidden: [...h] });
  };
  return (
    <Popover label="Görünüm ayarları">
      {view.kind === 'board' && (
        <label className="opt-line">Sütunlar şu alana göre:
          <select value={view.groupBy ?? ''} onChange={(e) => update({ groupBy: e.target.value })}>
            <option value="">seç…</option>
            {boardable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view.kind === 'timeline' && (
        <>
          <label className="opt-line">Başlangıç:
            <select value={view.dateKey ?? ''} onChange={(e) => update({ dateKey: e.target.value })}>
              <option value="">seç…</option>
              {dates.filter((p) => p.kind === 'date').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="opt-line">Bitiş:
            <select value={view.endKey ?? ''} onChange={(e) => update({ endKey: e.target.value || undefined })}>
              <option value="">yok (tek gün)</option>
              {dates.filter((p) => p.kind === 'date' && p.key !== view.dateKey).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        </>
      )}
      {view.kind === 'chart' && <ChartOptions t={t} view={view} update={update} />}
      {view.kind === 'calendar' && (
        <label className="opt-line">Tarih alanı:
          <select value={view.dateKey ?? ''} onChange={(e) => update({ dateKey: e.target.value })}>
            <option value="">seç…</option>
            {dates.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view.kind === 'table' && (
        <label className="opt-line">Grupla:
          <select value={view.groupBy ?? ''} onChange={(e) => update({ groupBy: e.target.value || undefined })}>
            <option value="">Gruplama yok</option>
            {groupable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view.kind !== 'calendar' && view.kind !== 'chart' && (
        <>
          <div className="bm-h">{view.kind === 'form' ? 'Formda sorulacak alanlar' : 'Gösterilen alanlar'}</div>
          <div className="col-toggles">
            {t.props.map((p) => (
              <label key={p.key}><input type="checkbox" checked={!hidden.has(p.key)} onChange={() => toggle(p.key)} /> {p.label}</label>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}

/** Grafik görünümü ayarları: tür, gruplama alanı, tarih aralığı, ölçü */
function ChartOptions({ t, view, update }: { t: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const c = chartConfig(t, view);
  const set = (p: Partial<NonNullable<SavedView['chart']>>) => update({ chart: { ...c, ...p } });
  const xdef = t.props.find((p) => p.key === c.x);
  const ys = chartableY(t);
  return (
    <>
      <label className="opt-line">Grafik:
        <select value={c.type} onChange={(e) => set({ type: e.target.value as 'bar' | 'hbar' | 'line' })}>
          <option value="bar">Sütun</option>
          <option value="hbar">Yatay çubuk</option>
          <option value="line">Çizgi</option>
        </select>
      </label>
      <label className="opt-line">Gruplama:
        <select value={c.x ?? ''} onChange={(e) => set({ x: e.target.value })}>
          {chartableX(t).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      {xdef && ['date', 'created', 'updated'].includes(xdef.kind) && (
        <label className="opt-line">Aralık:
          <select value={c.bucket} onChange={(e) => set({ bucket: e.target.value as 'week' | 'month' | 'year' })}>
            <option value="week">Haftalık</option>
            <option value="month">Aylık</option>
            <option value="year">Yıllık</option>
          </select>
        </label>
      )}
      <label className="opt-line">Ölçü:
        <select value={c.fn === 'count' ? 'count' : `${c.fn}:${c.y ?? ''}`} onChange={(e) => {
          const [fn, y] = e.target.value.split(':');
          set({ fn: fn as 'count' | 'sum' | 'avg', y: y || undefined });
        }}>
          <option value="count">Kayıt sayısı</option>
          {ys.flatMap((p) => [
            <option key={`sum${p.key}`} value={`sum:${p.key}`}>{p.label} · toplam</option>,
            <option key={`avg${p.key}`} value={`avg:${p.key}`}>{p.label} · ortalama</option>,
          ])}
        </select>
      </label>
    </>
  );
}
