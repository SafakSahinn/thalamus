import { t } from '../../i18n';
import { chartableX, chartableY, chartConfig } from './ChartView';
import { useEffect, useRef, useState } from 'react';
import { displayTitle } from '../../lib/format';
import { searchNotes } from '../../lib/search';
import { useIndex } from '../../lib/store';
import type { PropDef, SavedView, TypeDef, ViewFilter } from '../../lib/types';
import { opsFor } from '../../lib/views';
import { optionLabel } from '../../lib/types';

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

const SORTABLE = (ty: TypeDef) => [
  { key: 'title', label: t('views.toolbar.name') },
  ...ty.props.filter((p) => !['relation', 'longtext'].includes(p.kind)).map((p) => ({ key: p.key, label: p.label })),
  { key: '__updated', label: t('views.toolbar.updated') },
  { key: '__created', label: t('views.toolbar.created') },
];

function RelationValue({ def, value, onChange }: { def: PropDef; value: unknown; onChange: (v: string) => void }) {
  const { alive } = useIndex();
  const options = searchNotes(alive, '', { types: def.target, limit: 200 });
  return (
    <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('views.toolbar.pick')}</option>
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
          <option value="">{t('views.toolbar.pick')}</option>
          {def.options?.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
        </select>
      );
    }
    if (def.kind === 'relation') return <RelationValue def={def} value={f.value} onChange={(v) => set({ value: v })} />;
    if (['date', 'created', 'updated'].includes(def.kind)) return <input type="date" value={String(f.value ?? '')} onChange={(e) => set({ value: e.target.value })} />;
    if (['number', 'rating'].includes(def.kind)) return <input type="number" value={String(f.value ?? '')} onChange={(e) => set({ value: e.target.value === '' ? undefined : Number(e.target.value) })} />;
  }
  return <input value={String(f.value ?? '')} placeholder={t('views.toolbar.value')} onChange={(e) => set({ value: e.target.value })} />;
}

export function FilterMenu({ ty, view, update }: { ty: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const fields: (PropDef | 'title')[] = ['title', ...ty.props];
  const defOf = (key: string) => (key === 'title' ? 'title' : ty.props.find((p) => p.key === key)) as PropDef | 'title' | undefined;
  const setAt = (i: number, p: Partial<ViewFilter>) => update({ filters: view.filters.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  return (
    <Popover label={t('views.toolbar.filter')} count={view.filters.length}>
      {view.filters.length === 0 && <p className="muted small">{t('views.toolbar.noFilter')}</p>}
      {view.filters.map((f, i) => {
        const def = defOf(f.key);
        if (!def) return null;
        return (
          <div key={i} className="filter-row">
            {i === 0 && <span className="muted small filter-join">{t('views.toolbar.where')}</span>}
            {i === 1 && (
              <select className="filter-join" value={view.filterMode ?? 'and'} onChange={(e) => update({ filterMode: e.target.value as 'and' | 'or' })} title={t('views.toolbar.joinTitle')}>
                <option value="and">{t('views.toolbar.and')}</option>
                <option value="or">{t('views.toolbar.or')}</option>
              </select>
            )}
            {i > 1 && <span className="muted small filter-join">{view.filterMode === 'or' ? t('views.toolbar.or') : t('views.toolbar.and')}</span>}
            <select value={f.key} onChange={(e) => {
              const d = defOf(e.target.value)!;
              setAt(i, { key: e.target.value, op: opsFor(d)[0].id, value: undefined });
            }}>
              {fields.map((p) => (p === 'title' ? <option key="title" value="title">{t('views.toolbar.name')}</option> : <option key={p.key} value={p.key}>{p.label}</option>))}
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
        const first = ty.props.find((p) => p.kind === 'select') ?? 'title';
        const key = first === 'title' ? 'title' : first.key;
        update({ filters: [...view.filters, { key, op: opsFor(first)[0].id }] });
      }}>{t('views.toolbar.addFilter')}</button>
    </Popover>
  );
}

export function SortMenu({ ty, view, update }: { ty: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const fields = SORTABLE(ty);
  const setAt = (i: number, p: Partial<SavedView['sort'][number]>) => update({ sort: view.sort.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  return (
    <Popover label={t('views.toolbar.sort')} count={view.sort.length}>
      {view.sort.length === 0 && <p className="muted small">{t('views.toolbar.defaultSort')}</p>}
      {view.sort.map((s, i) => (
        <div key={i} className="filter-row">
          <select value={s.key} onChange={(e) => setAt(i, { key: e.target.value })}>
            {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={s.dir} onChange={(e) => setAt(i, { dir: e.target.value as 'asc' | 'desc' })}>
            <option value="asc">{t('views.toolbar.asc')}</option>
            <option value="desc">{t('views.toolbar.desc')}</option>
          </select>
          <button type="button" className="iconbtn" onClick={() => update({ sort: view.sort.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <button type="button" className="linkbtn small" onClick={() => update({ sort: [...view.sort, { key: 'title', dir: 'asc' }] })}>{t('views.toolbar.addSort')}</button>
    </Popover>
  );
}

export function ViewOptions({ ty, view, update }: { ty: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const groupable = ty.props.filter((p) => ['select', 'multiselect', 'checkbox', 'relation'].includes(p.kind));
  const boardable = ty.props.filter((p) => ['select', 'checkbox'].includes(p.kind));
  const dates = ty.props.filter((p) => ['date', 'created', 'updated'].includes(p.kind));
  const hidden = new Set(view.hidden ?? ty.props.filter((p) => !p.table).map((p) => p.key));
  const toggle = (key: string) => {
    const h = new Set(hidden);
    if (h.has(key)) h.delete(key);
    else h.add(key);
    update({ hidden: [...h] });
  };
  return (
    <Popover label={t('views.toolbar.options')}>
      {view.kind === 'board' && (
        <>
          <label className="opt-line">{t('views.toolbar.columnsBy')}
            <select value={view.groupBy ?? ''} onChange={(e) => update({ groupBy: e.target.value })}>
              <option value="">{t('views.toolbar.pick')}</option>
              {boardable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="opt-line">{t('views.toolbar.rows')}
            <select value={view.subGroupBy ?? ''} onChange={(e) => update({ subGroupBy: e.target.value || undefined })}>
              <option value="">{t('views.toolbar.none')}</option>
              {boardable.filter((p) => p.key !== view.groupBy).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        </>
      )}
      {view.kind === 'timeline' && (
        <>
          <label className="opt-line">{t('views.toolbar.start')}
            <select value={view.dateKey ?? ''} onChange={(e) => update({ dateKey: e.target.value })}>
              <option value="">{t('views.toolbar.pick')}</option>
              {dates.filter((p) => p.kind === 'date').map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label className="opt-line">{t('views.toolbar.end')}
            <select value={view.endKey ?? ''} onChange={(e) => update({ endKey: e.target.value || undefined })}>
              <option value="">{t('views.toolbar.singleDay')}</option>
              {dates.filter((p) => p.kind === 'date' && p.key !== view.dateKey).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        </>
      )}
      {view.kind === 'chart' && <ChartOptions ty={ty} view={view} update={update} />}
      {view.kind === 'calendar' && (
        <label className="opt-line">{t('views.toolbar.dateField')}
          <select value={view.dateKey ?? ''} onChange={(e) => update({ dateKey: e.target.value })}>
            <option value="">{t('views.toolbar.pick')}</option>
            {dates.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view.kind === 'table' && (
        <label className="opt-line">{t('views.toolbar.groupBy')}
          <select value={view.groupBy ?? ''} onChange={(e) => update({ groupBy: e.target.value || undefined })}>
            <option value="">{t('views.toolbar.noGroup')}</option>
            {groupable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view.kind !== 'calendar' && view.kind !== 'chart' && (
        <>
          <div className="bm-h">{view.kind === 'form' ? t('views.toolbar.formFields') : t('views.toolbar.shownFields')}</div>
          <div className="col-toggles">
            {ty.props.map((p) => (
              <label key={p.key}><input type="checkbox" checked={!hidden.has(p.key)} onChange={() => toggle(p.key)} /> {p.label}</label>
            ))}
          </div>
        </>
      )}
    </Popover>
  );
}

/** Grafik görünümü ayarları: tür, gruplama alanı, tarih aralığı, ölçü */
function ChartOptions({ ty, view, update }: { ty: TypeDef; view: SavedView; update: (p: Partial<SavedView>) => void }) {
  const c = chartConfig(ty, view);
  const set = (p: Partial<NonNullable<SavedView['chart']>>) => update({ chart: { ...c, ...p } });
  const xdef = ty.props.find((p) => p.key === c.x);
  const ys = chartableY(ty);
  return (
    <>
      <label className="opt-line">{t('views.toolbar.chart')}
        <select value={c.type} onChange={(e) => set({ type: e.target.value as 'bar' | 'hbar' | 'line' })}>
          <option value="bar">{t('views.toolbar.bar')}</option>
          <option value="hbar">{t('views.toolbar.hbar')}</option>
          <option value="line">{t('views.toolbar.line')}</option>
        </select>
      </label>
      <label className="opt-line">{t('views.toolbar.grouping')}
        <select value={c.x ?? ''} onChange={(e) => set({ x: e.target.value })}>
          {chartableX(ty).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      {xdef && ['date', 'created', 'updated'].includes(xdef.kind) && (
        <label className="opt-line">{t('views.toolbar.interval')}
          <select value={c.bucket} onChange={(e) => set({ bucket: e.target.value as 'week' | 'month' | 'year' })}>
            <option value="week">{t('views.toolbar.week')}</option>
            <option value="month">{t('views.toolbar.month')}</option>
            <option value="year">{t('views.toolbar.year')}</option>
          </select>
        </label>
      )}
      <label className="opt-line">{t('views.toolbar.measure')}
        <select value={c.fn === 'count' ? 'count' : `${c.fn}:${c.y ?? ''}`} onChange={(e) => {
          const [fn, y] = e.target.value.split(':');
          set({ fn: fn as 'count' | 'sum' | 'avg', y: y || undefined });
        }}>
          <option value="count">{t('views.toolbar.count')}</option>
          {ys.flatMap((p) => [
            <option key={`sum${p.key}`} value={`sum:${p.key}`}>{t('views.toolbar.sum', { label: p.label })}</option>,
            <option key={`avg${p.key}`} value={`avg:${p.key}`}>{t('views.toolbar.avg', { label: p.label })}</option>,
          ])}
        </select>
      </label>
    </>
  );
}
