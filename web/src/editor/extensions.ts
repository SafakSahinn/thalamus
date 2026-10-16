import { Extension, type AnyExtension, type Editor } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Mathematics from '@tiptap/extension-mathematics';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { PluginKey } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { promptText } from '../components/Prompt';
import { norm } from '../lib/links';
import { resolveFileUrl, uploadFile } from '../lib/store';
import { CodeBlock } from './CodeBlock';
import { FindReplace } from './FindReplace';
import { suggestConfig, type Entry } from './suggest';
import { WikiLink } from './WikiLink';

const editMath = async (editor: Editor, kind: 'inline' | 'block', latex: string, pos: number) => {
  const v = await promptText(kind === 'inline' ? 'Satır içi formül (LaTeX)' : 'Blok formül (LaTeX)', latex, {
    multiline: kind === 'block',
    hint: 'Örnek: V = I \\cdot R  ·  \\frac{1}{2\\pi f C}  ·  Boş bırakırsan formül silinir.',
  });
  if (v === null) return;
  const chain = editor.chain().setNodeSelection(pos);
  if (!v.trim()) {
    (kind === 'inline' ? chain.deleteInlineMath({ pos }) : chain.deleteBlockMath({ pos })).run();
  } else {
    (kind === 'inline' ? chain.updateInlineMath({ latex: v, pos }) : chain.updateBlockMath({ latex: v, pos })).run();
  }
};

export async function insertImageFile(editor: Editor, file: File, pos?: number) {
  try {
    const src = await uploadFile(file, file.name || 'gorsel.png');
    const chain = editor.chain().focus();
    (pos !== undefined ? chain.insertContentAt(pos, { type: 'image', attrs: { src } }) : chain.setImage({ src })).run();
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
  }
}

function pickImage(editor: Editor) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void insertImageFile(editor, f);
  };
  input.click();
}

/** Ekler gd:// (Drive) veya local:// (yalnızca bu cihaz) olarak saklanır, gösterirken yerel adrese çevrilir. */
const StoredImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement('img');
      img.alt = (node.attrs.alt as string) ?? '';
      img.loading = 'lazy';
      resolveFileUrl(node.attrs.src as string).then((u) => (img.src = u), () => img.classList.add('broken'));
      return { dom: img };
    };
  },
});

const SLASH: (Omit<Entry, 'key'> & { keys?: string })[] = [
  { icon: 'H1', label: 'Başlık 1', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { icon: 'H2', label: 'Başlık 2', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { icon: 'H3', label: 'Başlık 3', action: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { icon: '•', label: 'Madde listesi', keys: 'liste bullet', action: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { icon: '1.', label: 'Numaralı liste', keys: 'liste ordered', action: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { icon: '☑', label: 'Yapılacaklar', keys: 'todo gorev checkbox', action: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { icon: '❝', label: 'Alıntı', keys: 'quote', action: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { icon: '{}', label: 'Kod bloğu', keys: 'code c cpp python matlab verilog program', action: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { icon: '∑', label: 'Formül (blok)', keys: 'math latex denklem', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Blok formül (LaTeX)', '', { multiline: true, hint: 'Örnek: H(s) = \\frac{1}{1 + sRC}' }).then((v) => {
      if (v?.trim()) e.chain().focus().insertBlockMath({ latex: v }).run();
    });
  } },
  { icon: '𝑥', label: 'Formül (satır içi)', keys: 'math latex inline', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    void promptText('Satır içi formül (LaTeX)', '', { hint: 'Kısayol: metin içinde $$V=IR$$ yaz.' }).then((v) => {
      if (v?.trim()) e.chain().focus().insertInlineMath({ latex: v }).run();
    });
  } },
  { icon: '▦', label: 'Tablo', keys: 'table', action: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { icon: '―', label: 'Ayırıcı çizgi', keys: 'hr divider', action: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { icon: '🖼', label: 'Görsel yükle', keys: 'image resim foto', action: (e, r) => {
    e.chain().focus().deleteRange(r).run();
    pickImage(e);
  } },
  { icon: '🔗', label: 'Not bağlantısı [[ ]]', keys: 'link wiki baglanti', action: (e, r) => e.chain().focus().deleteRange(r).insertContent('[[').run() },
];

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey('slashSuggest'),
        char: '/',
        ...suggestConfig((q) => {
          const nq = norm(q);
          return SLASH.filter((s) => !nq || norm(`${s.label} ${s.keys ?? ''}`).includes(nq)).map((s) => ({ ...s, key: s.label }));
        }),
      }),
    ];
  },
});

/** Editörde ve içe aktarmada (şema için) kullanılan ortak eklentiler. */
export function baseExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true }, codeBlock: false }),
    CodeBlock,
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    StoredImage,
    WikiLink,
  ];
}

export function editorExtensions(placeholder: string): AnyExtension[] {
  let editorRef: Editor | null = null;
  return [
    ...baseExtensions(),
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: { onClick: (node, pos) => editorRef && void editMath(editorRef, 'inline', node.attrs.latex, pos) },
      blockOptions: { onClick: (node, pos) => editorRef && void editMath(editorRef, 'block', node.attrs.latex, pos) },
    }),
    Placeholder.configure({ placeholder }),
    SlashCommand,
    FindReplace,
    Extension.create({
      name: 'editorRef',
      onCreate() {
        editorRef = this.editor;
      },
    }),
  ];
}

/** Şema için matematik düğümleri (KaTeX çizimi olmadan da ayrıştırılabilir). */
export function schemaExtensions(): AnyExtension[] {
  return [...baseExtensions(), Mathematics];
}
