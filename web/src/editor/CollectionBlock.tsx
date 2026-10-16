import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useMemo, useState } from 'react';
import { go } from '../lib/router';
import { useIndex, useStore } from '../lib/store';
import { TYPES, typeOf, type SavedView, type ViewKind } from '../lib/types';
import { applyView, VIEW_KINDS } from '../lib/views';
import { BoardView, CalendarView, CardsView, ListView, TableView, TimelineView, type ViewProps } from '../pages/collection/Views';

const RENDER: Record<ViewKind, (p: ViewProps) => React.ReactNode> = {
  table: TableView, cards: CardsView, board: BoardView, calendar: CalendarView, list: ListView, timeline: TimelineView,
};

function CollectionView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const { typeId, kind, onlyLinked } = node.attrs as { typeId: string | null; kind: ViewKind; onlyLinked: boolean };
  const noteId = (editor.storage as unknown as { noteCtx?: { noteId: string | null } }).noteCtx?.noteId ?? null;
  const notes = useStore((s) => s.notes);
  const { alive } = useIndex();
  const [settings, setSettings] = useState(!typeId);
  const t = typeId ? typeOf(typeId) : null;
  const here = noteId ? notes[noteId] : undefined;

  const view: SavedView = useMemo(() => ({
    id: 'inline', name: '', kind, filters: [], sort: t?.sort ? [{ key: t.sort, dir: 'desc' }] : [],
    groupBy: kind === 'board' ? t?.props.find((p) => p.kind === 'select')?.key : undefined,
    dateKey: kind === 'calendar' || kind === 'timeline' ? t?.props.find((p) => p.kind === 'date')?.key : undefined,
    endKey: kind === 'timeline' ? t?.props.filter((p) => p.kind === 'date')[1]?.key : undefined,
  }), [kind, t]);

  const rows = useMemo(() => {
    if (!t) return [];
    const list = alive.filter((n) => n.type === t.id && (!onlyLinked || !noteId || n.links.includes(noteId)));
    return applyView(list, view, t, notes);
  }, [alive, t, onlyLinked, noteId, view, notes]);

  // Buradan eklenen not bu sayfaya bağlansın
  const newProps = () => {
    if (!t || !onlyLinked || !noteId) return {};
    const rel = t.props.find((p) => p.kind === 'relation' && here && p.target?.includes(here.type));
    return rel ? { [rel.key]: [noteId] } : { parent: [noteId] };
  };
  const linkVia = t && here ? t.props.find((p) => p.kind === 'relation' && p.target?.includes(here.type))?.label : undefined;
  const Render = RENDER[kind] ?? TableView;

  return (
    <NodeViewWrapper className="inline-db" contentEditable={false} data-drag-handle="">
      <div className="idb-head">
        {t ? (
          <a className="idb-title" href={`#/c/${t.id}`} onClick={(e) => { e.preventDefault(); go(`/c/${t.id}`); }}>
            {t.icon} {t.plural} <span className="muted small">{rows.length}</span>
          </a>
        ) : <b>Sayfa içinde koleksiyon</b>}
        {t && onlyLinked && <span className="chip-soft small">yalnızca bu sayfaya bağlı{linkVia ? ` (${linkVia})` : ''}</span>}
        <span className="spacer" />
        {editor.isEditable && <button type="button" className="btn small ghost" onClick={() => setSettings(!settings)}>⚙ Ayarlar</button>}
      </div>
      {settings && editor.isEditable && (
        <div className="idb-settings">
          <label>Koleksiyon:
            <select value={typeId ?? ''} onChange={(e) => updateAttributes({ typeId: e.target.value || null })}>
              <option value="">seç…</option>
              {TYPES.filter((x) => x.id !== 'daily').map((x) => <option key={x.id} value={x.id}>{x.icon} {x.plural}</option>)}
            </select>
          </label>
          <label>Görünüm:
            <select value={kind} onChange={(e) => updateAttributes({ kind: e.target.value })}>
              {VIEW_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={onlyLinked} onChange={(e) => updateAttributes({ onlyLinked: e.target.checked })} /> Yalnızca bu sayfaya bağlı olanlar</label>
          {typeId && <button type="button" className="btn small" onClick={() => setSettings(false)}>Tamam</button>}
        </div>
      )}
      {t && (rows.length || !onlyLinked ? (
        <div className="idb-body"><Render t={t} rows={rows} view={view} newProps={newProps} /></div>
      ) : (
        <div className="idb-empty muted small">
          Bu sayfaya bağlı {t.label.toLocaleLowerCase('tr')} yok.{' '}
          <button type="button" className="linkbtn" onClick={() => void import('../lib/templates').then(({ createDefault }) => import('../components/Peek').then(({ openPeek }) => openPeek(createDefault(t.id, newProps()).id)))}>＋ Ekle</button>
        </div>
      ))}
    </NodeViewWrapper>
  );
}

/** Not içinde bir koleksiyonun tablosu/panosu/galerisi (Notion'daki satır içi veritabanı) */
export const CollectionBlock = Node.create({
  name: 'collectionView',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    typeId: { default: null, parseHTML: (el) => el.getAttribute('data-collection'), renderHTML: (a) => (a.typeId ? { 'data-collection': a.typeId } : {}) },
    kind: { default: 'table', parseHTML: (el) => el.getAttribute('data-kind') ?? 'table', renderHTML: (a) => ({ 'data-kind': a.kind }) },
    onlyLinked: { default: true, parseHTML: (el) => el.getAttribute('data-linked') !== 'false', renderHTML: (a) => ({ 'data-linked': String(a.onlyLinked) }) },
  }),
  parseHTML: () => [{ tag: 'div[data-type="collection-view"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'collection-view' })],
  addNodeView() {
    // İçindeki giriş kutuları, seçimler ve sürüklemeler editöre değil görünüme ait
    return ReactNodeViewRenderer(CollectionView, { stopEvent: () => true });
  },
});

