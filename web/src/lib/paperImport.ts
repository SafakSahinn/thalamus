// Makale bilgisinden (scholar.ts) Thalamus notu: yazarlar Kişiler koleksiyonuna bağlanır, özet notun içine yazılır.

import { fetchMeta, KIND_LABEL, parseIdent, personName, type CiteMeta } from './scholar';
import { createNote, updateNote, useStore } from './store';
import type { Note } from './types';

const keyName = (s: string) => s.trim().toLocaleLowerCase('tr').replace(/\s+/g, ' ');

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
  ? { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Özet' }] }, { type: 'paragraph', content: [{ type: 'text', text: meta.abstract }] }] }
  : null);

/** DOI ya da arXiv kimliğinden yeni makale notu (zaten varsa onu döndürür) */
export async function importPaper(input: string, extra: Record<string, unknown> = {}): Promise<{ note: Note; existed: boolean }> {
  const ident = parseIdent(input);
  if (!ident) throw new Error('Bunda bir DOI ya da arXiv numarası bulamadım. Örnek: 10.1109/TAC.1979.1101943 ya da arxiv.org/abs/1706.03762');
  const meta = await fetchMeta(ident);
  const old = findPaper(meta);
  if (old) return { note: old, existed: true };
  const note = createNote('paper', meta.title, { ...propsFrom(meta, personIds(meta)), ...extra }, abstractDoc(meta));
  return { note, existed: false };
}

/** Var olan makale notunu DOI/arXiv bilgisiyle tamamla (boş alanları doldurur, yazdıklarına dokunmaz) */
export async function fillPaper(noteId: string, input: string): Promise<void> {
  const ident = parseIdent(input);
  if (!ident) throw new Error('DOI ya da arXiv numarası bulunamadı.');
  const meta = await fetchMeta(ident);
  const n = useStore.getState().notes[noteId];
  if (!n) return;
  const fresh = propsFrom(meta, Array.isArray(n.props.authors) && n.props.authors.length ? (n.props.authors as string[]) : personIds(meta));
  const props = { ...n.props };
  for (const [k, v] of Object.entries(fresh)) {
    const cur = props[k];
    if (k === '__cite' || cur === undefined || cur === '' || (Array.isArray(cur) && !cur.length)) props[k] = v;
  }
  updateNote(noteId, { props, ...(n.title ? {} : { title: meta.title }), ...(!n.content && meta.abstract ? { content: abstractDoc(meta) } : {}) });
}
