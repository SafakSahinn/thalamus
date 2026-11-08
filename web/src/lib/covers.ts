// Kitap kapağı, film afişi ve oyun kapağı arama (anahtar gerektirmeyen açık servisler) ve görseli indirme.

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
    const l = await wd<{ entities: Record<string, { labels?: Record<string, { value: string }> }> }>(`ids=${ids.join('|')}&props=labels&languages=tr|en|mul&languagefallback=1`);
    directors = ids.map((id) => { const lb = l.entities[id]?.labels; return lb?.tr?.value ?? lb?.en?.value ?? lb?.mul?.value; }).filter((x): x is string => !!x);
  }
  return { year: years.length ? Math.min(...years) : undefined, directors };
}

/** Oyun kapağı: Vikipedi'de oyun maddelerinin bilgi kutusu görseli çoğunlukla kutu kapağıdır. */
export async function searchGames(q: string): Promise<CoverHit[]> {
  const [en, tr] = await Promise.all([wiki('en', `${q} video game`).catch(() => []), wiki('tr', `${q} video oyunu`).catch(() => [])]);
  const seen = new Set<string>();
  return [...en, ...tr].filter((h) => !seen.has(h.url) && seen.add(h.url));
}

// Wikidata platform/tür adlarını (İngilizce) koleksiyondaki hazır seçeneklere eşler; eşlenemeyen atlanır.
const PLATFORMS: [RegExp, string][] = [
  [/windows|ms-dos|^pc\b|personal computer|steam/i, 'PC'],
  [/mac ?os|macintosh/i, 'Mac'],
  [/linux|steamos/i, 'Linux'],
  [/playstation 5/i, 'PlayStation 5'],
  [/playstation 4/i, 'PlayStation 4'],
  [/playstation 3/i, 'PlayStation 3'],
  [/playstation 2/i, 'PlayStation 2'],
  [/playstation portable/i, 'PSP'],
  [/playstation vita/i, 'PS Vita'],
  [/^playstation$/i, 'PlayStation'],
  [/xbox series/i, 'Xbox Series X/S'],
  [/xbox one/i, 'Xbox One'],
  [/xbox 360/i, 'Xbox 360'],
  [/^xbox$/i, 'Xbox'],
  [/switch 2/i, 'Nintendo Switch 2'],
  [/nintendo switch/i, 'Nintendo Switch'],
  [/wii u/i, 'Wii U'],
  [/^wii$/i, 'Wii'],
  [/3ds/i, 'Nintendo 3DS'],
  [/nintendo ds/i, 'Nintendo DS'],
  [/\bios\b|ipados|android|mobile/i, 'Mobil'],
];
const GENRES: [RegExp, string[]][] = [
  [/action-adventure|action adventure/i, ['Aksiyon', 'Macera']],
  [/role-playing|rpg/i, ['Rol yapma (RPG)']],
  [/shoot/i, ['Nişancı']],
  [/strategy|4x|tower defense/i, ['Strateji']],
  [/simulat|management|life sim/i, ['Simülasyon']],
  [/sports?\b|football|soccer|basketball/i, ['Spor']],
  [/racing|driving/i, ['Yarış']],
  [/puzzle/i, ['Bulmaca']],
  [/platform/i, ['Platform']],
  [/horror/i, ['Korku']],
  [/fighting|beat 'em up|hack and slash/i, ['Dövüş']],
  [/stealth/i, ['Gizlilik']],
  [/survival/i, ['Hayatta kalma']],
  [/open world/i, ['Açık dünya']],
  [/rogue/i, ['Roguelike']],
  [/sandbox/i, ['Sandbox']],
  [/adventure/i, ['Macera']],
  [/action/i, ['Aksiyon']],
];
const mapLabels = (labels: string[], table: [RegExp, string | string[]][]) => {
  const out = new Set<string>();
  for (const l of labels) {
    const hit = table.find(([re]) => re.test(l));
    if (hit) for (const v of ([] as string[]).concat(hit[1])) out.add(v);
  }
  return [...out];
};

export interface GameInfo {
  year?: number;
  developers: string[];
  publishers: string[];
  platforms: string[];
  genres: string[];
  /** Önceki oyunun adı (P155 "şundan sonra gelir") */
  prequel?: string;
}

/** Oyunun yılı, geliştiricisi, yayıncısı, platformları, türleri ve önceki oyunu Wikidata'dan. */
export async function gameDetails(qid: string): Promise<GameInfo> {
  const d = await wd<{ entities: Record<string, { claims?: Record<string, Claim[]> }> }>(`ids=${qid}&props=claims`);
  const c = d.entities[qid]?.claims ?? {};
  const vals = (p: string) => (c[p] ?? []).map((x) => x.mainsnak.datavalue?.value).filter((v) => v !== undefined);
  const ids = (p: string, n = 12) => [...new Set(vals(p).map((v) => v.id).filter((x): x is string => !!x))].slice(0, n);
  const years = vals('P577').map((v) => Number(v.time?.match(/^[+-]?(\d{4})/)?.[1])).filter((y) => y > 0);
  const dev = ids('P178', 3), pub = ids('P123', 3), plat = ids('P400', 30), gen = ids('P136', 12), pre = ids('P155', 1);
  const all = [...new Set([...dev, ...pub, ...plat, ...gen, ...pre])];
  // Platform ve tür eşlemesi İngilizce adlarla yapılır; stüdyo ve oyun adları Türkçe varsa Türkçe.
  // Wikidata birçok özel adı (PlayStation 4, Nintendo Switch…) yalnız dil bağımsız "mul" etiketinde tutar.
  const labels: Record<string, { tr?: string; en?: string }> = {};
  for (let i = 0; i < all.length; i += 50) {
    const l = await wd<{ entities: Record<string, { labels?: Record<string, { value: string }> }> }>(`ids=${all.slice(i, i + 50).join('|')}&props=labels&languages=en|tr|mul`);
    for (const [id, e] of Object.entries(l.entities)) {
      const mul = e.labels?.mul?.value;
      labels[id] = { tr: e.labels?.tr?.value ?? mul, en: e.labels?.en?.value ?? mul };
    }
  }
  const name = (id: string) => labels[id]?.tr ?? labels[id]?.en;
  const en = (list: string[]) => list.map((id) => labels[id]?.en).filter((x): x is string => !!x);
  return {
    year: years.length ? Math.min(...years) : undefined,
    developers: dev.map(name).filter((x): x is string => !!x),
    publishers: pub.map(name).filter((x): x is string => !!x),
    platforms: mapLabels(en(plat), PLATFORMS),
    genres: mapLabels(en(gen), GENRES),
    prequel: pre[0] ? name(pre[0]) : undefined,
  };
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
