// Kitap kapağı ve film afişi arama (anahtar gerektirmeyen açık servisler) ve görseli indirme.

import { t } from '../i18n';
import { cloud, fnUrl } from './google';

export interface CoverHit {
  url: string;
  title: string;
  sub?: string;
  authors?: string[];
  pages?: number;
  year?: number;
  /** Wikipedia sonucunun Wikidata kimliği (film/dizi ayrıntıları için) */
  qid?: string;
}

const https = (u: string) => u.replace(/^http:\/\//, 'https://');

async function googleBooks(q: string): Promise<CoverHit[]> {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=16&printType=books`);
  if (!r.ok) return [];
  const d = (await r.json()) as {
    items?: { volumeInfo: { title: string; authors?: string[]; pageCount?: number; publishedDate?: string; imageLinks?: { thumbnail?: string } } }[];
  };
  return (d.items ?? [])
    .filter((i) => i.volumeInfo.imageLinks?.thumbnail)
    .map((i) => ({
      url: https(i.volumeInfo.imageLinks!.thumbnail!).replace('&edge=curl', '').replace('zoom=1', 'zoom=2'),
      title: i.volumeInfo.title,
      sub: i.volumeInfo.authors?.join(', '),
      authors: i.volumeInfo.authors,
      pages: i.volumeInfo.pageCount || undefined,
      year: Number(i.volumeInfo.publishedDate?.slice(0, 4)) || undefined,
    }));
}

async function openLibrary(q: string): Promise<CoverHit[]> {
  const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=16&fields=title,author_name,cover_i,first_publish_year,number_of_pages_median`);
  if (!r.ok) return [];
  const d = (await r.json()) as { docs?: { title: string; author_name?: string[]; cover_i?: number; first_publish_year?: number; number_of_pages_median?: number }[] };
  return (d.docs ?? [])
    .filter((x) => x.cover_i)
    .map((x) => ({
      url: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`,
      title: x.title,
      sub: x.author_name?.slice(0, 2).join(', '),
      authors: x.author_name,
      pages: x.number_of_pages_median,
      year: x.first_publish_year,
    }));
}

export async function searchBookCovers(q: string): Promise<CoverHit[]> {
  const [a, b, c, d] = await Promise.all([
    googleBooks(q).catch(() => []),
    openLibrary(q).catch(() => []),
    wiki('tr', `${q} kitap`).catch(() => []),
    wiki('en', `${q} book`).catch(() => []),
  ]);
  const seen = new Set<string>();
  return [...a, ...b, ...c, ...d].filter((h) => !seen.has(h.url) && seen.add(h.url));
}

async function wiki(lang: string, q: string): Promise<CoverHit[]> {
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=10&prop=pageimages|description|pageprops&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=600&pilicense=any&format=json&origin=*`;
  const r = await fetch(u);
  if (!r.ok) return [];
  const d = (await r.json()) as { query?: { pages?: Record<string, { title: string; index: number; description?: string; thumbnail?: { source: string }; pageprops?: { wikibase_item?: string } }> } };
  return Object.values(d.query?.pages ?? {})
    .sort((x, y) => x.index - y.index)
    .filter((p) => p.thumbnail)
    .map((p) => ({ url: p.thumbnail!.source, title: p.title, sub: p.description, year: Number(p.description?.match(/\b(19|20)\d{2}\b/)?.[0]) || undefined, qid: p.pageprops?.wikibase_item }));
}

export async function searchPosters(q: string): Promise<CoverHit[]> {
  const [en, tr] = await Promise.all([wiki('en', `${q} film`).catch(() => []), wiki('tr', `${q} film`).catch(() => [])]);
  const seen = new Set<string>();
  return [...en, ...tr].filter((h) => !seen.has(h.url) && seen.add(h.url));
}

// Wikidata "televizyon dizisi", "animasyon dizisi", "mini dizi", "web dizisi"
const SERIES = new Set(['Q5398426', 'Q581714', 'Q1259759', 'Q526877']);
type Claim = { mainsnak: { datavalue?: { value: { id?: string; time?: string } } } };
const wd = async <T,>(params: string): Promise<T> => {
  const r = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&${params}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
};

/** Film/dizinin yılı ve yönetmen(ler)i Wikidata'dan: dizide yaratıcı, yayın tarihi yoksa başlangıç tarihi. */
export async function movieDetails(qid: string): Promise<{ year?: number; directors: string[] }> {
  const d = await wd<{ entities: Record<string, { claims?: Record<string, Claim[]> }> }>(`ids=${qid}&props=claims`);
  const c = d.entities[qid]?.claims ?? {};
  const vals = (p: string) => (c[p] ?? []).map((x) => x.mainsnak.datavalue?.value).filter((v) => v !== undefined);
  const years = [...vals('P577'), ...vals('P580')].map((v) => Number(v.time?.match(/^[+-]?(\d{4})/)?.[1])).filter((y) => y > 0);
  // Dizilerde P57 her bölümün yönetmenini sayar; orada yaratıcı (P170) asıl kişidir
  const series = vals('P31').some((v) => v.id && SERIES.has(v.id));
  const [first, second] = series ? ['P170', 'P57'] : ['P57', 'P170'];
  const ids = [...new Set((vals(first).length ? vals(first) : vals(second)).map((v) => v.id).filter((x): x is string => !!x))].slice(0, 3);
  let directors: string[] = [];
  if (ids.length) {
    const l = await wd<{ entities: Record<string, { labels?: Record<string, { value: string }> }> }>(`ids=${ids.join('|')}&props=labels&languages=tr|en&languagefallback=1`);
    directors = ids.map((id) => l.entities[id]?.labels?.tr?.value ?? l.entities[id]?.labels?.en?.value).filter((x): x is string => !!x);
  }
  return { year: years.length ? Math.min(...years) : undefined, directors };
}

/** Görseli indirir: önce doğrudan, izin yoksa (Google Books) sunucudaki kapak aracısı üzerinden. */
export async function fetchImageBlob(url: string): Promise<Blob> {
  try {
    const r = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' });
    if (r.ok) {
      const b = await r.blob();
      if (b.type.startsWith('image/') && b.size > 200) return b;
    }
  } catch {
    /* CORS izni yok: aracıyı dene */
  }
  if (!cloud) throw new Error(t('pages.covers.noDirect'));
  const r = await fetch(`${fnUrl}?image=${encodeURIComponent(url)}`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
  });
  if (!r.ok) throw new Error(t('pages.covers.failed'));
  return r.blob();
}

export type CoverMode = 'save' | 'link';
export const getCoverMode = (): CoverMode => {
  try {
    return (localStorage.getItem('coverMode') as CoverMode) || 'save';
  } catch {
    return 'save';
  }
};
