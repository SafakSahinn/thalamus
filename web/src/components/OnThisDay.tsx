import { getLocale } from '../i18n';
import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cachedOnThisDay, loadOnThisDay, OTD_KINDS, OTD_LABELS, prefetchOnThisDay, type OtdFeed, type OtdItem, type OtdKind, type OtdLang } from '../lib/onThisDay';
import { saveSettings, todayStr, useStore } from '../lib/store';

// Ana sayfa bileşeni "Gazete": Wikipedia'dan tarihte bugün, eski gazete sayfası düzeninde.
// Sayfa boyu sabittir. İlk sayfa: tüm genişlikte manşet + altına sığan kadar sütun; kalan metin ikinci
// bölgede sabit yükseklikli sütunlara akar, taşan sütunlar yan yana yeni sayfalar olur (‹ › ile çevrilir).
// İlk sayfaya neyin sığdığı ölçülerek bölünür (tek sütun akışında manşet sonraki sayfalarda boşluk bırakırdı).
// Dil (TR/EN) köşeden seçilir, Drive'da saklanır.

type Entry = { kind: OtdKind; it?: OtdItem };
type Head = { kind: OtdKind; page: number; atStart: boolean };

export default function OnThisDay() {
  // Seçilmemişse uygulama dili (Wikipedia akışı yalnız tr/en)
  const lang: OtdLang = useStore((s) => s.settings.otdLang) ?? (getLocale() === 'tr' ? 'tr' : 'en');
  const L = OTD_LABELS[lang];
  const day = todayStr();
  const [feed, setFeed] = useState<OtdFeed | null>(() => cachedOnThisDay(lang));
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);
  /** ilk sayfaya sığan kayıt sayısı; null = ölçülecek */
  const [split, setSplit] = useState<number | null>(null);
  const [geo, setGeo] = useState({ pages: 1, stride: 1, heads: [] as Head[] });
  const sheet = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const rest = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    setFeed(cachedOnThisDay(lang));
    setErr(false);
    setPage(0);
    loadOnThisDay(lang, new Date(), (f) => { if (!off) setFeed(f); })
      .then((f) => { if (!off) { setFeed(f); prefetchOnThisDay(lang); } }, () => { if (!off) setErr(true); });
    return () => { off = true; };
  }, [lang, day]);

  const lead = feed?.selected[0];
  // Bölüm başlıkları + kayıtlar tek düz liste. Manşet varsa seçkinin geri kalanı olaylara katılır
  // (aynı olay iki kez yazılmaz); böylece manşetin altı tek bir "Olaylar" bölümüyle başlar.
  const entries = useMemo(() => {
    const out: Entry[] = [];
    if (!feed) return out;
    const same = (a: OtdItem, b: OtdItem) => a.year === b.year && (a.text === b.text || (!!a.url && a.url === b.url));
    for (const kind of OTD_KINDS) {
      let items = feed[kind];
      if (lead && kind === 'selected') continue;
      if (lead && kind === 'events') {
        items = [...feed.selected.slice(1), ...feed.events]
          .filter((x, i, a) => !same(x, lead) && a.findIndex((y) => same(x, y)) === i)
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      }
      if (!items.length) continue;
      out.push({ kind });
      for (const it of items) out.push({ kind, it });
    }
    return out;
  }, [feed, lead]);
  // ilk sayfadaki ilk bölüm başlığı manşetin altında tüm genişlikte bant olarak durur
  const band = entries[0] && !entries[0].it ? entries[0] : null;
  const body = band ? entries.slice(1) : entries;

  useLayoutEffect(() => setSplit(null), [entries]);

  // Boyut ya da yazı tipi değişince bölme yeniden ölçülür
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; setSplit(null); } });
    ro.observe(el);
    void document.fonts?.ready.then(() => setSplit(null));
    return () => ro.disconnect();
  }, [feed]);

  useLayoutEffect(() => {
    const a = first.current;
    const b = rest.current;
    if (!a || !b) return;
    if (split === null) {
      // ilk sayfa bölgesinin görünen genişliğinin dışına taşan ilk kayıt = bölme noktası
      const edge = a.getBoundingClientRect().left + a.clientWidth - 1;
      const kids = [...a.children];
      const i = kids.findIndex((k) => k.getBoundingClientRect().left >= edge);
      setSplit(i < 0 ? kids.length : i);
      return;
    }
    const gap = parseFloat(getComputedStyle(b).columnGap) || 0;
    const stride = b.clientWidth + gap;
    const left = b.getBoundingClientRect().left - b.scrollLeft;
    const heads: Head[] = [...sheet.current!.querySelectorAll<HTMLElement>('.otd-first [data-kind]')].map((h) => ({ kind: h.dataset.kind as OtdKind, page: 0, atStart: false }));
    for (const h of b.querySelectorAll<HTMLElement>('[data-kind]')) {
      const x = h.getBoundingClientRect().left - left + 1;
      const p = Math.floor(x / stride);
      heads.push({ kind: h.dataset.kind as OtdKind, page: p + 1, atStart: x - p * stride < 8 });
    }
    if (heads[0]) heads[0].atStart = true;
    const restPages = split < body.length ? Math.max(1, Math.ceil((b.scrollWidth + gap) / stride - 0.02)) : 0;
    setGeo({ pages: 1 + restPages, stride, heads });
  }, [split, entries]);

  const cur = Math.min(page, geo.pages - 1);
  useEffect(() => { if (cur > 0) rest.current?.scrollTo({ left: (cur - 1) * geo.stride, behavior: 'smooth' }); }, [cur, geo.stride]);

  // Bu sayfadaki bölümler: önceki sayfadan devam eden + burada başlayanlar
  const here = geo.heads.filter((h) => h.page === cur);
  const carried = here[0]?.atStart ? undefined : geo.heads.filter((h) => h.page < cur).at(-1);
  const sections = [...(carried ? [carried] : []), ...here].map((h) => L[h.kind]);

  const setLang = (otdLang: OtdLang) => void saveSettings({ ...useStore.getState().settings, otdLang });
  const date = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cut = split ?? body.length;

  return (
    <div className="otd" lang={lang}>
      <button className="otd-nav prev" disabled={cur <= 0} title={L.prev} aria-label={L.prev} onClick={() => setPage(cur - 1)}>‹</button>
      <button className="otd-nav next" disabled={cur >= geo.pages - 1} title={L.next} aria-label={L.next} onClick={() => setPage(cur + 1)}>›</button>
      <div className="otd-lang" role="group" aria-label="Dil / Language">
        {(['tr', 'en'] as const).map((l) => (
          <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <header className="otd-mast">
        <h2>{L.name}</h2>
        <div className="otd-sub">{L.sub}</div>
        <div className="otd-dateline">
          <span>{date}</span>
          <span>{sections.join(' · ')}{sections.length ? ' — ' : ''}{L.page} {cur + 1}/{geo.pages}</span>
        </div>
      </header>
      <div className="otd-sheet" ref={sheet}>
        {err && !entries.length && !lead ? <p className="otd-msg">{L.error}</p>
          : !feed ? <p className="otd-msg">…</p>
          : !entries.length && !lead ? <p className="otd-msg">{L.empty}</p>
          : (
            <>
              <div className={`otd-first ${cur === 0 ? '' : 'hidden'}`}>
                {lead && (
                  <article className="otd-lead">
                    <h4 data-kind="selected">{L.selected}</h4>
                    {lead.year !== undefined && <div className="otd-year">{lead.year}</div>}
                    <h3><Link it={lead}>{lead.text}</Link></h3>
                    <div className={`otd-lead-body ${lead.thumb ? '' : 'noimg'}`}>
                      {lead.thumb && <img src={lead.thumb} alt="" />}
                      {lead.extract && <p>{lead.extract}</p>}
                    </div>
                  </article>
                )}
                {band && <h4 className="otd-band" data-kind={band.kind}>{L[band.kind]}</h4>}
                <div className="otd-cols" ref={first}>{body.slice(0, cut).map((e, i) => <EntryView key={i} e={e} L={L} />)}</div>
              </div>
              <div className={`otd-cols otd-rest ${cur > 0 ? '' : 'hidden'}`} ref={rest}>
                {body.slice(cut).map((e, i) => <EntryView key={i} e={e} L={L} />)}
              </div>
            </>
          )}
      </div>
      <footer className="otd-foot">{L.source}</footer>
    </div>
  );
}

function EntryView({ e, L }: { e: Entry; L: (typeof OTD_LABELS)[OtdLang] }) {
  if (!e.it) return <h4 data-kind={e.kind}>{L[e.kind]}</h4>;
  return (
    <article className="otd-item">
      {e.kind !== 'holidays' && e.it.year !== undefined && <span className="otd-year">{e.it.year}</span>}
      <Link it={e.it}>{e.it.text}</Link>
    </article>
  );
}

function Link({ it, children }: { it: OtdItem; children: React.ReactNode }) {
  return it.url ? <a href={it.url} target="_blank" rel="noreferrer" title={it.title}>{children}</a> : <>{children}</>;
}
