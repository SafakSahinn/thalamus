// Şablonlar: hazır (kodda) + kullanıcının kaydettikleri (props.__template işaretli notlar).

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
const t = (text: string): JSONContent => ({ type: 'text', text });
const h = (level: number, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: [t(text)] });
const p = (text = ''): JSONContent => (text ? { type: 'paragraph', content: [t(text)] } : { type: 'paragraph' });
const bullets = (items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((x) => ({ type: 'listItem', content: [p(x)] })) });
const numbered = (items: string[]): JSONContent => ({ type: 'orderedList', content: items.map((x) => ({ type: 'listItem', content: [p(x)] })) });
const tasks = (items: string[]): JSONContent => ({ type: 'taskList', content: items.map((x) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(x)] })) });
const quote = (text = ''): JSONContent => ({ type: 'blockquote', content: [p(text)] });
const callout = (emoji: string, text: string, color = 'gray'): JSONContent => ({ type: 'callout', attrs: { emoji, color }, content: [p(text)] });
const toggle = (summary: string, body: JSONContent[]): JSONContent => ({
  type: 'details', content: [{ type: 'detailsSummary', content: [t(summary)] }, { type: 'detailsContent', content: body }],
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

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'b:paper', type: 'paper', name: 'Makale okuma notu', icon: '📄',
    content: doc(
      callout('🎯', 'Bu makaleyi neden okuyorum?', 'blue'),
      h(2, 'Özet'), p(),
      h(2, 'Araştırma sorusu'), p(),
      h(2, 'Yöntem'), p(),
      h(2, 'Bulgular'), bullets(['']),
      h(2, 'Güçlü ve zayıf yönler'), bullets(['Güçlü: ', 'Zayıf: ']),
      h(2, 'Alıntılar'), quote(),
      h(2, 'Kendi araştırmamla ilişkisi'), p(),
      toggle('Okunacak kaynaklar', [bullets([''])]),
    ),
  },
  {
    id: 'b:book', type: 'book', name: 'Kitap notu', icon: '📚',
    content: doc(
      h(2, 'Kısa özet'), p(),
      h(2, 'Öne çıkan fikirler'), bullets(['']),
      h(2, 'Alıntılar'), quote(),
      h(2, 'Kendime notlar'), p(),
      h(2, 'Kime önerirdim?'), p(),
    ),
  },
  {
    id: 'b:lab', type: 'lab', name: 'Deney raporu', icon: '🧪',
    content: doc(
      h(2, 'Amaç'), p(),
      h(2, 'Teorik bilgi'), p(), math('V = I \\cdot R'),
      h(2, 'Kullanılan cihazlar ve malzemeler'), bullets(['']),
      h(2, 'Devre şeması'), callout('🖼', 'Şemanın fotoğrafını ya da çizimini buraya sürükleyip bırak.'),
      h(2, 'Yöntem'), numbered(['']),
      h(2, 'Ölçümler'), table(['Ölçüm', 'Değer', 'Birim', 'Not'], 3),
      h(2, 'Hesaplamalar'), p(),
      h(2, 'Sonuç ve yorum'), p(),
      h(2, 'Hata kaynakları'), bullets(['']),
      h(2, 'Teslimden önce'), tasks(['Ölçüm tabloları dolduruldu', 'Grafikler eklendi', 'Kaynaklar yazıldı', 'Rapor PDF olarak yüklendi']),
    ),
  },
  {
    id: 'b:course', type: 'course', name: 'Ders sayfası', icon: '🎓',
    content: doc(
      h(2, 'Ders bilgileri'), bullets(['Saat ve sınıf: ', 'Ofis saatleri: ', 'Değerlendirme: ']),
      h(2, 'Haftalık konular'), tasks(['1. hafta: ', '2. hafta: ', '3. hafta: ']),
      h(2, 'Sınav ve ödev tarihleri'), bullets(['']),
      h(2, 'Kaynaklar'), bullets(['']),
    ),
  },
  {
    id: 'b:lecture', type: 'note', name: 'Ders notu', icon: '📝',
    content: doc(
      h(2, 'Konu'), p(),
      callout('📌', 'Tanımlar', 'blue'), bullets(['']),
      h(2, 'Formüller'), math('f(x) = '),
      h(2, 'Örnekler'), p(),
      toggle('Kendime sorular', [bullets([''])]),
      h(2, 'Anlamadıklarım'), tasks(['']),
    ),
  },
  {
    id: 'b:meeting', type: 'note', name: 'Toplantı notu', icon: '🗣',
    content: doc(
      h(2, 'Katılanlar'), p(),
      h(2, 'Gündem'), numbered(['']),
      h(2, 'Konuşulanlar'), p(),
      h(2, 'Yapılacaklar'), tasks(['']),
    ),
  },
  {
    id: 'b:conference', type: 'conference', name: 'Konferans planı', icon: '🎤',
    content: doc(
      h(2, 'Başvuru kontrol listesi'), tasks(['Çağrı metni okundu', 'Şablon indirildi', 'Özet yazıldı', 'Bildiri gönderildi', 'Kayıt yapıldı']),
      h(2, 'Önemli tarihler'), bullets(['Özet: ', 'Tam metin: ', 'Kabul bildirimi: ', 'Kamera hazır sürüm: ']),
      h(2, 'Sunum hazırlığı'), tasks(['Slaytlar', 'Prova']),
      h(2, 'Konferans notları'), p(),
    ),
  },
  {
    id: 'b:talk', type: 'talk', name: 'Söyleşi notu', icon: '🎙️',
    content: doc(
      h(2, 'Konuşmacı hakkında'), p(),
      h(2, 'Ana fikirler'), bullets(['']),
      h(2, 'Alıntılar'), quote(),
      h(2, 'Takip edilecekler'), tasks(['']),
    ),
  },
];

export const isTemplate = (n: Pick<Note, 'props'>) => Boolean(n.props.__template);

/** Bir koleksiyonun şablonları: önce kullanıcınınkiler, sonra hazırlar */
export function templatesFor(type: TypeId, notes: Record<string, Note>): Template[] {
  const user = Object.values(notes)
    .filter((n) => n.type === type && isTemplate(n) && !n.deleted_at)
    .sort((a, b) => a.title.localeCompare(b.title, 'tr'))
    .map<Template>((n) => ({ id: `u:${n.id}`, noteId: n.id, type, name: n.title || 'Adsız şablon', icon: (n.props.icon as string) || '🧩', props: n.props, content: n.content as JSONContent | null }));
  return [...user, ...BUILTIN_TEMPLATES.filter((x) => x.type === type)];
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
  return createNote(note.type, note.title ? `${note.title} (şablon)` : 'Yeni şablon', { ...cleanProps(note.props), __template: true }, note.content ? structuredClone(note.content) : null);
}

export function newBlankTemplate(type: TypeId): Note {
  return createNote(type, 'Yeni şablon', { __template: true });
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
