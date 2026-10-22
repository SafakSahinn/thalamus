// Tarihte bugün: Wikipedia "On this day" akışı (anahtarsız, CORS açık). Gün + dil başına
// localStorage'da önbelleklenir; sunucuda hiçbir şey tutulmaz.

export type OtdLang = 'tr' | 'en';
export type OtdKind = 'selected' | 'events' | 'births' | 'deaths' | 'holidays';

export interface OtdItem {
  text: string;
  year?: number;
  /** ilk bağlantılı maddenin başlığı, özeti, küçük resmi ve adresi */
  title?: string;
  extract?: string;
  thumb?: string;
  url?: string;
}

export type OtdFeed = Record<OtdKind, OtdItem[]>;

export const OTD_KINDS: OtdKind[] = ['selected', 'events', 'births', 'deaths', 'holidays'];

export const OTD_LABELS: Record<OtdLang, Record<OtdKind, string> & { title: string; page: string; source: string; empty: string; prev: string; next: string }> = {
  tr: { title: 'Tarihte Bugün', selected: 'Manşet', events: 'Olaylar', births: 'Doğumlar', deaths: 'Ölümler', holidays: 'Özel günler', page: 'Sayfa', source: 'Kaynak: Vikipedi', empty: 'Bugün için kayıt bulunamadı.', prev: 'Önceki sayfa', next: 'Sonraki sayfa' },
  en: { title: 'On This Day', selected: 'Front page', events: 'Events', births: 'Births', deaths: 'Deaths', holidays: 'Observances', page: 'Page', source: 'Source: Wikipedia', empty: 'No entries found for today.', prev: 'Previous page', next: 'Next page' },
};

interface RawPage {
  normalizedtitle?: string;
  titles?: { normalized?: string };
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

/** API yanıtını sade kayıtlara çevirir; eksik/bozuk alanlar atlanır, yıllar yeniden eskiye sıralanır */
export function normalizeFeed(raw: unknown): OtdFeed {
  const r = (raw ?? {}) as Partial<Record<OtdKind, { text?: string; year?: number; pages?: RawPage[] }[]>>;
  const out = {} as OtdFeed;
  for (const k of OTD_KINDS) {
    const list = Array.isArray(r[k]) ? r[k]! : [];
    out[k] = list
      .filter((e) => typeof e?.text === 'string' && e.text.trim())
      .map((e) => {
        const p = e.pages?.[0];
        return {
          // "(pictured)" / "(resimde)" gibi görsel atıfları gazete metninde anlamsız
          text: e.text!.replace(/\s*\((?:pictured|resimde|fotoğrafta)[^)]*\)/gi, '').trim(),
          year: typeof e.year === 'number' ? e.year : undefined,
          title: p?.normalizedtitle ?? p?.titles?.normalized,
          extract: p?.extract,
          thumb: p?.thumbnail?.source,
          url: p?.content_urls?.desktop?.page,
        };
      });
    if (k !== 'holidays') out[k].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }
  return out;
}

/** Bir bölümü sabit boyutlu gazete sayfalarına böler (boş bölümler sayfa üretmez) */
export function paginate(feed: OtdFeed, per: number): { kind: OtdKind; items: OtdItem[] }[] {
  const pages: { kind: OtdKind; items: OtdItem[] }[] = [];
  for (const kind of OTD_KINDS) {
    const list = feed[kind];
    for (let i = 0; i < list.length; i += per) pages.push({ kind, items: list.slice(i, i + per) });
  }
  return pages;
}

const pad = (n: number) => String(n).padStart(2, '0');

export async function fetchOnThisDay(lang: OtdLang, date = new Date()): Promise<OtdFeed> {
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const key = `otd:${lang}:${mm}-${dd}`;
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as OtdFeed;
  } catch { /* önbellek yoksa ağdan */ }
  const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/${lang}/onthisday/all/${mm}/${dd}`);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const feed = normalizeFeed(await res.json());
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`otd:${lang}:`) && k !== key) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(feed));
  } catch { /* kota dolu: önbelleksiz devam */ }
  return feed;
}
