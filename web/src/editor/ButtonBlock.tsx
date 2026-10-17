import { mergeAttributes, Node, type JSONContent } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { lazy, Suspense, useState } from 'react';
import { openPeek } from '../components/Peek';
import { fmtDay } from '../lib/format';
import { todayStr } from '../lib/store';
import { createDefault } from '../lib/templates';
import { TYPES, typeOf } from '../lib/types';

// Düğme bloğu (Notion'daki gibi): tıklayınca altına hazır içerik ekler ya da bir koleksiyona yeni kayıt açar.
// İçerikte {bugün} yazan yerler tıklandığı günün tarihiyle değişir.

const NoteEditor = lazy(() => import('./Editor'));

type Action = 'insert' | 'note';

/** Şablondaki {bugün} yer tutucularını doldur */
function fill(node: JSONContent, today: string): JSONContent {
  const out: JSONContent = { ...node };
  if (typeof out.text === 'string') out.text = out.text.replace(/\{bugün\}/gi, today);
  if (out.content) out.content = out.content.map((c) => fill(c, today));
  return out;
}

function ButtonView({ node, updateAttributes, editor, getPos }: ReactNodeViewProps) {
  const { label, action, template, typeId } = node.attrs as { label: string; action: Action; template: JSONContent | null; typeId: string };
  const [edit, setEdit] = useState(!template && action === 'insert' && label === 'Yeni düğme');
  const editable = editor.isEditable;
  const [edKey] = useState(() => Math.random().toString(36).slice(2));

  const run = () => {
    if (action === 'note') {
      openPeek(createDefault(typeId || 'note', {}).id);
      return;
    }
    const blocks = template?.content ?? [];
    if (!blocks.length) {
      setEdit(true);
      return;
    }
    const today = fmtDay(todayStr());
    const pos = (typeof getPos === 'function' ? getPos() : undefined) ?? 0;
    editor.chain().insertContentAt(pos + node.nodeSize, blocks.map((b) => fill(b, today))).run();
  };

  return (
    <NodeViewWrapper className="button-block" data-drag-handle="">
      <div className="button-row" contentEditable={false}>
        <button type="button" className="btn button-run" onClick={run}>
          {action === 'note' ? `${typeOf(typeId || 'note').icon} ` : '▶ '}{label || 'Düğme'}
        </button>
        {editable && <button type="button" className="iconbtn" title="Düğmeyi ayarla" onClick={() => setEdit(!edit)}>{edit ? '▾' : '⚙'}</button>}
      </div>
      {edit && editable && (
        <div className="button-edit" contentEditable={false}>
          <label className="small">Düğme yazısı <input value={label} onChange={(e) => updateAttributes({ label: e.target.value })} /></label>
          <div className="seg">
            <button type="button" className={action === 'insert' ? 'on' : ''} onClick={() => updateAttributes({ action: 'insert' })}>İçerik ekle</button>
            <button type="button" className={action === 'note' ? 'on' : ''} onClick={() => updateAttributes({ action: 'note' })}>Yeni kayıt aç</button>
          </div>
          {action === 'insert' ? (
            <>
              <p className="muted small">Düğmeye her basışta aşağıdaki içerik düğmenin altına eklenir. <code>{'{bugün}'}</code> yazan yer o günün tarihi olur.</p>
              <div className="button-template">
                <Suspense fallback={null}>
                  <NoteEditor
                    docKey={`button-${edKey}`}
                    content={template}
                    placeholder="Eklenecek içerik… ör. ## Toplantı {bugün}"
                    onChange={(doc) => updateAttributes({ template: doc })}
                  />
                </Suspense>
              </div>
            </>
          ) : (
            <label className="small">Koleksiyon{' '}
              <select value={typeId || 'note'} onChange={(e) => updateAttributes({ typeId: e.target.value })}>
                {TYPES.filter((t) => t.id !== 'daily').map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="btn small primary" onClick={() => setEdit(false)}>Tamam</button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const ButtonBlock = Node.create({
  name: 'buttonBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    label: { default: 'Yeni düğme' },
    action: { default: 'insert' },
    typeId: { default: 'note' },
    template: {
      default: null,
      parseHTML: (el) => {
        try {
          return JSON.parse(el.getAttribute('data-template') ?? 'null');
        } catch {
          return null;
        }
      },
      renderHTML: (a) => (a.template ? { 'data-template': JSON.stringify(a.template) } : {}),
    },
  }),
  parseHTML: () => [{ tag: 'div[data-type="button-block"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'button-block' })],
  addNodeView() {
    return ReactNodeViewRenderer(ButtonView, { stopEvent: () => true });
  },
});
