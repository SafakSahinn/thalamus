// Notion tarzı ek bloklar: bilgi kutusu, sütunlar, içindekiler, Mermaid diyagramı,
// dosya/PDF, yer imi, sayfa gömme ve tarih rozeti.

import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditorState, type ReactNodeViewProps } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { promptText } from '../components/Prompt';
import { fmtDay } from '../lib/format';
import { go } from '../lib/router';
import { resolveFileUrl } from '../lib/store';
import { EmojiPicker } from './EmojiPicker';

const attr = (name: string, def: unknown = null) => ({
  default: def,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? def,
  renderHTML: (a: Record<string, unknown>) => (a[name] == null ? {} : { [`data-${name}`]: a[name] }),
});

// ---------- bilgi kutusu (callout) ----------

export const CALLOUT_COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;

function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [pick, setPick] = useState(false);
  return (
    <NodeViewWrapper className={`callout bg-${node.attrs.color}`} data-type="callout">
      <span className="callout-emoji" contentEditable={false}>
        <button type="button" onClick={() => editor.isEditable && setPick(!pick)} title="Simgeyi değiştir">{node.attrs.emoji}</button>
        {pick && (
          <EmojiPicker
            onPick={(e) => { updateAttributes({ emoji: e || '💡' }); setPick(false); }}
            onClose={() => setPick(false)}
            colors={CALLOUT_COLORS}
            color={node.attrs.color}
            onColor={(c) => updateAttributes({ color: c })}
          />
        )}
      </span>
      <NodeViewContent className="callout-body" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({ emoji: attr('emoji', '💡'), color: attr('color', 'gray') }),
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }, { tag: 'aside' }],
  addKeyboardShortcuts() {
    return {
      // Kutunun son satırı boşken Enter: kutudan çık
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph' || $from.parent.content.size) return false;
        const d = $from.depth - 1;
        const box = $from.node(d);
        if (box?.type.name !== 'callout' || box.childCount < 2 || $from.index(d) !== box.childCount - 1) return false;
        return editor.commands.lift('paragraph');
      },
    };
  },
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

// ---------- sütunlar ----------

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'column' }), 0],
});

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,4}',
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'columns' }), 0],
});

export const columnsContent = (n: number) => ({
  type: 'columns',
  content: Array.from({ length: n }, () => ({ type: 'column', content: [{ type: 'paragraph' }] })),
});

// ---------- içindekiler ----------

function TocView({ editor }: ReactNodeViewProps) {
  const heads = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const out: { level: number; text: string; pos: number }[] = [];
      e.state.doc.descendants((n, pos) => {
        if (n.type.name === 'heading') out.push({ level: n.attrs.level as number, text: n.textContent, pos });
        return !['codeBlock', 'table'].includes(n.type.name);
      });
      return out;
    },
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  const jump = (pos: number) => {
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <NodeViewWrapper className="toc" contentEditable={false}>
      <div className="toc-title">İçindekiler</div>
      {heads.length === 0 && <div className="muted small">Başlık eklediğinde burada listelenir.</div>}
      {heads.map((h, i) => (
        <button key={i} type="button" className={`toc-item l${h.level}`} onClick={() => jump(h.pos)}>{h.text || 'Başlıksız'}</button>
      ))}
    </NodeViewWrapper>
  );
}

export const Toc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: 'div[data-type="toc"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toc' })],
  addNodeView() {
    return ReactNodeViewRenderer(TocView);
  },
});

// ---------- Mermaid diyagramı ----------

let mermaidId = 0;
// Mermaid aynı anda birden çok çizimde sorun çıkarıyor: sırayla çiz
let mermaidQueue: Promise<unknown> = Promise.resolve();
const isDark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

function MermaidView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  const code = node.attrs.code as string;
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const job = mermaidQueue.then(async () => {
          const m = (await import('mermaid')).default;
          m.initialize({ startOnLoad: false, theme: isDark() ? 'dark' : 'default', securityLevel: 'strict' });
          return m.render(`mmd${++mermaidId}`, code);
        });
        mermaidQueue = job.catch(() => undefined);
        const { svg } = await job;
        if (alive && box.current) {
          box.current.innerHTML = svg;
          setErr('');
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message.split('\n')[0] : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  const edit = async () => {
    if (!editor.isEditable) return;
    const v = await promptText('Diyagram (Mermaid)', code, {
      multiline: true,
      hint: 'Örnek: graph LR; Giriş-->Filtre-->Çıkış · Ayrıntı: mermaid.js.org',
    });
    if (v !== null) updateAttributes({ code: v });
  };
  return (
    <NodeViewWrapper className="mermaid-block" contentEditable={false}>
      <div ref={box} className="mermaid-svg" onDoubleClick={() => void edit()} />
      {err && <div className="err small">Diyagram çizilemedi: {err}</div>}
      <button type="button" className="block-edit" onClick={() => void edit()}>Düzenle</button>
    </NodeViewWrapper>
  );
}

export const Mermaid = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  addAttributes: () => ({ code: attr('code', 'graph LR\n  A[Giriş] --> B[İşlem] --> C[Çıkış]') }),
  parseHTML: () => [{ tag: 'div[data-type="mermaid"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })],
  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },
});

// ---------- dosya / PDF ----------

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

function FileView({ node }: ReactNodeViewProps) {
  const { src, name, size, mime } = node.attrs as { src: string; name: string; size: number; mime: string };
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const isPdf = mime === 'application/pdf' || /\.pdf$/i.test(name);
  const media = mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|oga|aac|flac|opus)$/i.test(name) ? 'audio'
    : mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name) ? 'video' : null;
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  useEffect(() => {
    if (media) resolveFileUrl(src).then(setMediaUrl, (e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [media, src]);
  const open = async () => {
    try {
      window.open(await resolveFileUrl(src), '_blank', 'noopener');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const toggle = async () => {
    if (preview) return setPreview(null);
    try {
      setPreview(await resolveFileUrl(src));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <NodeViewWrapper className="fileblock" contentEditable={false}>
      <div className="file-row">
        <span className="file-ic">{isPdf ? '📕' : media === 'audio' ? '🎧' : media === 'video' ? '🎞' : '📎'}</span>
        <span className="file-name">{name}</span>
        {size ? <span className="muted small">{fmtSize(size)}</span> : null}
        <span className="spacer" />
        {isPdf && <button type="button" className="btn small ghost" onClick={() => void toggle()}>{preview ? 'Önizlemeyi kapat' : 'Önizle'}</button>}
        <button type="button" className="btn small ghost" onClick={() => void open()}>Aç ↗</button>
      </div>
      {err && <div className="err small">{err}</div>}
      {media === 'audio' && mediaUrl && <audio className="media-player" controls preload="metadata" src={mediaUrl} />}
      {media === 'video' && mediaUrl && <video className="media-player" controls preload="metadata" src={mediaUrl} />}
      {preview && <iframe className="pdf-frame" src={preview} title={name} />}
    </NodeViewWrapper>
  );
}

export const FileBlock = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: attr('src', ''), name: attr('name', 'dosya'), size: attr('size', 0), mime: attr('mime', '') }),
  parseHTML: () => [{ tag: 'div[data-type="file"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'file' })],
  addNodeView() {
    return ReactNodeViewRenderer(FileView);
  },
});

// ---------- yer imi (bağlantı kartı) ----------

function BookmarkView({ node }: ReactNodeViewProps) {
  const url = node.attrs.url as string;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* geçersiz adres */
  }
  return (
    <NodeViewWrapper className="bookmark" contentEditable={false}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={`https://icons.duckduckgo.com/ip3/${host}.ico`} alt="" width={18} height={18} loading="lazy" />
        <span className="bm-text">
          <span className="bm-title">{(node.attrs.title as string) || host}</span>
          <span className="bm-url">{url}</span>
        </span>
      </a>
    </NodeViewWrapper>
  );
}

export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  addAttributes: () => ({ url: attr('url', ''), title: attr('title', '') }),
  parseHTML: () => [{ tag: 'div[data-type="bookmark"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'bookmark' })],
  addNodeView() {
    return ReactNodeViewRenderer(BookmarkView);
  },
});

// ---------- gömülü sayfa (Google Haritalar, Figma, Spotify, Desmos…) ----------

function EmbedView({ node, updateAttributes }: ReactNodeViewProps) {
  const [h, setH] = useState<number>((node.attrs.height as number) || 420);
  return (
    <NodeViewWrapper className="embed" contentEditable={false}>
      <iframe
        src={node.attrs.src as string}
        style={{ height: h }}
        title="gömülü içerik"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        allow="fullscreen; clipboard-write; encrypted-media"
      />
      <div className="embed-bar">
        <a href={node.attrs.src as string} target="_blank" rel="noopener noreferrer" className="muted small">{node.attrs.src as string}</a>
        <span className="spacer" />
        <button type="button" className="btn small ghost" onClick={() => { const n = Math.max(200, h - 120); setH(n); updateAttributes({ height: n }); }}>−</button>
        <button type="button" className="btn small ghost" onClick={() => { const n = h + 120; setH(n); updateAttributes({ height: n }); }}>+</button>
      </div>
    </NodeViewWrapper>
  );
}

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  addAttributes: () => ({ src: attr('src', ''), height: attr('height', 420) }),
  parseHTML: () => [{ tag: 'div[data-type="embed"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'embed' })],
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});

// ---------- tarih rozeti (@bugün) ----------

export const DateChip = Node.create({
  name: 'dateChip',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ date: attr('date', '') }),
  parseHTML: () => [{ tag: 'span[data-type="date"]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'date', class: 'datechip' }), fmtDay(node.attrs.date as string)],
  renderText: ({ node }) => fmtDay(node.attrs.date as string),
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'datechip';
      dom.textContent = `📅 ${fmtDay(node.attrs.date as string)}`;
      dom.title = 'O günün günlüğünü aç';
      dom.addEventListener('click', () => go(`/daily/${node.attrs.date as string}`));
      return { dom };
    };
  },
});
