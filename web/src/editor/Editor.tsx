import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import 'katex/dist/katex.min.css';
import { useEffect, useRef, useState } from 'react';
import { promptText } from '../components/Prompt';
import BlockHandle from './BlockHandle';
import { BG_COLORS, TEXT_COLORS } from './colors';
import { editorExtensions, insertFile } from './extensions';
import FindBar from './FindBar';

interface Props {
  /** Değiştiğinde editör yeniden kurulur */
  docKey: string;
  content: unknown;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  /** Başka cihazdan gelen güncelleme sayacı */
  rev?: number;
  /** Alt sayfa oluştururken üst sayfa */
  noteId?: string | null;
}

export default function NoteEditor({ docKey, content, onChange, placeholder, rev, noteId = null }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<(() => void) | null>(null);

  const editor = useEditor(
    {
      extensions: editorExtensions(placeholder ?? "Yazmaya başla…  ‘/’ ile komutlar, ‘[[’ ile not bağlantısı, ‘@’ ile tarih", noteId),
      content: (content as JSONContent) ?? '',
      immediatelyRender: true,
      editorProps: {
        // Grammarly gibi yazım eklentileri büyük içerik değişikliklerinde sayfayı kilitleyebiliyor (ve Türkçe desteklemiyor)
        attributes: { class: 'prose', 'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false' },
        handlePaste: (view, event) => {
          const files = [...(event.clipboardData?.files ?? [])];
          if (!files.length) return false;
          files.forEach((f) => void insertFile(editorRef.current!, f));
          return true;
        },
        handleDrop: (view, event) => {
          const files = [...(event.dataTransfer?.files ?? [])];
          if (!files.length) return false;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          files.forEach((f) => void insertFile(editorRef.current!, f, pos));
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

  const [find, setFind] = useState<string | null>(null);
  // Ctrl+F: tarayıcının araması yerine not içi bul/değiştir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'f' && editor) {
        e.preventDefault();
        const { from, to } = editor.state.selection;
        setFind(from !== to ? editor.state.doc.textBetween(from, to).slice(0, 100) : find ?? '');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, find]);

  return (
    <div className="editor" data-tour="editor" ref={box}>
      <BlockHandle editor={editor} container={box} />
      {find !== null && <FindBar key={find} editor={editor} initial={find} onClose={() => setFind(null)} />}
      <BubbleMenu editor={editor} className="bubble" shouldShow={({ editor: e, from, to, state }) => e.isFocused && from !== to && !(state.selection as { node?: unknown }).node && !e.isActive('codeBlock') && !e.isActive('image')}>
        <button className={state.bold ? 'on' : ''} onClick={() => editor.chain().focus().toggleBold().run()} title="Kalın (Ctrl+B)"><b>B</b></button>
        <button className={state.italic ? 'on' : ''} onClick={() => editor.chain().focus().toggleItalic().run()} title="İtalik (Ctrl+I)"><i>I</i></button>
        <button className={state.underline ? 'on' : ''} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Altı çizili (Ctrl+U)"><u>U</u></button>
        <button className={state.strike ? 'on' : ''} onClick={() => editor.chain().focus().toggleStrike().run()} title="Üstü çizili"><s>S</s></button>
        <button className={state.highlight ? 'on' : ''} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Vurgula">🖍</button>
        <button className={state.code ? 'on' : ''} onClick={() => editor.chain().focus().toggleCode().run()} title="Kod">{'</>'}</button>
        <button className={state.link ? 'on' : ''} onClick={() => void setLink()} title="Bağlantı">🔗</button>
        <button onClick={toMath} title="Seçimi formüle çevir">∑</button>
        <span className="bubble-colors">
          <button className={colors ? 'on' : ''} onClick={() => setColors(!colors)} title="Renk">A<small>▾</small></button>
          {colors && (
            <div className="color-pop" onMouseLeave={() => setColors(false)}>
              <div className="bm-h">Yazı rengi</div>
              <div className="swatches">
                {TEXT_COLORS.map((c) => (
                  <button key={c.id} title={c.label} className={`sw tc-${c.id}`} onClick={() => {
                    (c.id === 'default' ? editor.chain().focus().unsetColor() : editor.chain().focus().setColor(`var(--tc-${c.id})`)).run();
                    setColors(false);
                  }}>A</button>
                ))}
              </div>
              <div className="bm-h">Arka plan</div>
              <div className="swatches">
                {BG_COLORS.map((c) => (
                  <button key={c.id} title={c.label} className={`sw bgsw-${c.id}`} onClick={() => {
                    (c.id === 'default' ? editor.chain().focus().unsetHighlight() : editor.chain().focus().setHighlight({ color: `var(--bc-${c.id})` })).run();
                    setColors(false);
                  }}>A</button>
                ))}
              </div>
            </div>
          )}
        </span>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
