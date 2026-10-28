import { setLocalePref, t, useLocale, type MsgKey } from '../i18n';
import { pluginImage } from '../lib/plugins';
import { go } from '../lib/router';
import './landing.css';

const FEATURES = [
  ['graph', '🕸'],
  ['collections', '📚'],
  ['pdf', '📄'],
  ['review', '🧠'],
  ['daily', '📅'],
  ['offline', '📱'],
] as const;

const PLUGINS = ['stickyShape', 'stickyArt', 'otd', 'drivemeter'] as const;

const REPO = 'https://github.com/SafakSahinn/thalamus';

// Kahraman bölümündeki süs: birbirine bağlı not düğümleri
const NODES: [number, number, string][] = [
  [160, 120, '🧠'], [60, 50, '📚'], [270, 40, '📄'], [290, 190, '🎓'], [50, 200, '🔤'], [175, 250, '📅'],
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [3, 5], [4, 5]];

function Constellation() {
  return (
    <svg className="landing-graph" viewBox="0 0 340 290" aria-hidden="true">
      {EDGES.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
      ))}
      {NODES.map(([x, y, emoji], i) => (
        <g key={i} className="node" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={x} cy={y} r={i === 0 ? 34 : 25} />
          <text x={x} y={y} fontSize={i === 0 ? 30 : 22}>{emoji}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Landing() {
  const locale = useLocale();
  const signIn = () => go('/giris');
  const langToggle = (
    <button className="btn small" onClick={() => void setLocalePref(locale === 'tr' ? 'en' : 'tr')} aria-label={t('landing.language')}>
      {locale === 'tr' ? 'EN' : 'TR'}
    </button>
  );

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="landing-brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} /> Thalamus
        </span>
        <span className="spacer" />
        {langToggle}
        <button className="btn small primary" onClick={signIn}>{t('landing.signIn')}</button>
      </nav>

      <header className="landing-hero">
        <div>
          <p className="landing-eyebrow">{t('landing.eyebrow')}</p>
          <h1>{t('landing.title')}</h1>
          <p className="landing-lead">{t('landing.lead')}</p>
          <div className="landing-actions">
            <button className="btn primary big" onClick={signIn}>{t('landing.signIn')}</button>
            <button className="btn big" onClick={() => document.getElementById('landing-features')?.scrollIntoView({ behavior: 'smooth' })}>
              {t('landing.more')}
            </button>
          </div>
        </div>
        <Constellation />
      </header>

      <section id="landing-features" className="landing-section">
        <h2>{t('landing.featuresTitle')}</h2>
        <div className="landing-features">
          {FEATURES.map(([id, icon]) => (
            <article key={id}>
              <span className="landing-icon">{icon}</span>
              <h3>{t(`landing.features.${id}.title` as MsgKey)}</h3>
              <p>{t(`landing.features.${id}.text` as MsgKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-privacy">
        <h2>🔒 {t('landing.privacyTitle')}</h2>
        <ul>
          {(['p1', 'p2', 'p3', 'p4'] as const).map((k) => <li key={k}>{t(`landing.privacy.${k}`)}</li>)}
        </ul>
      </section>

      <section className="landing-section">
        <h2>🧩 {t('landing.marketTitle')}</h2>
        <p className="landing-sub">{t('landing.marketLead')}</p>
        <div className="landing-plugins">
          {PLUGINS.map((id) => (
            <figure key={id}>
              <img src={`${import.meta.env.BASE_URL}${pluginImage(id, locale)}`} alt="" loading="lazy" />
              <figcaption>
                <b>{t(`plugins.${id}.name`)}</b>
                <span>{t(`plugins.${id}.summary`)}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <h2>{t('landing.ctaTitle')}</h2>
        <button className="btn primary big" onClick={signIn}>{t('landing.signIn')}</button>
      </section>

      <footer className="landing-footer">
        <a href="terms.html">{t('landing.terms')}</a>
        <a href="privacy.html">{t('landing.privacyLink')}</a>
        <a href={REPO} target="_blank" rel="noreferrer">{t('landing.source')}</a>
        <span className="spacer" />
        {langToggle}
      </footer>
    </div>
  );
}
