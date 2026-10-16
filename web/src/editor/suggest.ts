import type { Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { SuggestMenu, type SuggestMenuHandle } from './SuggestMenu';

export interface Entry {
  key: string;
  icon: string;
  label: string;
  hint?: string;
  action: (editor: Editor, range: Range) => void;
}

/** Suggestion eklentisi için ortak ayarlar: açılır menüyü React ile çizer. */
export function suggestConfig(
  items: (query: string) => Entry[],
  empty?: string,
): Pick<SuggestionOptions<Entry, Entry>, 'items' | 'render' | 'command'> {
  return {
    items: ({ query }) => items(query),
    command: ({ editor, range, props }) => props.action(editor, range),
    render: () => {
      let comp: ReactRenderer<SuggestMenuHandle> | null = null;
      let unmount: (() => void) | undefined;
      const toProps = (p: SuggestionProps<Entry, Entry>) => ({
        empty,
        items: p.items.map((e) => ({ key: e.key, icon: e.icon, label: e.label, hint: e.hint, run: () => p.command(e) })),
      });
      return {
        onStart: (p) => {
          comp = new ReactRenderer(SuggestMenu, { props: toProps(p), editor: p.editor });
          unmount = p.mount(comp.element as HTMLElement);
        },
        onUpdate: (p) => comp?.updateProps(toProps(p)),
        onKeyDown: ({ event }) => {
          if (event.key === 'Escape') {
            unmount?.();
            unmount = undefined;
            return true;
          }
          return comp?.ref?.onKeyDown(event) ?? false;
        },
        onExit: () => {
          unmount?.();
          comp?.destroy();
          comp = null;
        },
      };
    },
  };
}
