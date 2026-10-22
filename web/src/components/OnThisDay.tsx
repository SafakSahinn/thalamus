import '@fontsource/unifrakturmaguntia/400.css';
import '@fontsource/old-standard-tt/400.css';
import '@fontsource/old-standard-tt/400-italic.css';
import '@fontsource/old-standard-tt/700.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cachedOnThisDay, loadOnThisDay, OTD_KINDS, OTD_LABELS, prefetchOnThisDay, type OtdFeed, type OtdItem, type OtdKind, type OtdLang } from '../lib/onThisDay';
import { saveSettings, todayStr, useStore } from '../lib/store';

// Ana sayfa bileşeni "Gazete": Wikipedia'dan tarihte bugün, eski gazete sayfası düzeninde.
// Metin sabit yükseklikteki sütunlara akar; taşan sütunlar yan yana yeni sayfalar olur ve
// çerçevenin kenarındaki ‹ › ile çevrilir (sayfa boyu hiç değişmez). Dil (TR/EN) köşeden seçilir, Drive'da saklanır.

export default function OnThisDay() {
  const lang: OtdLang = useStore((s) => s.settings.otdLang) ?? 'tr';
  const L = OTD_LABELS[lang];
  const day = todayStr();
  const [feed, setFeed] = useState<OtdFeed | null>(() => cachedOnThisDay(lang));
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);
  const [geo, setGeo] = useState({ pages: 1, stride: 1, heads: [] as { kind: OtdKind; page: number; atStart: boolean }[] });
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let off = false;
    setFeed(cachedOnThisDay(lang));
    setErr(false);
    setPage(0);
    loadOnThisDay(lang, new Date(), (f) => { if (!off) setFeed(f); })
      .then((f) => { if (!off) { setFeed(f); prefetchOnThisDay(lang); } }, () => { if (!off) setErr(true); });
    return () => { off = true; };
  }, [lang, day]);

  // Sayfa sayısı ve bölüm başlıklarının hangi sayfada olduğu: sütun akışından ölçülür
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const stride = el.clientWidth + gap;
      const left = el.getBoundingClientRect().left - el.scrollLeft;
      const heads = [...el.querySelectorAll<HTMLElement>('[data-kind]')].map((h) => {
        const x = h.getBoundingClientRect().left - left + 1;
        const page = Math.floor(x / stride);
        return { kind: h.dataset.kind as OtdKind, page, atStart: x - page * stride < 8 };
      });
      setGeo({ pages: Math.max(1, Math.ceil((el.scrollWidth + gap) / stride - 0.02)), stride, heads });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [feed]);

  const cur = Math.min(page, geo.pages - 1);
  useEffect(() => { sheet.current?.scrollTo({ left: cur * geo.stride, behavior: 'smooth' }); }, [cur, geo.stride]);

  // Bu sayfadaki bölümler: önceki sayfadan devam eden + burada başlayanlar
  const here = geo.heads.filter((h) => h.page === cur);
  const carried = here[0]?.atStart ? undefined : geo.heads.filter((h) => h.page < cur).at(-1);
  const sections = [...(carried ? [carried] : []), ...here].map((h) => L[h.kind]);

  const setLang = (otdLang: OtdLang) => void saveSettings({ ...useStore.getState().settings, otdLang });
  const date = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const lead = feed?.selected[0];
  const total = feed ? OTD_KINDS.reduce((n, k) => n + feed[k].length, 0) : 0;

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
        <h2>Gazete</h2>
        <div className="otd-sub">{L.sub}</div>
        <div className="otd-dateline">
          <span>{date}</span>
          <span>{sections.join(' · ')}{sections.length ? ' — ' : ''}{L.page} {cur + 1}/{geo.pages}</span>
        </div>
      </header>
      <div className="otd-sheet" ref={sheet}>
        {err && !total ? <p className="otd-msg">{L.error}</p>
          : !feed ? <p className="otd-msg">…</p>
          : !total ? <p className="otd-msg">{L.empty}</p>
          : OTD_KINDS.map((kind) => {
            const items = kind === 'selected' ? feed.selected.slice(1) : feed[kind];
            if (!items.length && !(kind === 'selected' && lead)) return null;
            return (
              <section key={kind} className={`otd-sec ${kind}`}>
                <h4 data-kind={kind}>{L[kind]}</h4>
                {kind === 'selected' && lead && (
                  <article className="otd-lead">
                    {lead.year !== undefined && <div className="otd-year">{lead.year}</div>}
                    <h3><Link it={lead}>{lead.text}</Link></h3>
                    {lead.thumb && <img src={lead.thumb} alt="" />}
                    {lead.extract && <p>{lead.extract}</p>}
                  </article>
                )}
                {items.map((it, i) => (
                  <article key={i} className="otd-item">
                    {kind !== 'holidays' && it.year !== undefined && <span className="otd-year">{it.year}</span>}
                    <Link it={it}>{it.text}</Link>
                  </article>
                ))}
              </section>
            );
          })}
      </div>
      <footer className="otd-foot">{L.source}</footer>
    </div>
  );
}

function Link({ it, children }: { it: OtdItem; children: React.ReactNode }) {
  return it.url ? <a href={it.url} target="_blank" rel="noreferrer" title={it.title}>{children}</a> : <>{children}</>;
}
