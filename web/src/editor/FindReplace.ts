import { localeTag } from '../i18n';
import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Not içinde bul / değiştir. Eşleşmeler biçimlendirme sınırlarını (kalın, bağlantı vb.) aşsa da bulunur.

export interface Range {
  from: number;
  to: number;
}

interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: Range[];
  current: number;
}

export const findKey = new PluginKey<FindState>('findReplace');

const fold = (s: string, cs: boolean) => (cs ? s : s.toLocaleLowerCase(localeTag()));

export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): Range[] {
  const out: Range[] = [];
  if (!query) return out;
  const q = fold(query, caseSensitive);
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) map.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        map.push(pos + 1 + offset);
        text += '￼';
      }
    });
    const t = fold(text, caseSensitive);
    let i = t.indexOf(q);
    while (i >= 0) {
      out.push({ from: map[i], to: map[i + q.length - 1] + 1 });
      i = t.indexOf(q, i + Math.max(1, q.length));
    }
    return false;
  });
  return out;
}

export const FindReplace = Extension.create({
  name: 'findReplace',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({ query: '', caseSensitive: false, matches: [], current: 0 }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(findKey) as Partial<FindState> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const next = { ...prev, ...meta };
            if (meta?.query !== undefined || meta?.caseSensitive !== undefined || tr.docChanged) {
              next.matches = findMatches(state.doc, next.query, next.caseSensitive);
            }
            next.current = next.matches.length ? Math.min(Math.max(next.current, 0), next.matches.length - 1) : 0;
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = findKey.getState(state);
            if (!s?.matches.length) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'find-hit current' : 'find-hit' })),
            );
          },
        },
      }),
    ];
  },
});

export const findState = (editor: Editor) => findKey.getState(editor.state)!;

function reveal(editor: Editor) {
  const s = findState(editor);
  const m = s.matches[s.current];
  if (!m) return;
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, m.from, m.to)).scrollIntoView());
}

export function setQuery(editor: Editor, query: string, caseSensitive: boolean) {
  editor.view.dispatch(editor.state.tr.setMeta(findKey, { query, caseSensitive, current: 0 }));
  reveal(editor);
}

export function step(editor: Editor, dir: 1 | -1) {
  const s = findState(editor);
  if (!s.matches.length) return;
  const current = (s.current + dir + s.matches.length) % s.matches.length;
  editor.view.dispatch(editor.state.tr.setMeta(findKey, { current }));
  reveal(editor);
}

export function replaceCurrent(editor: Editor, text: string) {
  const s = findState(editor);
  const m = s.matches[s.current];
  if (!m) return;
  editor.view.dispatch(editor.state.tr.insertText(text, m.from, m.to));
  reveal(editor);
}

export function replaceAll(editor: Editor, text: string) {
  const s = findState(editor);
  if (!s.matches.length) return 0;
  const tr = editor.state.tr;
  for (const m of [...s.matches].reverse()) tr.insertText(text, m.from, m.to);
  editor.view.dispatch(tr);
  return s.matches.length;
}

export function clearFind(editor: Editor) {
  editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: '' }));
}
