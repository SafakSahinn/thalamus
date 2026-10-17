import { useState } from 'react';
import { setAnnouncements, useStore } from '../lib/store';

const POINTS = [
  { icon: '📚', title: 'Her şey tek yerde', text: 'Kitaplar, makaleler, dersler, filmler, söyleşiler ve günlüğün.' },
  { icon: '🕸', title: 'Birbirine bağlı', text: 'Metinde [[ yaz, notlarını bağla; haritada nasıl birleştiklerini gör.' },
  { icon: '🔤', title: 'Ortak sözlük', text: 'Okurken eklediğin kelimeler, geçtikleri bütün kaynaklarla birlikte toplanır.' },
  { icon: '🔒', title: 'Notların senin', text: 'Hepsi Google Drive’ındaki Thalamus klasöründe; sunucumuza gelmez.' },
];

/** Yeni kayıt olan kullanıcıya bir kez: kısa tanıtım ve duyuru e-postası tercihi. */
export default function Welcome() {
  const welcome = useStore((s) => s.welcome);
  const name = useStore((s) => s.account?.name);
  const [news, setNews] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!welcome) return null;

  const start = async () => {
    setBusy(true);
    try {
      if (news) await setAnnouncements(true);
      useStore.setState({ welcome: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="modal-back">
      <div className="modal welcome" role="dialog" aria-label="Thalamus’a hoş geldin">
        <div className="welcome-hero">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={76} height={76} />
          <h2>Hoş geldin{name ? `, ${name.split(' ')[0]}` : ''}!</h2>
          <p>Thalamus, beynin bilgileri birbirine bağlayan merkezi gibi, okuduğun ve öğrendiğin her şeyi birbirine bağlar.</p>
        </div>
        <div className="welcome-points">
          {POINTS.map((p) => (
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
            Yeni özellikler geldiğinde ara sıra e-posta almak istiyorum
            <span className="muted small"> · İstediğin zaman Ayarlar’dan kapatabilirsin.</span>
          </span>
        </label>
        {err && <p className="err small">{err}</p>}
        <button className="btn primary welcome-go" onClick={() => void start()} disabled={busy}>
          {busy ? 'Kaydediliyor…' : 'Başlayalım →'}
        </button>
      </div>
    </div>
  );
}
