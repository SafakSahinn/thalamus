import { describe, expect, it } from 'vitest';
import { esc, noteToLatex } from './latex';
import type { Note } from './types';

const mk = (id: string, type: string, title: string, props: Record<string, unknown>, content: unknown = null): Note => ({
  id, type, title, props, content, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

describe('LaTeX dışa aktarma', () => {
  it('başlık, formül, liste, atıf ve kaynakça', () => {
    const paper = mk('p1', 'paper', 'A New Approach to Linear Filtering', {
      __cite: { type: 'article', title: 'A New Approach to Linear Filtering', authors: [{ given: 'R. E.', family: 'Kalman' }], year: 1960, venue: 'J. Basic Eng.' },
    });
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Durum kestirimi & gözlem' }] },
        { type: 'paragraph', content: [
          { type: 'text', text: 'Kalman filtresi ' },
          { type: 'wikiLink', attrs: { id: 'p1', label: 'A New Approach' } },
          { type: 'text', text: ' %50 daha iyi; ' },
          { type: 'inlineMath', attrs: { latex: 'x_{k+1} = Ax_k' } },
          { type: 'text', text: ' ve ', marks: [] },
          { type: 'text', text: 'önemli', marks: [{ type: 'bold' }] },
        ] },
        { type: 'blockMath', attrs: { latex: 'P = APA^T + Q' } },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'tahmin' }] }] }] },
        { type: 'bibliography', attrs: { style: 'ieee' } },
      ],
    };
    const note = mk('n1', 'note', 'Bölüm 2', {}, doc);
    const r = noteToLatex(note, { notes: { p1: paper, n1: note } });
    expect(r.cited).toBe(1);
    expect(r.tex).toContain('\\section{Durum kestirimi \\& gözlem}');
    expect(r.tex).toContain('Kalman filtresi \\cite{kalman1960approach} \\%50 daha iyi; $x_{k+1} = Ax_k$ ve \\textbf{önemli}');
    expect(r.tex).toContain('\\begin{equation*}\nP = APA^T + Q\n\\end{equation*}');
    expect(r.tex).toContain('\\begin{itemize}\n  \\item tahmin\n\\end{itemize}');
    expect(r.tex).toContain('\\bibliographystyle{IEEEtran}\n\\bibliography{refs}');
    expect(r.tex).toContain('\\begin{document}');
    expect(r.bib).toContain('@article{kalman1960approach,');
  });
  it('özel karakterleri kaçırır', () => {
    expect(esc('a_b & c#1 {x} ~ ^')).toBe('a\\_b \\& c\\#1 \\{x\\} \\textasciitilde{} \\textasciicircum{}');
    expect(esc('C:\\yol')).toBe('C:\\textbackslash{}yol');
  });
});
