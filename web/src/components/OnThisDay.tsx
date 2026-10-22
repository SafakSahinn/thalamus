import { useEffect, useMemo, useState } from 'react';
import { fetchOnThisDay, OTD_LABELS, paginate, type OtdFeed, type OtdItem, type OtdLang } from '../lib/onThisDay';
import { saveSettings, todayStr, useStore } from '../lib/store';

// Ana sayfa bileşeni: Wikipedia'dan "tarihte bugün", gazete sayfası düzeninde.
// Dil (TR/EN) köşedeki düğmeyle değişir ve ayarlarda (Drive) saklanır; sayfalar çerçevenin kenarındaki ‹ › ile çevrilir.

const PER_PAGE = 8;

export default function OnThisDay() {
  const lang: OtdLang = useStore((s) => s.settings.otdLang) ?? 'tr';
  const L = OTD_LABELS[lang];
  const day = todayStr();
  const [feed, setFeed] = useState<OtdFeed | null>(null);
  const [err, setErr] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let off = false;
    setFeed(null);
    setErr(false);
    setPage(0);
    fetchOnThisDay(lang).then((f) => { if (!off) setFeed(f); }, () => { if (!off) setErr(true); });
    return () => { off = true; };
  }, [lang, day]);

  const pages = useMemo(() => (feed ? paginate(feed, PER_PAGE) : []), [feed]);
  const cur = pages[Math.min(page, pages.length - 1)];
  const setLang = (otdLang: OtdLang) => void saveSettings({ ...useStore.getState().settings, otdLang });
  const date = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="otd">
      <button className="otd-nav prev" disabled={page <= 0} title={L.prev} aria-label={L.prev} onClick={() => setPage((p) => p - 1)}>‹</button>
      <button className="otd-nav next" disabled={page >= pages.length - 1} title={L.next} aria-label={L.next} onClick={() => setPage((p) => p + 1)}>›</button>
      <div className="otd-lang" role="group" aria-label="Dil / Language">
        {(['tr', 'en'] as const).map((l) => (
          <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <header className="otd-mast">
        <h2>{L.title}</h2>
        <div className="otd-dateline">
          <span>{date}</span>
          {cur && <span>{L[cur.kind]} · {L.page} {page + 1}/{pages.length}</span>}
        </div>
      </header>
      {err ? <p className="muted small otd-msg">{lang === 'tr' ? 'Vikipedi’ye ulaşılamadı.' : 'Could not reach Wikipedia.'}</p>
        : !feed ? <p className="muted small otd-msg">…</p>
        : !cur ? <p className="muted small otd-msg">{L.empty}</p>
        : <OtdPage items={cur.items} lead={cur.kind === 'selected' && page === 0} holiday={cur.kind === 'holidays'} />}
      <footer className="otd-foot muted small">{L.source}</footer>
    </div>
  );
}

function OtdPage({ items, lead, holiday }: { items: OtdItem[]; lead: boolean; holiday: boolean }) {
  const [first, ...rest] = lead ? items : [undefined, ...items];
  return (
    <>
      {first && (
        <article className="otd-lead">
          {first.thumb && <img src={first.thumb} alt="" loading="lazy" />}
          <div>
            {first.year !== undefined && <div className="otd-year">{first.year}</div>}
            <h3><Link it={first}>{first.text}</Link></h3>
            {first.extract && <p>{first.extract}</p>}
          </div>
        </article>
      )}
      <div className="otd-cols">
        {rest.map((it, i) => (
          <article key={i} className="otd-item">
            {!holiday && it!.year !== undefined && <span className="otd-year">{it!.year}</span>}
            <Link it={it!}>{it!.text}</Link>
          </article>
        ))}
      </div>
    </>
  );
}

function Link({ it, children }: { it: OtdItem; children: React.ReactNode }) {
  return it.url ? <a href={it.url} target="_blank" rel="noreferrer" title={it.title}>{children}</a> : <>{children}</>;
}
