import { useEffect, useState } from 'react';
import { authErrorText, preloadGoogle, signInWithGoogle } from '../lib/google';
import { onSignedIn, useStore } from '../lib/store';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const syncError = useStore((s) => s.sync.error);

  useEffect(preloadGoogle, []);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSignedIn(await signInWithGoogle());
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={64} height={64} />
        <h1>Thalamus</h1>
        <p className="muted">Kitapların, makalelerin, derslerin ve kelimelerin; tek yerde ve birbirine bağlı.</p>
        <ul className="login-points">
          <li>Notların <b>kendi Google Drive’ında</b> saklanır; biz göremeyiz.</li>
          <li>Telefonda ve bilgisayarda aynı notlar, internetsiz de çalışır.</li>
          <li>Ücretsiz.</li>
        </ul>
        {syncError && <p className="err small">{syncError}</p>}
        <button className="btn google" onClick={() => void go()} disabled={busy}>
          <GoogleLogo /> {busy ? 'Bağlanıyor…' : 'Google ile devam et'}
        </button>
        {err && <p className="err small">{err}</p>}
        <p className="muted small">
          Devam ederek <a href="#/kosullar">Kullanım Koşulları</a>’nı kabul etmiş olursun. Hesabın için yalnızca e-posta adresin,
          kayıt tarihin ve son kullanım zamanın tutulur: <a href="#/gizlilik">Gizlilik ve KVKK Aydınlatma Metni</a>.
        </p>
      </div>
    </div>
  );
}
