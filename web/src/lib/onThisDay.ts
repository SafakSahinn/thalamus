// Tarihte bugün: Wikipedia "On this day" akışı (anahtarsız, CORS açık). Bölümler dilin kendi
// sunucusundan paralel çekilir ve geldikçe gösterilir; gün + dil başına localStorage'da önbelleklenir,
// yarının akışı ve öbür dil boşta önceden hazırlanır. Sunucuda hiçbir şey tutulmaz.

export type OtdLang = 'tr' | 'en';
export type OtdKind = 'selected' | 'events' | 'births' | 'deaths' | 'holidays';

export interface OtdItem {
  text: string;
  year?: number;
  /** ilk bağlantılı maddenin başlığı ve adresi; özet ve küçük resim yalnız manşet bölümünde tutulur */
  title?: string;
  extract?: string;
  thumb?: string;
  url?: string;
}

export type OtdFeed = Record<OtdKind, OtdItem[]>;

export const OTD_KINDS: OtdKind[] = ['selected', 'events', 'births', 'deaths', 'holidays'];

export const OTD_LABELS: Record<OtdLang, Record<OtdKind, string> & { sub: string; page: string; source: string; empty: string; error: string; prev: string; next: string }> = {
  tr: { sub: 'Tarihte Bugün', selected: 'Manşet', events: 'Olaylar', births: 'Doğumlar', deaths: 'Ölümler', holidays: 'Özel günler', page: 'Sayfa', source: 'Kaynak: Vikipedi', empty: 'Bugün için kayıt bulunamadı.', error: 'Vikipedi’ye ulaşılamadı.', prev: 'Önceki sayfa', next: 'Sonraki sayfa' },
  en: { sub: 'On This Day', selected: 'Front page', events: 'Events', births: 'Births', deaths: 'Deaths', holidays: 'Observances', page: 'Page', source: 'Source: Wikipedia', empty: 'No entries found for today.', error: 'Could not reach Wikipedia.', prev: 'Previous page', next: 'Next page' },
};

interface RawPage {
  normalizedtitle?: string;
  titles?: { normalized?: string };
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

const emptyFeed = (): OtdFeed => ({ selected: [], events: [], births: [], deaths: [], holidays: [] });

/** API yanıtını sade kayıtlara çevirir; eksik/bozuk alanlar atlanır, yıllar yeniden eskiye sıralanır */
export function normalizeFeed(raw: unknown): OtdFeed {
  const r = (raw ?? {}) as Partial<Record<OtdKind, { text?: string; year?: number; pages?: RawPage[] }[]>>;
  const out = emptyFeed();
  for (const k of OTD_KINDS) {
    const list = Array.isArray(r[k]) ? r[k]! : [];
    out[k] = list
      .filter((e) => typeof e?.text === 'string')
      .map((e) => {
        const p = e.pages?.[0];
        return {
          // "(pictured)" / "(resimde)" gibi görsel atıflar ve "[en]" dil etiketleri gazete metninde anlamsız
          text: e.text!.replace(/\s*\((?:pictured|resimde|fotoğrafta)[^)]*\)/gi, '').replace(/\s*\[[a-z]{2,3}\]/g, '').trim(),
          year: typeof e.year === 'number' ? e.year : undefined,
          title: p?.normalizedtitle ?? p?.titles?.normalized,
          extract: k === 'selected' ? p?.extract : undefined,
          thumb: k === 'selected' ? p?.thumbnail?.source : undefined,
          url: p?.content_urls?.desktop?.page,
        };
      })
      // Vikipedi'de liste ayrıştırma artığı tek harfli kayıtlar olabiliyor ("g", "t")
      .filter((e) => e.text.length > 3);
    if (k !== 'holidays') out[k].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const mmdd = (d: Date) => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cacheKey = (lang: OtdLang, d: Date) => `otd2:${lang}:${mmdd(d)}`;
const tomorrow = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

export function cachedOnThisDay(lang: OtdLang, date = new Date()): OtdFeed | null {
  try {
    const hit = localStorage.getItem(cacheKey(lang, date));
    return hit ? (JSON.parse(hit) as OtdFeed) : null;
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<OtdFeed>>();

/** Akışı getirir; `onPart` her bölüm geldiğinde o ana kadarki akışla çağrılır */
export function loadOnThisDay(lang: OtdLang, date = new Date(), onPart?: (f: OtdFeed) => void): Promise<OtdFeed> {
  const hit = cachedOnThisDay(lang, date);
  if (hit) return Promise.resolve(hit);
  const key = cacheKey(lang, date);
  const [mm, dd] = mmdd(date).split('-');
  const feed = emptyFeed();
  const run = inflight.get(key) ?? (async () => {
    const results = await Promise.allSettled(OTD_KINDS.map(async (kind) => {
      const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/feed/onthisday/${kind}/${mm}/${dd}`);
      if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
      feed[kind] = normalizeFeed(await res.json())[kind];
      onPart?.({ ...feed });
    }));
    if (results.every((r) => r.status === 'rejected')) throw new Error('Wikipedia');
    if (results.every((r) => r.status === 'fulfilled')) store(key, feed);
    return feed;
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

function store(key: string, feed: OtdFeed) {
  try {
    // yalnız bugünün ve yarının akışları kalır
    const keep = new Set((['tr', 'en'] as const).flatMap((l) => [cacheKey(l, new Date()), cacheKey(l, tomorrow(new Date()))]));
    keep.add(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('otd') && !keep.has(k)) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(feed));
  } catch { /* kota dolu: önbelleksiz devam */ }
}

/** Boşta: yarının akışını ve öbür dili önbelleğe alır (ertesi gün / dil değişince anında açılır) */
export function prefetchOnThisDay(lang: OtdLang) {
  const other: OtdLang = lang === 'tr' ? 'en' : 'tr';
  const jobs: [OtdLang, Date][] = [[lang, tomorrow(new Date())], [other, new Date()]];
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 5000 }) : setTimeout(fn, 2000));
  idle(() => {
    void jobs.reduce((p, [l, d]) => p.then(() => loadOnThisDay(l, d).then(() => undefined, () => undefined)), Promise.resolve());
  });
}
