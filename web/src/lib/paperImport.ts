// Makale bilgisinden (scholar.ts) Thalamus notu: yazarlar Kişiler koleksiyonuna bağlanır, özet notun içine yazılır.

import { lower, t } from '../i18n';
import { plainText } from './links';
import { readPdf, type PdfSection } from './pdfMeta';
import { fetchMeta, findDoiByTitle, KIND_LABEL, parseIdent, personName, type CiteMeta } from './scholar';
import { createNote, refreshEditor, updateNote, useStore } from './store';
import { templatesFor } from './templates';
import type { Note, TypeId } from './types';

const keyName = (s: string) => lower(s.trim()).replace(/\s+/g, ' ');

/** Yazarlar için kişi notları: aynı adlı kişi varsa o kullanılır */
function personIds(meta: CiteMeta): string[] {
  const people = Object.values(useStore.getState().notes).filter((n) => n.type === 'person' && !n.deleted_at);
  return meta.authors.slice(0, 25).map((a) => {
    const name = personName(a);
    const hit = people.find((p) => keyName(p.title) === keyName(name));
    if (hit) return hit.id;
    const n = createNote('person', name);
    people.push(n);
    return n.id;
  });
}

/** Bu DOI ya da arXiv kimliğiyle kayıtlı makale var mı */
export function findPaper(meta: Pick<CiteMeta, 'doi' | 'arxiv'>): Note | undefined {
  return Object.values(useStore.getState().notes).find((n) => {
    if (n.type !== 'paper' || n.deleted_at) return false;
    const c = n.props.__cite as CiteMeta | undefined;
    return Boolean((meta.doi && c?.doi?.toLowerCase() === meta.doi.toLowerCase()) || (meta.arxiv && c?.arxiv === meta.arxiv));
  });
}

function propsFrom(meta: CiteMeta, authors: string[]): Record<string, unknown> {
  return {
    kind: KIND_LABEL[meta.type] ?? 'Ön baskı',
    authors,
    ...(meta.venue ? { venue: meta.venue } : {}),
    ...(meta.year ? { year: meta.year } : {}),
    ...(meta.url ? { doi: meta.url } : {}),
    ...(meta.pdf ? { pdf: meta.pdf } : {}),
    __cite: meta,
  };
}

const abstractDoc = (meta: CiteMeta) => (meta.abstract
  ? { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: t('papers.paper.abstract') }] }, { type: 'paragraph', content: [{ type: 'text', text: meta.abstract }] }] }
  : null);

/** Atıf bilgisinden makale notu (aynı DOI/arXiv ya da aynı başlıkta varsa onu döndürür) */
export function createPaperFromMeta(meta: CiteMeta, extra: Record<string, unknown> = {}): { note: Note; existed: boolean } {
  const old = findPaper(meta) ?? Object.values(useStore.getState().notes).find((n) => n.type === 'paper' && !n.deleted_at && keyName(n.title) === keyName(meta.title));
  if (old) return { note: old, existed: true };
  return { note: createNote('paper', meta.title, { ...propsFrom(meta, personIds(meta)), ...extra }, abstractDoc(meta)), existed: false };
}

/** DOI ya da arXiv kimliğinden yeni makale notu (zaten varsa onu döndürür) */
export async function importPaper(input: string, extra: Record<string, unknown> = {}): Promise<{ note: Note; existed: boolean }> {
  const ident = parseIdent(input);
  if (!ident) throw new Error(t('papers.paper.noIdent'));
  const meta = await fetchMeta(ident);
  const old = findPaper(meta);
  if (old) return { note: old, existed: true };
  const note = createNote('paper', meta.title, { ...propsFrom(meta, personIds(meta)), ...extra }, abstractDoc(meta));
  return { note, existed: false };
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const hasAuthors = (n: Note) => Array.isArray(n.props.authors) && n.props.authors.length > 0;

/** Yalnızca boş alanları doldur (__cite her zaman yenilenir) */
function mergeEmpty(props: Record<string, unknown>, fresh: Record<string, unknown>): Record<string, unknown> {
  const out = { ...props };
  for (const [k, v] of Object.entries(fresh)) if (k === '__cite' || isEmpty(out[k])) out[k] = v;
  return out;
}

/** Var olan makale notunu DOI/arXiv bilgisiyle tamamla (boş alanları doldurur, yazdıklarına dokunmaz) */
export async function fillPaper(noteId: string, input: string): Promise<void> {
  const ident = parseIdent(input);
  if (!ident) throw new Error(t('papers.paper.noIdentShort'));
  const meta = await fetchMeta(ident);
  const n = useStore.getState().notes[noteId];
  if (!n) return;
  const props = mergeEmpty(n.props, propsFrom(meta, hasAuthors(n) ? (n.props.authors as string[]) : personIds(meta)));
  updateNote(noteId, { props, ...(n.title ? {} : { title: meta.title }), ...(!n.content && meta.abstract ? { content: abstractDoc(meta) } : {}) });
}

// ---------- PDF'ten doldurma ----------

/** Not içeriği boş mu ya da elle dokunulmamış bir şablon mu (öyleyse PDF'ten gelen içerikle değiştirilebilir) */
export function isBlankContent(doc: unknown, type: TypeId = 'paper'): boolean {
  if (!doc) return true;
  const text = plainText(doc).replace(/\s+/g, '');
  if (!text) return true;
  return templatesFor(type, useStore.getState().notes).some((tp) => plainText(tp.content).replace(/\s+/g, '') === text);
}

const textNode = (text: string, bold = false) => ({ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });

/** Özet + anahtar kelimeler + makalenin bölüm başlıkları (altları boş: okudukça doldurmak için) */
export function pdfDoc(abstract: string | undefined, keywords: string[], sections: PdfSection[]) {
  const content: unknown[] = [];
  if (abstract) {
    content.push({ type: 'heading', attrs: { level: 2 }, content: [textNode(t('papers.paper.abstract'))] }, { type: 'paragraph', content: [textNode(abstract)] });
  }
  if (keywords.length) content.push({ type: 'paragraph', content: [textNode(t('papers.paper.keywords'), true), textNode(keywords.join(', '))] });
  for (const s of sections) {
    content.push({ type: 'heading', attrs: { level: s.level === 1 ? 2 : 3 }, content: [textNode(s.text)] }, { type: 'paragraph' });
  }
  return content.length ? { type: 'doc', content } : null;
}

export interface PdfFillResult {
  /** bilgiler nereden geldi: PDF'teki DOI/arXiv, başlıkla Crossref araması ya da yalnızca PDF metni */
  source: 'doi' | 'title' | 'pdf';
  title?: string;
  abstract: boolean;
  sections: number;
  /** not içeriği yazıldı mı (yazdığın bir şey varsa yazılmaz) */
  content: boolean;
}

/** PDF'i okuyup makale notunu doldur: boş alanlar, başlık, yazarlar; içerik boşsa özet + bölüm başlıkları */
export async function fillFromPdf(noteId: string, data: ArrayBuffer | Uint8Array, opts: { append?: boolean } = {}): Promise<PdfFillResult> {
  const info = await readPdf(data);
  let meta: CiteMeta | null = null;
  let source: PdfFillResult['source'] = 'pdf';
  const ident = info.doi ? { kind: 'doi' as const, id: info.doi } : info.arxiv ? { kind: 'arxiv' as const, id: info.arxiv } : null;
  if (ident) {
    meta = await fetchMeta(ident).catch(() => null);
    if (meta) source = 'doi';
  }
  if (!meta && info.title) {
    const doi = await findDoiByTitle(info.title).catch(() => null);
    if (doi) meta = await fetchMeta({ kind: 'doi', id: doi }).catch(() => null);
    if (meta) source = 'title';
  }

  const n = useStore.getState().notes[noteId];
  if (!n) throw new Error(t('papers.paper.noteNotFound'));
  // PDF'teki özet yayıncının metnidir; Crossref'te çoğu IEEE makalesinin özeti yok
  const abstract = info.abstract ?? meta?.abstract?.replace(/^Abstract\s*[—–:.-]?\s*/i, '');
  if (meta && abstract && !meta.abstract) meta = { ...meta, abstract };

  let fresh: Record<string, unknown>;
  if (meta) {
    fresh = propsFrom(meta, hasAuthors(n) ? (n.props.authors as string[]) : personIds(meta));
  } else {
    const people = hasAuthors(n) || !info.authors.length ? [] : personIds({ authors: info.authors.map((a) => ({ family: a })) } as CiteMeta);
    fresh = { ...(people.length ? { authors: people } : {}), ...(info.year ? { year: info.year } : {}) };
  }
  const title = meta?.title || info.title;
  const blank = isBlankContent(n.content, n.type);
  const made = blank || opts.append ? pdfDoc(abstract, info.keywords, info.sections) : null;
  // yazdıkların varsa ve sona eklenmesi istendiyse mevcut içeriğin altına
  const doc = made && !blank ? { type: 'doc', content: [...((n.content as { content?: unknown[] }).content ?? []), ...made.content] } : made;
  updateNote(noteId, {
    props: mergeEmpty(n.props, fresh),
    ...(!n.title && title ? { title } : {}),
    ...(doc ? { content: doc } : {}),
  });
  if (doc) refreshEditor(noteId);
  return { source, title, abstract: Boolean(abstract), sections: info.sections.length, content: Boolean(doc) };
}

/** Sonucu kullanıcıya anlatan kısa cümle */
export function pdfFillMessage(r: PdfFillResult): string {
  const from = t(r.source === 'doi' ? 'papers.paper.fromDoi' : r.source === 'title' ? 'papers.paper.fromTitle' : 'papers.paper.fromText');
  const got = [r.abstract && t('papers.paper.gotAbstract'), r.sections && t('papers.paper.gotSections', { count: r.sections })].filter(Boolean).join(t('papers.paper.and'));
  const content = r.content ? (got ? t('papers.paper.written', { got }) : t('papers.paper.noContent')) : t('papers.paper.untouched');
  return t('papers.paper.filled', { from, content });
}
