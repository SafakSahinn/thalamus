import { mergeAttributes, Node } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { displayTitle, noteIcon } from '../lib/format';
import { go } from '../lib/router';
import { searchNotes } from '../lib/search';
import { createNote, indexOf, useStore } from '../lib/store';
import { TYPE_MAP, typeOf, type TypeId } from '../lib/types';
import { suggestConfig, type Entry } from './suggest';

const CREATE_TYPES: TypeId[] = ['note', 'concept', 'word', 'person', 'paper', 'book'];

function wikiItems(query: string): Entry[] {
  const { alive } = indexOf(useStore.getState().notes);
  const found = searchNotes(alive, query, { limit: 8 });
  const out: Entry[] = found.map((n) => ({
    key: n.id,
    icon: noteIcon(n),
    label: displayTitle(n),
    hint: typeOf(n.type).label,
    action: (editor, range) => {
      editor.chain().focus().insertContentAt(range, [
        { type: 'wikiLink', attrs: { id: n.id, label: displayTitle(n) } },
        { type: 'text', text: ' ' },
      ]).run();
    },
  }));
  const title = query.trim();
  if (title && !found.some((n) => n.title.toLocaleLowerCase('tr') === title.toLocaleLowerCase('tr'))) {
    for (const t of CREATE_TYPES) {
      out.push({
        key: `new-${t}`,
        icon: '＋',
        label: `Yeni ${TYPE_MAP[t].label.toLocaleLowerCase('tr')}: “${title}”`,
        action: (editor, range) => {
          const n = createNote(t, title);
          editor.chain().focus().insertContentAt(range, [
            { type: 'wikiLink', attrs: { id: n.id, label: title } },
            { type: 'text', text: ' ' },
          ]).run();
        },
      });
    }
  }
  return out;
}

/** [[Not adı]] bağlantısı. Hedef not kimliğiyle saklanır; başlık değişse de bağlantı kopmaz. */
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => ({ 'data-id': a.id }) },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-label') ?? el.textContent ?? '',
        renderHTML: (a) => ({ 'data-label': a.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="wiki-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['a', mergeAttributes({ 'data-type': 'wiki-link', class: 'wikilink', href: `#/n/${node.attrs.id}` }, HTMLAttributes), node.attrs.label];
  },

  renderText({ node }) {
    return `[[${node.attrs.label}]]`;
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('a');
      dom.className = 'wikilink';
      dom.setAttribute('data-type', 'wiki-link');
      const id = node.attrs.id as string;
      dom.href = `#/n/${id}`;
      const paint = () => {
        const n = useStore.getState().notes[id];
        const gone = !n || Boolean(n.deleted_at);
        dom.textContent = n && !gone ? displayTitle(n) : (node.attrs.label as string) || '?';
        dom.classList.toggle('missing', gone);
        dom.title = gone ? 'Bu not silinmiş veya henüz eşitlenmemiş' : typeOf(n.type).label;
      };
      paint();
      let last = useStore.getState().notes[id];
      const unsub = useStore.subscribe((s) => {
        if (s.notes[id] !== last) {
          last = s.notes[id];
          paint();
        }
      });
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        go(`/n/${id}`);
      });
      return { dom, destroy: unsub };
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('wikiSuggest'),
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        ...suggestConfig(wikiItems, 'Yazmaya devam et…'),
      }),
    ];
  },
});
