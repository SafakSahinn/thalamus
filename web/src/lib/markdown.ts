// Notları Markdown'a çevirir (Obsidian uyumlu: [[bağlantılar]], YAML ön bilgisi, $formüller$).

import { propValue, showValue } from './compute';
import { displayTitle } from './format';
import { relationIds, typeOf, type Note } from './types';

interface PMNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: PMNode[];
}

export interface MdCtx {
  notes: Record<string, Note>;
  /** gd:// veya local:// adresini dışa aktarımdaki göreli yola çevirir (yoksa adı yazılır) */
  asset?: (src: string) => string | null;
}

const fileName = (src: string) => decodeURIComponent(src.split('#')[1] ?? src.split('/').pop() ?? 'dosya');

function inline(nodes: PMNode[] | undefined, ctx: MdCtx): string {
  if (!nodes) return '';
  return nodes.map((n) => {
    switch (n.type) {
      case 'text': {
        let t = n.text ?? '';
        const marks = n.marks ?? [];
        const has = (m: string) => marks.find((x) => x.type === m);
        if (has('code')) return `\`${t}\``;
        if (has('bold')) t = `**${t}**`;
        if (has('italic')) t = `*${t}*`;
        if (has('strike')) t = `~~${t}~~`;
        if (has('highlight')) t = `==${t}==`;
        if (has('underline')) t = `<u>${t}</u>`;
        const link = has('link');
        if (link) t = `[${t}](${String(link.attrs?.href ?? '')})`;
        return t;
      }
      case 'hardBreak': return '  \n';
      case 'wikiLink': {
        const target = ctx.notes[String(n.attrs?.id)];
        return `[[${target ? displayTitle(target) : String(n.attrs?.label ?? '')}]]`;
      }
      case 'inlineMath': return `$${String(n.attrs?.latex ?? '')}$`;
      case 'dateChip': return String(n.attrs?.date ?? '');
      case 'image': return image(n, ctx);
      default: return inline(n.content, ctx);
    }
  }).join('');
}

function image(n: PMNode, ctx: MdCtx) {
  const src = String(n.attrs?.src ?? '');
  if (/^(gd|local):\/\//.test(src)) {
    const p = ctx.asset?.(src);
    return p ? `![${fileName(src)}](${encodeURI(p)})` : `*[görsel: ${fileName(src)}]*`;
  }
  return `![${String(n.attrs?.alt ?? '')}](${src})`;
}

const indent = (s: string, pad: string) => s.split('\n').map((l) => (l ? pad + l : l)).join('\n');

function listItems(items: PMNode[] | undefined, ctx: MdCtx, marker: (i: number, item: PMNode) => string): string {
  return (items ?? []).map((item, i) => {
    const m = marker(i, item);
    const [first, ...rest] = item.content ?? [];
    const head = first?.type === 'paragraph' ? inline(first.content, ctx) : first ? block(first, ctx) : '';
    const tail = rest.map((b) => indent(block(b, ctx), ' '.repeat(m.length))).join('\n');
    return `${m}${head}${tail ? `\n${tail}` : ''}`;
  }).join('\n');
}

function cellText(cell: PMNode, ctx: MdCtx) {
  return (cell.content ?? []).map((b) => (b.type === 'paragraph' ? inline(b.content, ctx) : block(b, ctx))).join('<br>').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function block(n: PMNode, ctx: MdCtx): string {
  switch (n.type) {
    case 'paragraph': return inline(n.content, ctx);
    case 'heading': return `${'#'.repeat(Number(n.attrs?.level ?? 1))} ${inline(n.content, ctx)}`;
    case 'bulletList': return listItems(n.content, ctx, () => '- ');
    case 'orderedList': return listItems(n.content, ctx, (i) => `${Number(n.attrs?.start ?? 1) + i}. `);
    case 'taskList': return listItems(n.content, ctx, (_i, it) => (it.attrs?.checked ? '- [x] ' : '- [ ] '));
    case 'blockquote': return blocks(n.content, ctx).split('\n').map((l) => `> ${l}`).join('\n');
    case 'codeBlock': return `\`\`\`${String(n.attrs?.language ?? '')}\n${inline(n.content, ctx)}\n\`\`\``;
    case 'horizontalRule': return '---';
    case 'image': return image(n, ctx);
    case 'blockMath': return `$$\n${String(n.attrs?.latex ?? '')}\n$$`;
    case 'callout': return `> ${String(n.attrs?.emoji ?? '💡')} ${blocks(n.content, ctx).split('\n').join('\n> ')}`;
    case 'details': {
      const [summary, body] = n.content ?? [];
      const lv = Number(n.attrs?.level) || 0;
      return `<details>\n<summary>${lv ? `${'#'.repeat(lv)} ` : ''}${inline(summary?.content, ctx)}</summary>\n\n${blocks(body?.content, ctx)}\n\n</details>`;
    }
    case 'columns': return (n.content ?? []).map((c) => blocks(c.content, ctx)).join('\n\n');
    case 'mermaid': return `\`\`\`mermaid\n${String(n.attrs?.code ?? '')}\n\`\`\``;
    case 'fileBlock': {
      const src = String(n.attrs?.src ?? '');
      const p = ctx.asset?.(src);
      return p ? `[📎 ${String(n.attrs?.name ?? fileName(src))}](${encodeURI(p)})` : `*[dosya: ${String(n.attrs?.name ?? fileName(src))}]*`;
    }
    case 'bookmark': return `[${String(n.attrs?.title || n.attrs?.url || '')}](${String(n.attrs?.url ?? '')})`;
    case 'embed': return `[Gömülü sayfa](${String(n.attrs?.src ?? '')})`;
    case 'youtube': return `[YouTube videosu](${String(n.attrs?.src ?? '')})`;
    case 'toc': return '';
    case 'table': {
      const rows = (n.content ?? []).map((r) => (r.content ?? []).map((c) => cellText(c, ctx)));
      if (!rows.length) return '';
      const w = Math.max(...rows.map((r) => r.length));
      const line = (r: string[]) => `| ${Array.from({ length: w }, (_, i) => r[i] ?? '').join(' | ')} |`;
      return [line(rows[0]), `| ${Array(w).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
    }
    default: return n.content ? blocks(n.content, ctx) : inline([n], ctx);
  }
}

function blocks(nodes: PMNode[] | undefined, ctx: MdCtx): string {
  return (nodes ?? []).map((b) => block(b, ctx)).filter((s, i, a) => s !== '' || (i > 0 && a[i - 1] !== '')).join('\n\n');
}

const yaml = (v: unknown) => JSON.stringify(v);

/** Not → Markdown (YAML ön bilgisi + gövde) */
export function noteToMarkdown(note: Note, ctx: MdCtx): string {
  const t = typeOf(note.type);
  const lines = ['---', `title: ${yaml(displayTitle(note))}`, `type: ${yaml(t.label)}`];
  if (note.props.icon) lines.push(`icon: ${yaml(note.props.icon)}`);
  for (const def of t.props) {
    const v = propValue(note, def, ctx.notes);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const key = yaml(def.label);
    if (def.kind === 'relation') {
      const titles = relationIds(v).map((id) => ctx.notes[id]).filter(Boolean).map((n) => `[[${displayTitle(n)}]]`);
      if (titles.length) lines.push(`${key}:`, ...titles.map((x) => `  - ${yaml(x)}`));
    } else if (Array.isArray(v)) {
      lines.push(`${key}:`, ...v.map((x) => `  - ${yaml(x)}`));
    } else if (def.kind === 'url' && /^(gd|local):\/\//.test(String(v))) {
      const p = ctx.asset?.(String(v));
      lines.push(`${key}: ${yaml(p ?? fileName(String(v)))}`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      lines.push(`${key}: ${v}`);
    } else {
      lines.push(`${key}: ${yaml(showValue(v))}`);
    }
  }
  lines.push(`created: ${note.created_at}`, `updated: ${note.updated_at}`, '---', '');
  const body = blocks((note.content as PMNode | null)?.content, ctx);
  return `${lines.join('\n')}# ${displayTitle(note)}\n\n${body}\n`;
}

/** Dosya adı için güvenli başlık */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Adsız';
