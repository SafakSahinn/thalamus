import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { useMemo, useState } from 'react';
import { peekClick } from '../components/Peek';
import { bibFile, citeOf, formatCite, type CiteStyle } from '../lib/bibtex';
import { walk } from '../lib/links';
import { useStore } from '../lib/store';
import { relationIds, type Note } from '../lib/types';

// Kaynakça bloğu: bu notta [[bağlantı]] verilen makaleler (ilk geçiş sırasıyla) ve makalenin "Atıf yaptığı yayınlar" alanı,
// IEEE ya da APA biçiminde; düz metin ya da BibTeX olarak kopyalanır.

/** Notta atıf yapılan makaleler (sırayla, tekrarsız) */
export function citedPapers(note: Note | undefined, notes: Record<string, Note>): Note[] {
  if (!note) return [];
  const ids: string[] = [];
  walk(note.content, (n) => {
    const id = n.type === 'wikiLink' ? (n.attrs as { id?: string } | undefined)?.id : undefined;
    if (id && !ids.includes(id)) ids.push(id);
  });
  for (const id of relationIds(note.props.cites)) if (!ids.includes(id)) ids.push(id);
  return ids.map((id) => notes[id]).filter((n): n is Note => Boolean(n && n.type === 'paper' && !n.deleted_at));
}

function BibView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const style = (node.attrs.style as CiteStyle) ?? 'ieee';
  const noteId = (editor.storage as unknown as { noteCtx?: { noteId: string | null } }).noteCtx?.noteId ?? null;
  const notes = useStore((s) => s.notes);
  const papers = useMemo(() => citedPapers(noteId ? notes[noteId] : undefined, notes), [noteId, notes]);
  const [copied, setCopied] = useState('');
  const sorted = style === 'apa' ? [...papers].sort((a, b) => (citeOf(a, notes).authors[0]?.family ?? a.title).localeCompare(citeOf(b, notes).authors[0]?.family ?? b.title, 'tr')) : papers;
  const lines = sorted.map((p, i) => (style === 'ieee' ? `[${i + 1}] ` : '') + formatCite(citeOf(p, notes), style));
  const copy = (what: 'text' | 'bib') => {
    void navigator.clipboard.writeText(what === 'text' ? lines.join('\n') : bibFile(sorted.map((p) => citeOf(p, notes))));
    setCopied(what);
    setTimeout(() => setCopied(''), 1200);
  };
  return (
    <NodeViewWrapper className="bib-block" data-drag-handle="">
      <div className="bib-head" contentEditable={false}>
        <b>📚 Kaynakça</b>
        <div className="seg">
          {(['ieee', 'apa'] as const).map((s) => <button key={s} type="button" className={style === s ? 'on' : ''} onClick={() => updateAttributes({ style: s })}>{s.toUpperCase()}</button>)}
        </div>
        <span className="spacer" />
        {papers.length > 0 && (
          <>
            <button type="button" className="btn small" onClick={() => copy('text')}>{copied === 'text' ? '✓ Kopyalandı' : 'Metni kopyala'}</button>
            <button type="button" className="btn small" onClick={() => copy('bib')}>{copied === 'bib' ? '✓ Kopyalandı' : 'BibTeX kopyala'}</button>
          </>
        )}
      </div>
      {papers.length === 0 ? (
        <p className="muted small" contentEditable={false}>Bu notta henüz makaleye atıf yok. Metinde <code>[[</code> yazıp bir makaleyi seçtiğinde burada listelenir.</p>
      ) : (
        <ol className={`bib-list ${style}`} contentEditable={false}>
          {sorted.map((p, i) => (
            <li key={p.id}>
              <a href={`#/n/${p.id}`} onClick={peekClick(p.id)}>{lines[i]}</a>
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  );
}

export const BibliographyBlock = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    style: { default: 'ieee', parseHTML: (el) => el.getAttribute('data-style') ?? 'ieee', renderHTML: (a) => ({ 'data-style': a.style }) },
  }),
  parseHTML: () => [{ tag: 'div[data-type="bibliography"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'bibliography' })],
  addNodeView() {
    return ReactNodeViewRenderer(BibView, { stopEvent: () => true });
  },
});
