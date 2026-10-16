import { useState } from 'react';
import { setAnnouncements, useStore } from '../lib/store';

/** Yeni kayıt olan kullanıcıya bir kez: duyuru e-postası tercihi. */
export default function Welcome() {
  const welcome = useStore((s) => s.welcome);
  const name = useStore((s) => s.account?.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!welcome) return null;
  const close = () => useStore.setState({ welcome: false });
  const yes = async () => {
    setBusy(true);
    try {
      await setAnnouncements(true);
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="modal-back">
      <div className="modal prompt welcome" role="dialog" aria-label="Hoş geldin">
        <h3>Hoş geldin{name ? `, ${name.split(' ')[0]}` : ''}!</h3>
        <p>Notların Google Drive’ındaki <b>Thalamus</b> klasöründe saklanacak.</p>
        <p>Thalamus’a yeni özellikler geldiğinde ara sıra e-posta almak ister misin? İstediğin zaman Ayarlar’dan kapatabilirsin.</p>
        {err && <p className="err small">{err}</p>}
        <div className="row end">
          <button className="btn ghost" onClick={close} disabled={busy}>Hayır, teşekkürler</button>
          <button className="btn primary" onClick={() => void yes()} disabled={busy}>Evet, haber ver</button>
        </div>
      </div>
    </div>
  );
}
