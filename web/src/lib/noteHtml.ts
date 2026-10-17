// Not içeriğini Google Takvim etkinlik açıklamasının anladığı sade HTML'e çevirir
// (yalnızca <b> <i> <u> <s> <a> <br> <ul> <ol> <li>; görseller ve dosyalar yer tutucu olur).

import { propValue, showValue } from './compute';
import { displayTitle, fmtDay } from './format';
import { relationIds, typeOf, type Note, type PropDef } from './types';

interface PMNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(n: PMNode): string {
  if (n.type === 'text') {
    let s = esc(n.text ?? '');
    for (const m of n.marks ?? []) {
      if (m.type === 'bold') s = `<b>${s}</b>`;
      else if (m.type === 'italic') s = `<i>${s}</i>`;
      else if (m.type === 'underline') s = `<u>${s}</u>`;
      else if (m.type === 'strike') s = `<s>${s}</s>`;
      else if (m.type === 'link' && typeof m.attrs?.href === 'string' && /^https?:/.test(m.attrs.href)) s = `<a href="${esc(m.attrs.href)}">${s}</a>`;
    }
    return s;
  }
  if (n.type === 'hardBreak') return '<br>';
  if (n.type === 'wikiLink') return `<b>${esc(String(n.attrs?.label ?? ''))}</b>`;
  if (n.type === 'inlineMath') return esc(String(n.attrs?.latex ?? ''));
  if (n.type === 'dateChip') return typeof n.attrs?.date === 'string' && n.attrs.date ? esc(fmtDay(n.attrs.date)) : '';
  return (n.content ?? []).map(inline).join('');
}

function block(n: PMNode): string {
  const kids = () => (n.content ?? []).map(block).join('');
  switch (n.type) {
    case 'doc':
      return kids();
    case 'paragraph': {
      const s = inline(n);
      return s ? `${s}<br>` : '<br>';
    }
    case 'heading':
      return `<b>${inline(n)}</b><br>`;
    case 'bulletList':
      return `<ul>${kids()}</ul>`;
    case 'orderedList':
    case 'taskList':
      return n.type === 'taskList' ? `<ul>${kids()}</ul>` : `<ol>${kids()}</ol>`;
    case 'listItem':
      return `<li>${kids().replace(/(<br>)+$/, '')}</li>`;
    case 'taskItem':
      return `<li>${n.attrs?.checked ? '☑' : '☐'} ${kids().replace(/(<br>)+$/, '')}</li>`;
    case 'codeBlock':
      return `${esc((n.content ?? []).map((c) => c.text ?? '').join('')).replace(/\n/g, '<br>')}<br>`;
    case 'blockMath':
      return `${esc(String(n.attrs?.latex ?? ''))}<br>`;
    case 'horizontalRule':
      return '———<br>';
    case 'image':
      return '[görsel]<br>';
    case 'fileBlock':
      return `[dosya${n.attrs?.name ? `: ${esc(String(n.attrs.name))}` : ''}]<br>`;
    case 'mermaid':
      return '[diyagram]<br>';
    case 'table':
      return (n.content ?? []).map((row) => `${(row.content ?? []).map((c) => inline({ content: (c.content ?? []).flatMap((p) => p.content ?? []) })).join(' | ')}<br>`).join('');
    default:
      return n.content ? kids() : n.text !== undefined ? inline(n) : '';
  }
}

/** Notun dolu alanları okunur halde (bağlantılar not adlarıyla); skip ile bazı alanlar atlanır */
export function publicProps(note: Note, notes: Record<string, Note>, skip: (def: PropDef) => boolean = () => false) {
  const out: { label: string; value: string }[] = [];
  for (const def of typeOf(note.type).props) {
    if (skip(def)) continue;
    if (def.kind === 'url' && /^(gd|local):/.test(String(note.props[def.key] ?? ''))) continue;
    const v = propValue(note, def, notes);
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    const value = def.kind === 'relation'
      ? relationIds(v).map((id) => (notes[id] ? displayTitle(notes[id]) : '')).filter(Boolean).join(', ')
      : def.kind === 'rating' ? '★'.repeat(Number(v)) : def.kind === 'checkbox' ? (v ? '✓' : '') : showValue(v);
    if (value) out.push({ label: def.label, value });
  }
  return out;
}

/** Google Takvim etkinlik açıklaması: alanlar + notun içeriği + uygulamada açma bağlantısı */
export function eventDescription(note: Note, notes: Record<string, Note>, url: string): string {
  const t = typeOf(note.type);
  const hidden = new Set(note.type === 'event' ? ['time', 'endTime', 'location'] : []);
  const props = publicProps(note, notes, (d) => ['date', 'created', 'updated', 'formula', 'rollup'].includes(d.kind) || hidden.has(d.key))
    .map((p) => `<b>${esc(p.label)}:</b> ${esc(p.value)}`).join('<br>');
  const body = docToHtml(note.content);
  return [props, body, `<i>${t.icon} ${esc(t.label)} · <a href="${esc(url)}">Thalamus’ta aç</a></i>`].filter(Boolean).join('<br><br>');
}

/** Not içeriği → sade HTML (en fazla max karakter) */
export function docToHtml(doc: unknown, max = 6000): string {
  if (!doc || typeof doc !== 'object') return '';
  let html = block(doc as PMNode).replace(/(<br>){3,}/g, '<br><br>').replace(/^(<br>)+|(<br>)+$/g, '');
  if (html.length > max) {
    // Etiketi ortadan kesmemek için son boşlukta kes
    html = `${html.slice(0, html.lastIndexOf(' ', max))}…`;
  }
  return html;
}
