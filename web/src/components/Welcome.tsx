import { t } from '../i18n';
import { useState } from 'react';
import { setAnnouncements, useStore } from '../lib/store';
import { startTour } from './Tour';

const points = () => [
  { icon: '📚', title: t('panels.welcome.p1Title'), text: t('panels.welcome.p1') },
  { icon: '🕸', title: t('panels.welcome.p2Title'), text: t('panels.welcome.p2') },
  { icon: '🔤', title: t('panels.welcome.p3Title'), text: t('panels.welcome.p3') },
  { icon: '🔒', title: t('panels.welcome.p4Title'), text: t('panels.welcome.p4') },
];

/** Yeni kayıt olan kullanıcıya bir kez: kısa tanıtım ve duyuru e-postası tercihi. */
export default function Welcome() {
  const welcome = useStore((s) => s.welcome);
  const name = useStore((s) => s.account?.name);
  const [news, setNews] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tour, setTour] = useState(true);
  if (!welcome) return null;

  const start = async () => {
    setBusy(true);
    try {
      if (news) await setAnnouncements(true);
      useStore.setState({ welcome: false });
      if (tour) startTour();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal-back">
      <div className="modal welcome" role="dialog" aria-label={t('panels.welcome.aria')}>
        <div className="welcome-hero">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={76} height={76} />
          <h2>{name ? t('panels.welcome.helloName', { name: name.split(' ')[0] }) : t('panels.welcome.hello')}</h2>
          <p>{t('panels.welcome.intro')}</p>
        </div>
        <div className="welcome-points">
          {points().map((p) => (
            <div key={p.title} className="wpoint">
              <span className="wicon">{p.icon}</span>
              <div>
                <b>{p.title}</b>
                <div className="muted small">{p.text}</div>
              </div>
            </div>
          ))}
        </div>
        <label className="welcome-news">
          <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} />
          <span>
            {t('panels.welcome.news')}
            <span className="muted small">{t('panels.welcome.newsHint')}</span>
          </span>
        </label>
        <label className="welcome-news">
          <input type="checkbox" checked={tour} onChange={(e) => setTour(e.target.checked)} />
          <span>
            {t('panels.welcome.tour')}
            <span className="muted small">{t('panels.welcome.tourHint')}</span>
          </span>
        </label>
        {err && <p className="err small">{err}</p>}
        <button className="btn primary welcome-go" onClick={() => void start()} disabled={busy}>
          {busy ? t('panels.welcome.saving') : t('panels.welcome.go')}
        </button>
      </div>
    </div>
  );
}
