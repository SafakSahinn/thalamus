import { localeTag, t, weekdays } from '../i18n';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { addDays, displayTitle, fmtDay, noteIcon } from '../lib/format';
import { norm } from '../lib/links';
import { searchNotes } from '../lib/search';
import { indexOf, todayStr, useStore } from '../lib/store';
import { typeOf } from '../lib/types';
import { suggestConfig, type Entry } from './suggest';

const p2 = (n: number) => String(n).padStart(2, '0');

/** Etkin dilde kısa tarih ay ile mi başlıyor (en-US: 10/16) */
const monthFirst = () => new Intl.DateTimeFormat(localeTag()).formatToParts(new Date(2026, 9, 16)).find((p) => p.type === 'month' || p.type === 'day')?.type === 'month';

/** "bugün"/"today", "cuma"/"friday", "16.10" (en-US'de 10/16), "16.10.2026", "2026-10-16" → YYYY-MM-DD; sözcükler etkin dilde */
export function parseDateQuery(q: string, today = todayStr()): { date: string; label?: string }[] {
  const n = norm(q);
  const out: { date: string; label?: string }[] = [];
  const add = (date: string, label?: string) => out.push({ date, label });
  const rel: [string, number][] = [[t('writing.mention.today'), 0], [t('writing.mention.tomorrow'), 1], [t('writing.mention.yesterday'), -1]];
  if (!n) {
    for (const [label, d] of rel) add(addDays(today, d), label);
    return out;
  }
  for (const [label, d] of rel) if (norm(label).startsWith(n)) add(addDays(today, d), label);
  const d0 = new Date(`${today}T12:00:00`).getDay();
  weekdays('long', false).forEach((w, i) => {
    if (n.length >= 2 && norm(w).startsWith(n)) {
      const diff = (i - d0 + 7) % 7 || 7;
      add(addDays(today, diff), t('writing.mention.next', { day: w }));
    }
  });
  let m = q.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    const [day, mon] = monthFirst() ? [m[2], m[1]] : [m[1], m[2]];
    add(`${y}-${p2(+mon)}-${p2(+day)}`);
  }
  m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) add(`${m[1]}-${p2(+m[2])}-${p2(+m[3])}`);
  return out.filter((x) => !Number.isNaN(new Date(`${x.date}T12:00:00`).getTime()));
}

function items(query: string): Entry[] {
  const dates: Entry[] = parseDateQuery(query).map((d) => ({
    key: `d-${d.date}-${d.label ?? ''}`,
    icon: '📅',
    label: d.label ? `${d.label} · ${fmtDay(d.date)}` : fmtDay(d.date),
    hint: t('writing.mention.date'),
    action: (editor, range) => {
      editor.chain().focus().insertContentAt(range, [{ type: 'dateChip', attrs: { date: d.date } }, { type: 'text', text: ' ' }]).run();
    },
  }));
  const { alive } = indexOf(useStore.getState().notes);
  const notes: Entry[] = query
    ? searchNotes(alive, query, { limit: 6 }).map((n) => ({
        key: n.id,
        icon: noteIcon(n),
        label: displayTitle(n),
        hint: typeOf(n.type).label,
        action: (editor, range) => {
          editor.chain().focus().insertContentAt(range, [{ type: 'wikiLink', attrs: { id: n.id, label: displayTitle(n) } }, { type: 'text', text: ' ' }]).run();
        },
      }))
    : [];
  return [...dates, ...notes];
}

/** @ ile tarih veya not bağlantısı */
export const Mention = Extension.create({
  name: 'atMention',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('atSuggest'),
        char: '@',
        allowSpaces: false,
        ...suggestConfig(items, t('writing.mention.hint')),
      }),
    ];
  },
});
