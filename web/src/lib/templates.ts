// Şablonlar: hazır (kodda) + kullanıcının kaydettikleri (props.__template işaretli notlar).

import { localeTag, t } from '../i18n';
import type { JSONContent } from '@tiptap/core';
import { createNote, refreshEditor, saveSettings, updateNote, useStore } from './store';
import type { Note, TypeId } from './types';

export interface Template {
  id: string;
  type: TypeId;
  name: string;
  icon: string;
  props?: Record<string, unknown>;
  content: JSONContent | null;
  /** Kullanıcının kaydettiği şablon notunun kimliği */
  noteId?: string;
}

// ---------- belge yapı taşları ----------
const txt = (text: string): JSONContent => ({ type: 'text', text });
const h = (level: number, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [txt(text)] });
const p = (text = ''): JSONContent => (text ? { type: 'paragraph', content: [txt(text)] } : { type: 'paragraph' });
const bullets = (items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((x) => ({ type: 'listItem', content: [p(x)] })) });
const numbered = (items: string[]): JSONContent => ({ type: 'orderedList', content: items.map((x) => ({ type: 'listItem', content: [p(x)] })) });
const tasks = (items: string[]): JSONContent => ({ type: 'taskList', content: items.map((x) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(x)] })) });
const quote = (text = ''): JSONContent => ({ type: 'blockquote', content: [p(text)] });
const callout = (emoji: string, text: string, color = 'gray'): JSONContent => ({ type: 'callout', attrs: { emoji, color }, content: [p(text)] });
const toggle = (summary: string, body: JSONContent[]): JSONContent => ({
  type: 'details', content: [{ type: 'detailsSummary', content: [txt(summary)] }, { type: 'detailsContent', content: body }],
});
const cell = (text: string, header = false): JSONContent => ({ type: header ? 'tableHeader' : 'tableCell', content: [p(text)] });
const table = (head: string[], rows: number): JSONContent => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: head.map((x) => cell(x, true)) },
    ...Array.from({ length: rows }, () => ({ type: 'tableRow', content: head.map(() => cell('')) })),
  ],
});
const math = (latex: string): JSONContent => ({ type: 'blockMath', attrs: { latex } });
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

/** Hazır şablonlar; metinler çağrıldığı andaki dilde kurulur (yeni notlar o dilde başlar) */
export function builtinTemplates(): Template[] {
  return [
    {
      id: 'b:paper', type: 'paper', name: t('tpl.paper.name'), icon: '📄',
      content: doc(
        callout('🎯', t('tpl.paper.why'), 'blue'),
        h(2, t('tpl.paper.abstract')), p(),
        h(2, t('tpl.paper.question')), p(),
        h(2, t('tpl.paper.method')), p(),
        h(2, t('tpl.paper.findings')), bullets(['']),
        h(2, t('tpl.paper.prosCons')), bullets([t('tpl.paper.pro'), t('tpl.paper.con')]),
        h(2, t('tpl.paper.quotes')), quote(),
        h(2, t('tpl.paper.relation')), p(),
        toggle(t('tpl.paper.toRead'), [bullets([''])]),
      ),
    },
    {
      id: 'b:book', type: 'book', name: t('tpl.book.name'), icon: '📚',
      content: doc(
        h(2, t('tpl.book.summary')), p(),
        h(2, t('tpl.book.ideas')), bullets(['']),
        h(2, t('tpl.book.quotes')), quote(),
        h(2, t('tpl.book.notes')), p(),
        h(2, t('tpl.book.recommend')), p(),
      ),
    },
    {
      id: 'b:lab', type: 'lab', name: t('tpl.lab.name'), icon: '🧪',
      content: doc(
        h(2, t('tpl.lab.aim')), p(),
        h(2, t('tpl.lab.theory')), p(), math('V = I \\cdot R'),
        h(2, t('tpl.lab.equipment')), bullets(['']),
        h(2, t('tpl.lab.circuit')), callout('🖼', t('tpl.lab.circuitHint')),
        h(2, t('tpl.lab.method')), numbered(['']),
        h(2, t('tpl.lab.measurements')), table([t('tpl.lab.colMeasure'), t('tpl.lab.colValue'), t('tpl.lab.colUnit'), t('tpl.lab.colNote')], 3),
        h(2, t('tpl.lab.calculations')), p(),
        h(2, t('tpl.lab.result')), p(),
        h(2, t('tpl.lab.errors')), bullets(['']),
        h(2, t('tpl.lab.beforeSubmit')), tasks([t('tpl.lab.check1'), t('tpl.lab.check2'), t('tpl.lab.check3'), t('tpl.lab.check4')]),
      ),
    },
    {
      id: 'b:course', type: 'course', name: t('tpl.course.name'), icon: '🎓',
      content: doc(
        h(2, t('tpl.course.info')), bullets([t('tpl.course.time'), t('tpl.course.office'), t('tpl.course.grading')]),
        h(2, t('tpl.course.weekly')), tasks([1, 2, 3].map((n) => t('tpl.course.week', { n }))),
        h(2, t('tpl.course.dates')), bullets(['']),
        h(2, t('tpl.course.sources')), bullets(['']),
      ),
    },
    {
      id: 'b:lecture', type: 'note', name: t('tpl.lecture.name'), icon: '📝',
      content: doc(
        h(2, t('tpl.lecture.topic')), p(),
        callout('📌', t('tpl.lecture.definitions'), 'blue'), bullets(['']),
        h(2, t('tpl.lecture.formulas')), math('f(x) = '),
        h(2, t('tpl.lecture.examples')), p(),
        toggle(t('tpl.lecture.questions'), [bullets([''])]),
        h(2, t('tpl.lecture.unclear')), tasks(['']),
      ),
    },
    {
      id: 'b:meeting', type: 'note', name: t('tpl.meeting.name'), icon: '🗣',
      content: doc(
        h(2, t('tpl.meeting.attendees')), p(),
        h(2, t('tpl.meeting.agenda')), numbered(['']),
        h(2, t('tpl.meeting.discussed')), p(),
        h(2, t('tpl.meeting.todo')), tasks(['']),
      ),
    },
    {
      id: 'b:conference', type: 'conference', name: t('tpl.conference.name'), icon: '🎤',
      content: doc(
        h(2, t('tpl.conference.checklist')), tasks([t('tpl.conference.c1'), t('tpl.conference.c2'), t('tpl.conference.c3'), t('tpl.conference.c4'), t('tpl.conference.c5')]),
        h(2, t('tpl.conference.dates')), bullets([t('tpl.conference.d1'), t('tpl.conference.d2'), t('tpl.conference.d3'), t('tpl.conference.d4')]),
        h(2, t('tpl.conference.prep')), tasks([t('tpl.conference.slides'), t('tpl.conference.rehearsal')]),
        h(2, t('tpl.conference.notes')), p(),
      ),
    },
    {
      id: 'b:talk', type: 'talk', name: t('tpl.talk.name'), icon: '🎙️',
      content: doc(
        h(2, t('tpl.talk.speaker')), p(),
        h(2, t('tpl.talk.ideas')), bullets(['']),
        h(2, t('tpl.talk.quotes')), quote(),
        h(2, t('tpl.talk.followUp')), tasks(['']),
      ),
    },
  ];
}

export const isTemplate = (n: Pick<Note, 'props'>) => Boolean(n.props.__template);

/** Bir koleksiyonun şablonları: önce kullanıcınınkiler, sonra hazırlar */
export function templatesFor(type: TypeId, notes: Record<string, Note>): Template[] {
  const user = Object.values(notes)
    .filter((n) => n.type === type && isTemplate(n) && !n.deleted_at)
    .sort((a, b) => a.title.localeCompare(b.title, localeTag()))
    .map<Template>((n) => ({ id: `u:${n.id}`, noteId: n.id, type, name: n.title || t('tpl.untitled'), icon: (n.props.icon as string) || '🧩', props: n.props, content: n.content as JSONContent | null }));
  return [...user, ...builtinTemplates().filter((x) => x.type === type)];
}

function cleanProps(props: Record<string, unknown> = {}) {
  const { __template: _t, ...rest } = props;
  return structuredClone(rest);
}

/** Şablondan yeni not */
export function createFromTemplate(tpl: Template, extraProps: Record<string, unknown> = {}): Note {
  return createNote(tpl.type, '', { ...cleanProps(tpl.props), ...extraProps }, tpl.content ? structuredClone(tpl.content) : null);
}

/** Boş bir nota şablon uygula (başlık korunur, alanlar birleşir) */
export function applyTemplate(note: Note, tpl: Template) {
  updateNote(note.id, {
    content: tpl.content ? structuredClone(tpl.content) : null,
    props: { ...cleanProps(tpl.props), ...note.props },
  });
  refreshEditor(note.id);
}

/** Mevcut notu kullanıcı şablonu olarak kopyala */
export function saveAsTemplate(note: Note): Note {
  return createNote(note.type, note.title ? t('tpl.copySuffix', { title: note.title }) : t('tpl.newTemplate'), { ...cleanProps(note.props), __template: true }, note.content ? structuredClone(note.content) : null);
}

export function newBlankTemplate(type: TypeId): Note {
  return createNote(type, t('tpl.newTemplate'), { __template: true });
}

// ---------- varsayılan şablon (koleksiyon başına) ----------

export const defaultTemplateId = (type: TypeId): string | undefined => useStore.getState().settings.defaultTemplates?.[type];

export async function setDefaultTemplate(type: TypeId, id: string | undefined) {
  const s = useStore.getState().settings;
  const map = { ...(s.defaultTemplates ?? {}) };
  if (id) map[type] = id;
  else delete map[type];
  await saveSettings({ ...s, defaultTemplates: map });
}

/** "+ Yeni" ile oluşturulacak not: varsayılan şablon varsa ondan */
export function createDefault(type: TypeId, extraProps: Record<string, unknown> = {}): Note {
  const id = defaultTemplateId(type);
  const tpl = id ? templatesFor(type, useStore.getState().notes).find((x) => x.id === id) : undefined;
  return tpl ? createFromTemplate(tpl, extraProps) : createNote(type, '', extraProps);
}
