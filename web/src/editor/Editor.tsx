import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import 'katex/dist/katex.min.css';
import { useEffect, useRef } from 'react';
import { promptText } from '../components/Prompt';
import { editorExtensions, insertImageFile } from './extensions';

interface Props {
  /** Değiştiğinde editör yeniden kurulur */
  docKey: string;
  content: unknown;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  /** Başka cihazdan gelen güncelleme sayacı */
  rev?: number;
}

export default function NoteEditor({ docKey, content, onChange, placeholder, rev }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<(() => void) | null>(null);

  const editor = useEditor(
    {
      extensions: editorExtensions(placeholder ?? "Yazmaya başla…  ‘/’ ile komutlar, ‘[[’ ile not bağlantısı"),
      content: (content as JSONContent) ?? '',
      immediatelyRender: true,
      editorProps: {
        attributes: { class: 'prose' },
        handlePaste: (view, event) => {
          const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          files.forEach((f) => void insertImageFile(editorRef.current!, f));
          return true;
        },
        handleDrop: (view, event) => {
          const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
          if (!files.length) return false;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          files.forEach((f) => void insertImageFile(editorRef.current!, f, pos));
          return true;
        },
      },
      onUpdate: ({ editor: e }) => {
        clearTimeout(timer.current);
        pending.current = () => onChangeRef.current(e.getJSON());
        timer.current = setTimeout(() => {
          pending.current?.();
          pending.current = null;
        }, 400);
      },
    },
    [docKey],
  );
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // Not değişirken / sayfadan çıkarken bekleyen değişikliği kaydet
  useEffect(() => () => {
    clearTimeout(timer.current);
    pending.current?.();
    pending.current = null;
  }, [docKey]);

  // Başka cihazdan güncelleme geldiyse ve kullanıcı şu an yazmıyorsa içeriği yenile
  useEffect(() => {
    if (!rev || !editor || editor.isFocused || pending.current) return;
    editor.commands.setContent((content as JSONContent) ?? '', { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      link: e.isActive('link'),
    }),
  });

  const setLink = async () => {
    const prev = (editor.getAttributes('link').href as string) ?? '';
    const url = await promptText('Bağlantı adresi', prev, { hint: 'Boş bırakırsan bağlantı kaldırılır.' });
    if (url === null) return;
    const c = editor.chain().focus().extendMarkRange('link');
    (url.trim() ? c.setLink({ href: url.trim() }) : c.unsetLink()).run();
  };

  const toMath = () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    if (text) editor.chain().focus().deleteRange({ from, to }).insertInlineMath({ latex: text }).run();
  };

  return (
    <div className="editor">
      <BubbleMenu editor={editor} className="bubble" shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock') && !e.isActive('image')}>
        <button className={state.bold ? 'on' : ''} onClick={() => editor.chain().focus().toggleBold().run()} title="Kalın (Ctrl+B)"><b>B</b></button>
        <button className={state.italic ? 'on' : ''} onClick={() => editor.chain().focus().toggleItalic().run()} title="İtalik (Ctrl+I)"><i>I</i></button>
        <button className={state.underline ? 'on' : ''} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Altı çizili (Ctrl+U)"><u>U</u></button>
        <button className={state.strike ? 'on' : ''} onClick={() => editor.chain().focus().toggleStrike().run()} title="Üstü çizili"><s>S</s></button>
        <button className={state.highlight ? 'on' : ''} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Vurgula">🖍</button>
        <button className={state.code ? 'on' : ''} onClick={() => editor.chain().focus().toggleCode().run()} title="Kod">{'</>'}</button>
        <button className={state.link ? 'on' : ''} onClick={() => void setLink()} title="Bağlantı">🔗</button>
        <button onClick={toMath} title="Seçimi formüle çevir">∑</button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
