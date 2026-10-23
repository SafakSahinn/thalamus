import { localeTag, t } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import NewButton from '../components/NewButton';
import PaperImportButton from '../components/PaperImportButton';
import { promptText } from '../components/Prompt';
import TypeEditor from '../components/TypeEditor';
import { go } from '../lib/router';
import { saveSettings, useIndex, useStore } from '../lib/store';
import { createDefault } from '../lib/templates';
import { typeOf, type SavedView, type ViewKind } from '../lib/types';
import { applyView, defaultViews, newViewId, VIEW_KINDS } from '../lib/views';
import { FilterMenu, SortMenu, ViewOptions } from './collection/Toolbar';
import { ChartView } from './collection/ChartView';
import { FormView } from './collection/FormView';
import { BoardView, CalendarView, CardsView, ListView, TableView, TimelineView, type ViewProps } from './collection/Views';

export { Cell } from './collection/Cells';

const RENDER: Record<ViewKind, (p: ViewProps) => React.ReactNode> = {
  table: TableView,
  cards: CardsView,
  board: BoardView,
  calendar: CalendarView,
  list: ListView,
  timeline: TimelineView,
  chart: ChartView,
  form: FormView,
};

function useViews(typeId: string) {
  const saved = useStore((s) => s.settings.views?.[typeId]);
  const ty = typeOf(typeId);
  // Kayıtlı görünüm yoksa varsayılanlar (ilk değişiklikte kaydedilir)
  const defaults = useMemo(() => defaultViews(ty), [ty.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const views = saved?.length ? saved : defaults;
  const save = (next: SavedView[]) => {
    const s = useStore.getState().settings;
    void saveSettings({ ...s, views: { ...(s.views ?? {}), [typeId]: next } });
  };
  return { views, save };
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open, close]);
  return ref;
}

function ViewTab({ v, active, onSelect, onRename, onDuplicate, onDelete, canDelete }: {
  v: SavedView; active: boolean; onSelect: () => void; onRename: () => void; onDuplicate: () => void; onDelete: () => void; canDelete: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useOutside(menu, () => setMenu(false));
  const icon = VIEW_KINDS.find((k) => k.id === v.kind)?.icon;
  return (
    <div className={`view-tab ${active ? 'on' : ''}`} ref={ref}>
      <button type="button" onClick={() => (active ? setMenu(!menu) : onSelect())} title={active ? t('collPage.viewMenu') : v.name}>
        {icon} {v.name}{active && <small> ▾</small>}
      </button>
      {menu && (
        <div className="tb-pop view-menu">
          <button type="button" className="bm-row" onClick={() => { setMenu(false); onRename(); }}>{t('collPage.rename')}</button>
          <button type="button" className="bm-row" onClick={() => { setMenu(false); onDuplicate(); }}>{t('collPage.duplicate')}</button>
          {canDelete && <button type="button" className="bm-row danger" onClick={() => { setMenu(false); onDelete(); }}>{t('collPage.delete')}</button>}
        </div>
      )}
    </div>
  );
}

function AddView({ onAdd }: { onAdd: (k: ViewKind) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div className="view-tab add" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} title={t('collPage.addView')}>＋</button>
      {open && (
        <div className="tb-pop view-menu">
          {VIEW_KINDS.map((k) => (
            <button key={k.id} type="button" className="bm-row" onClick={() => { setOpen(false); onAdd(k.id); }}>{k.icon} {k.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollectionPage({ type, edit }: { type: string; edit?: boolean }) {
  const ty = typeOf(type);
  const notes = useStore((s) => s.notes);
  const { alive } = useIndex();
  const [editing, setEditing] = useState(Boolean(edit));
  const { views, save } = useViews(ty.id);
  const pref = `activeView:${ty.id}`;
  const [activeId, setActiveId] = useState(() => localStorage.getItem(pref) ?? '');
  const [q, setQ] = useState('');
  useEffect(() => {
    setActiveId(localStorage.getItem(`activeView:${ty.id}`) ?? '');
    setQ('');
    setEditing(Boolean(edit));
  }, [ty.id, edit]);
  const view = views.find((v) => v.id === activeId) ?? views[0];

  const select = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(pref, id);
    } catch {
      /* gizli sekme */
    }
  };
  const update = (patch: Partial<SavedView>) => save(views.map((v) => (v.id === view.id ? { ...v, ...patch } : v)));
  const addView = (kind: ViewKind) => {
    const k = VIEW_KINDS.find((x) => x.id === kind)!;
    const v: SavedView = {
      id: newViewId(), name: k.label.replace(' (kanban)', ''), kind, filters: [], sort: [],
      groupBy: kind === 'board' ? ty.props.find((p) => p.kind === 'select')?.key : undefined,
      dateKey: kind === 'calendar' || kind === 'timeline' ? ty.props.find((p) => p.kind === 'date')?.key : undefined,
      endKey: kind === 'timeline' ? ty.props.filter((p) => p.kind === 'date')[1]?.key : undefined,
    };
    save([...views, v]);
    select(v.id);
  };

  const rows = useMemo(
    () => applyView(alive.filter((n) => n.type === ty.id), view, ty, notes, q),
    [alive, ty, view, notes, q],
  );

  // Filtrelenmiş görünümde yeni not: filtre değerleri baştan dolu gelsin (Notion gibi)
  const newProps = () => {
    const props: Record<string, unknown> = {};
    // "veya" ile birleşen filtrelerde hangisinin geçerli olacağı belli değil: doldurma
    if (view.filterMode === 'or' && view.filters.length > 1) return props;
    for (const f of view.filters) {
      const def = ty.props.find((p) => p.key === f.key);
      if (!def) continue;
      if (def.kind === 'checkbox' && f.op === 'checked') props[def.key] = true;
      if (f.value === undefined || f.value === '') continue;
      if (def.kind === 'select' && f.op === 'is') props[def.key] = f.value;
      if ((def.kind === 'multiselect' || def.kind === 'relation') && f.op === 'has') props[def.key] = [f.value];
    }
    return props;
  };
  const newNote = () => go(`/n/${createDefault(ty.id, newProps()).id}`);
  const Render = RENDER[view.kind];
  const total = alive.filter((n) => n.type === ty.id).length;

  return (
    <div className={`page wide coll-page view-${view.kind}`}>
      {editing && <TypeEditor typeId={ty.id} onClose={() => { setEditing(false); if (edit) history.replaceState(null, '', `#/c/${ty.id}`); }} />}
      <div className="coll-head">
        <h1>{ty.icon} {ty.plural} <span className="count">{rows.length !== total ? `${rows.length}/${total}` : total}</span></h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setEditing(true)} title={t('collPage.editFields')}>{t('collPage.fields')}</button>
        {ty.id === 'paper' && <PaperImportButton extraProps={newProps} rows={rows} />}
        <NewButton ty={ty} extraProps={newProps} />
      </div>
      <div className="view-tabs" data-tour="views">
        {views.map((v) => (
          <ViewTab
            key={v.id}
            v={v}
            active={v.id === view.id}
            canDelete={views.length > 1}
            onSelect={() => select(v.id)}
            onRename={async () => {
              const name = await promptText(t('collPage.viewName'), v.name);
              if (name?.trim()) save(views.map((x) => (x.id === v.id ? { ...x, name: name.trim() } : x)));
            }}
            onDuplicate={() => {
              const copy = { ...structuredClone(v), id: newViewId(), name: t('collPage.copyName', { name: v.name }) };
              save([...views, copy]);
              select(copy.id);
            }}
            onDelete={() => save(views.filter((x) => x.id !== v.id))}
          />
        ))}
        <AddView onAdd={addView} />
      </div>
      <div className="toolbar">
        <input className="search" placeholder={t('collPage.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterMenu ty={ty} view={view} update={update} />
        <SortMenu ty={ty} view={view} update={update} />
        <ViewOptions ty={ty} view={view} update={update} />
      </div>

      {total === 0 ? (
        <div className="empty">
          <p>{t('collPage.noneYet', { label: ty.label.toLocaleLowerCase(localeTag()) })}</p>
          <button className="btn" onClick={newNote}>{t('collPage.addFirst')}</button>
        </div>
      ) : (
        <Render ty={ty} rows={rows} view={view} newProps={newProps} />
      )}
    </div>
  );
}
