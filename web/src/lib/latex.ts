// Notu LaTeX'e çevir: tez/makale bölümünü derlemeye hazır al.
// - [[makale]] bağlantıları \cite{anahtar} olur, atıf yapılanlar refs.bib dosyasına yazılır
// - Formüller olduğu gibi ($…$, equation*), başlıklar \section…, listeler, tablolar, alıntılar, kod
// - Görseller figures/ klasörüne konur (zip içinde)

import { t } from '../i18n';
import { bibFile, citeKey, citeOf } from './bibtex';
import { displayTitle } from './format';
import type { Note } from './types';

interface PMNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface TexCtx {
  notes: Record<string, Note>;
  synced?: Record<string, { content: unknown }>;
  /** Görsel kaynağı (gd://, local://, https://) → zip içindeki yol; yoksa null */
  figure?: (src: string) => string | null;
  /** Atıf yapılan makaleler (sırayla doldurulur) */
  cited: Note[];
  /** Başlık düzeyi kaydırma: 0 → # = \section */
  shift?: number;
}

/** LaTeX özel karakterlerini kaçır */
export const esc = (s: string) =>
  s.replace(/\\/g, '\u0000')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/\u0000/g, '\\textbackslash{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/[“”]/g, (q) => (q === '“' ? '``' : "''"))
    .replace(/…/g, '\\ldots{}');

function cite(id: string, ctx: TexCtx): string | null {
  const n = ctx.notes[id];
  if (!n || n.type !== 'paper' || n.deleted_at) return null;
  if (!ctx.cited.includes(n)) ctx.cited.push(n);
  return `\\cite{${keyOf(n, ctx)}}`;
}

/** Aynı anahtar iki makaleye düşmesin: refs.bib ile aynı kuralla a/b ekleri */
function keyOf(n: Note, ctx: TexCtx): string {
  const keys = new Map<string, number>();
  for (const p of ctx.cited) {
    const k = citeKey(citeOf(p, ctx.notes));
    const i = keys.get(k) ?? 0;
    keys.set(k, i + 1);
    if (p === n) return i ? `${k}${String.fromCharCode(97 + i)}` : k;
  }
  return citeKey(citeOf(n, ctx.notes));
}

function inline(nodes: PMNode[] | undefined, ctx: TexCtx): string {
  return (nodes ?? []).map((n) => {
    switch (n.type) {
      case 'text': {
        let s = esc(n.text ?? '');
        for (const m of n.marks ?? []) {
          if (m.type === 'bold') s = `\\textbf{${s}}`;
          else if (m.type === 'italic') s = `\\emph{${s}}`;
          else if (m.type === 'underline') s = `\\underline{${s}}`;
          else if (m.type === 'strike') s = `\\sout{${s}}`;
          else if (m.type === 'code') s = `\\texttt{${s}}`;
          else if (m.type === 'link' && typeof m.attrs?.href === 'string') s = `\\href{${m.attrs.href.replace(/([%#])/g, '\\$1')}}{${s}}`;
        }
        return s;
      }
      case 'hardBreak': return '\\\\\n';
      case 'inlineMath': return `$${String(n.attrs?.latex ?? '')}$`;
      case 'wikiLink': {
        const id = String(n.attrs?.id ?? '');
        return cite(id, ctx) ?? esc(String(n.attrs?.label ?? ''));
      }
      case 'dateChip': return esc(String(n.attrs?.date ?? ''));
      default: return inline(n.content, ctx);
    }
  }).join('');
}

const SECTION = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];

function items(n: PMNode, ctx: TexCtx, env: string, mark = (_: PMNode) => ''): string {
  return `\\begin{${env}}\n${(n.content ?? []).map((li) => `  \\item${mark(li)} ${blocks(li.content, ctx).trim().replace(/\n/g, '\n  ')}`).join('\n')}\n\\end{${env}}`;
}

function block(n: PMNode, ctx: TexCtx): string {
  switch (n.type) {
    case 'paragraph': return inline(n.content, ctx);
    case 'heading': return `\\${SECTION[Math.min(4, Number(n.attrs?.level ?? 1) - 1 + (ctx.shift ?? 0))]}{${inline(n.content, ctx)}}`;
    case 'bulletList': return items(n, ctx, 'itemize');
    case 'orderedList': return items(n, ctx, 'enumerate');
    case 'taskList': return items(n, ctx, 'itemize', (li) => (li.attrs?.checked ? '[$\\boxtimes$]' : '[$\\square$]'));
    case 'blockquote':
    case 'callout': return `\\begin{quote}\n${blocks(n.content, ctx)}\n\\end{quote}`;
    case 'codeBlock': return `\\begin{verbatim}\n${(n.content ?? []).map((c) => c.text ?? '').join('')}\n\\end{verbatim}`;
    case 'blockMath': return `\\begin{equation*}\n${String(n.attrs?.latex ?? '').trim()}\n\\end{equation*}`;
    case 'horizontalRule': return '\\medskip\\noindent\\rule{\\linewidth}{0.4pt}\\medskip';
    case 'image': {
      const path = ctx.figure?.(String(n.attrs?.src ?? ''));
      const alt = esc(String(n.attrs?.alt ?? ''));
      return path
        ? `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${path}}\n${alt ? `  \\caption{${alt}}\n` : ''}\\end{figure}`
        : t('fmt.latexImage', { src: String(n.attrs?.src ?? '').slice(0, 80) });
    }
    case 'table': {
      const rows = n.content ?? [];
      const cols = Math.max(1, ...rows.map((r) => r.content?.length ?? 0));
      const body = rows.map((r, i) => `  ${(r.content ?? []).map((c) => blocks(c.content, ctx).replace(/\n+/g, ' ')).join(' & ')} \\\\${i === 0 && r.content?.[0]?.type === 'tableHeader' ? ' \\hline' : ''}`).join('\n');
      return `\\begin{table}[htbp]\n  \\centering\n  \\begin{tabular}{${'l'.repeat(cols)}}\n  \\hline\n${body}\n  \\hline\n  \\end{tabular}\n\\end{table}`;
    }
    case 'details': {
      const [summary, body] = n.content ?? [];
      const lv = Number(n.attrs?.level) || 0;
      const head = lv ? `\\${SECTION[Math.min(4, lv - 1 + (ctx.shift ?? 0))]}{${inline(summary?.content, ctx)}}` : `\\textbf{${inline(summary?.content, ctx)}}`;
      return `${head}\n\n${blocks(body?.content, ctx)}`;
    }
    case 'columns': return (n.content ?? []).map((c) => blocks(c.content, ctx)).join('\n\n');
    case 'syncedBlock': {
      const c = ctx.synced?.[String(n.attrs?.sid ?? '')]?.content as PMNode | undefined;
      return c ? blocks(c.content, ctx) : '';
    }
    case 'bibliography': return '%% KAYNAKÇA_YERİ';
    case 'bookmark': return `\\url{${String(n.attrs?.url ?? '')}}`;
    case 'toc': return '\\tableofcontents';
    case 'mermaid': return t('fmt.latexMermaid');
    default: return n.content ? blocks(n.content, ctx) : '';
  }
}

function blocks(nodes: PMNode[] | undefined, ctx: TexCtx): string {
  return (nodes ?? []).map((n) => block(n, ctx)).filter((s) => s !== '').join('\n\n');
}

export interface TexResult {
  tex: string;
  bib: string;
  cited: number;
}

/** Notun tamamı derlenebilir bir belge (main.tex) ve refs.bib */
export function noteToLatex(note: Note, ctx: Omit<TexCtx, 'cited'>, opts: { standalone?: boolean } = { standalone: true }): TexResult {
  const c: TexCtx = { ...ctx, cited: [] };
  let body = blocks((note.content as PMNode | null)?.content, c);
  const bibCmd = c.cited.length ? '\\bibliographystyle{IEEEtran}\n\\bibliography{refs}' : '';
  body = body.includes('%% KAYNAKÇA_YERİ') ? body.replace('%% KAYNAKÇA_YERİ', bibCmd) : `${body}${bibCmd ? `\n\n${bibCmd}` : ''}`;
  const bib = bibFile(c.cited.map((p) => citeOf(p, ctx.notes)));
  if (!opts.standalone) return { tex: body, bib, cited: c.cited.length };
  const tex = `% Thalamus’tan dışa aktarıldı: ${displayTitle(note)}
% Derleme: pdflatex main && bibtex main && pdflatex main && pdflatex main
\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[turkish]{babel}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage[normalem]{ulem}
\\usepackage{hyperref}
\\usepackage{url}

\\title{${esc(displayTitle(note))}}
\\author{}
\\date{\\today}

\\begin{document}
\\maketitle

${body}

\\end{document}
`;
  return { tex, bib, cited: c.cited.length };
}
