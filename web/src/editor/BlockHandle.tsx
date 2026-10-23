import { t } from '../i18n';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Messages } from '../i18n';
import { BG_COLORS, TEXT_COLORS } from './colors';
import { openDetailsAt } from './extensions';

interface Target {
  start: number;
  node: PMNode;
  top: number;
  el: HTMLElement;
}

/** Fare/imlecin bulunduğu üst düzey bloğu bulur. */
function blockAt(editor: Editor, el: HTMLElement): { start: number; node: PMNode } | null {
  let found: { start: number; node: PMNode } | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (!found && editor.view.nodeDOM(offset) === el) found = { start: offset, node };
  });
  return found;
}

type TurnKey = keyof Messages['importer']['handle']['turnInto'];
const turn = (key: TurnKey, icon: string, run: (e: Editor) => void) => ({ icon, run, get label() { return t(`importer.handle.turnInto.${key}`); } });
const TURN_INTO: { readonly label: string; icon: string; run: (e: Editor) => void }[] = [
  turn('text', 'T', (e) => e.chain().clearNodes().run()),
  turn('h1', 'H1', (e) => e.chain().clearNodes().toggleHeading({ level: 1 }).run()),
  turn('h2', 'H2', (e) => e.chain().clearNodes().toggleHeading({ level: 2 }).run()),
  turn('h3', 'H3', (e) => e.chain().clearNodes().toggleHeading({ level: 3 }).run()),
  turn('bullet', '•', (e) => e.chain().clearNodes().toggleBulletList().run()),
  turn('ordered', '1.', (e) => e.chain().clearNodes().toggleOrderedList().run()),
  turn('todo', '☑', (e) => e.chain().clearNodes().toggleTaskList().run()),
  turn('toggle', '▸', (e) => e.chain().clearNodes().setDetails().run() && openDetailsAt(e)),
  turn('toggle1', '▸1', (e) => e.chain().clearNodes().setDetails().updateAttributes('details', { level: 1 }).run() && openDetailsAt(e)),
  turn('toggle2', '▸2', (e) => e.chain().clearNodes().setDetails().updateAttributes('details', { level: 2 }).run() && openDetailsAt(e)),
  turn('toggle3', '▸3', (e) => e.chain().clearNodes().setDetails().updateAttributes('details', { level: 3 }).run() && openDetailsAt(e)),
  turn('callout', '💡', (e) => e.chain().clearNodes().wrapIn('callout').run()),
  turn('quote', '❝', (e) => e.chain().clearNodes().toggleBlockquote().run()),
  turn('code', '{}', (e) => e.chain().clearNodes().toggleCodeBlock().run()),
];

export default function BlockHandle({ editor, container }: { editor: Editor; container: RefObject<HTMLDivElement | null> }) {
  const [tg, setT] = useState<Target | null>(null);
  const [menu, setMenu] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  const show = useCallback((el: HTMLElement) => {
    const box = container.current;
    if (!box) return;
    const b = blockAt(editor, el);
    if (!b) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    clearTimeout(hide.current);
    setT({ ...b, top, el });
  }, [editor, container]);

  useEffect(() => {
    const box = container.current;
    if (!box) return;
    const onMove = (e: MouseEvent) => {
      if (menu) return;
      const blocks = [...editor.view.dom.children] as HTMLElement[];
      const hit = blocks.find((b) => {
        const r = b.getBoundingClientRect();
        return e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2;
      });
      if (hit) show(hit);
    };
    const onLeave = () => {
      if (menu) return;
      hide.current = setTimeout(() => setT(null), 400);
    };
    // Dokunmatik ekranlar: imlecin bulunduğu blok
    const onSel = () => {
      if (menu || !editor.isFocused) return;
      const { $from } = editor.state.selection;
      if ($from.depth < 1) return;
      const dom = editor.view.nodeDOM($from.before(1));
      if (dom instanceof HTMLElement) show(dom);
    };
    box.addEventListener('mousemove', onMove);
    box.addEventListener('mouseleave', onLeave);
    editor.on('selectionUpdate', onSel);
    return () => {
      box.removeEventListener('mousemove', onMove);
      box.removeEventListener('mouseleave', onLeave);
      editor.off('selectionUpdate', onSel);
    };
  }, [editor, container, menu, show]);

  useEffect(() => {
    if (!menu) return;
    const out = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [menu]);

  if (!tg || !editor.isEditable) return null;
  // Belge değiştiyse (başka nota geçildi) eski konum geçersiz olabilir
  let cur: ReturnType<typeof editor.state.doc.nodeAt> = null;
  try {
    cur = tg.start <= editor.state.doc.content.size ? editor.state.doc.nodeAt(tg.start) : null;
  } catch {
    cur = null;
  }
  if (!cur) return null;
  const end = tg.start + cur.nodeSize;

  const selectInside = () => {
    // İmleci bloğun içine koy (dönüştürme komutları seçim üzerinde çalışır)
    const inside = Math.min(tg.start + 1, editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(inside).run();
  };
  const selectText = () => editor.chain().focus().setTextSelection({ from: tg.start + 1, to: end - 1 }).run();
  const done = () => setMenu(false);

  const onDragStart = (e: React.DragEvent) => {
    const { view } = editor;
    const sel = NodeSelection.create(view.state.doc, tg.start);
    view.dispatch(view.state.tr.setSelection(sel));
    (view as unknown as { dragging: unknown }).dragging = { slice: sel.content(), move: true };
    e.dataTransfer.clearData();
    e.dataTransfer.setData('text/html', '');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(tg.el, 0, 0);
  };

  const addBelow = () => {
    editor.chain().focus().insertContentAt(end, { type: 'paragraph' }).run();
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, end + 1)));
    editor.commands.insertContent('/');
  };

  return (
    <div className="block-handle" style={{ top: tg.top }} onMouseEnter={() => clearTimeout(hide.current)}>
      <button type="button" className="bh-btn" title={t('importer.handle.addBelow')} onClick={addBelow}>+</button>
      <button
        type="button"
        className="bh-btn grip"
        title={t('importer.handle.drag')}
        draggable
        onDragStart={onDragStart}
        onDragEnd={() => setT(null)}
        onClick={() => setMenu(!menu)}
      >⋮⋮</button>
      {menu && (
        <div className="block-menu" ref={menuRef}>
          <div className="bm-h">{t('importer.handle.turn')}</div>
          <div className="bm-grid">
            {TURN_INTO.map((x) => (
              <button key={x.label} type="button" onClick={() => { selectInside(); x.run(editor); done(); }}>
                <span className="ic">{x.icon}</span>{x.label}
              </button>
            ))}
          </div>
          <div className="bm-h">{t('importer.handle.textColor')}</div>
          <div className="swatches">
            {TEXT_COLORS.map((c) => (
              <button key={c.id} type="button" title={c.label} className={`sw tc-${c.id}`} onClick={() => {
                selectText();
                (c.id === 'default' ? editor.chain().unsetColor() : editor.chain().setColor(`var(--tc-${c.id})`)).run();
                done();
              }}>A</button>
            ))}
          </div>
          <div className="bm-h">{t('importer.handle.background')}</div>
          <div className="swatches">
            {BG_COLORS.map((c) => (
              <button key={c.id} type="button" title={c.label} className={`sw bgsw-${c.id}`} onClick={() => {
                selectText();
                (c.id === 'default' ? editor.chain().unsetHighlight() : editor.chain().setHighlight({ color: `var(--bc-${c.id})` })).run();
                done();
              }}>A</button>
            ))}
          </div>
          <div className="bm-sep" />
          <button type="button" className="bm-row" onClick={() => { editor.chain().focus().insertContentAt(end, cur.toJSON()).run(); done(); }}>{t('importer.handle.duplicate')}</button>
          <button type="button" className="bm-row danger" onClick={() => { editor.chain().focus().deleteRange({ from: tg.start, to: end }).run(); setT(null); done(); }}>{t('importer.handle.delete')}</button>
        </div>
      )}
    </div>
  );
}
