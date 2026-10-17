import { useState } from 'react';
import { disableNotifications, enableNotifications, notifyEnabled, showNotification } from '../lib/notify';

/** Ayarlar → Bildirimler (bu cihaza özel) */
export default function NotifySettings() {
  const [on, setOn] = useState(notifyEnabled);
  const [msg, setMsg] = useState('');
  const supported = typeof Notification !== 'undefined';
  return (
    <section>
      <h3>Bildirimler</h3>
      <p className="muted small">
        Etkinliklerden 30 dakika önce, son başvuru ve teslim tarihlerinden bir gün önce ve o sabah 09:00’da bu cihazda bildirim gösterilir.
        Bildirimler Thalamus açıkken (yüklü uygulama olarak arka planda da) çalışır; uygulama tamamen kapalıyken hatırlatma için
        Google Takvim eşitlemesini aç. Bu ayar bu cihaza özeldir.
      </p>
      {!supported ? (
        <p className="muted small">Bu tarayıcı bildirim desteklemiyor. iPhone’da önce Thalamus’u ana ekrana ekle.</p>
      ) : on ? (
        <div className="row">
          <span className="ok small">● Açık</span>
          <button className="btn small" onClick={() => void showNotification({ title: '🔔 Thalamus', body: 'Bildirimler çalışıyor.', noteId: '', key: `test-${Date.now()}` })}>Deneme bildirimi</button>
          <button className="btn small" onClick={() => { disableNotifications(); setOn(false); }}>Kapat</button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => void enableNotifications().then(() => { setOn(true); setMsg(''); }, (e: Error) => setMsg(e.message))}>🔔 Bildirimleri aç</button>
      )}
      {msg && <p className="err small">{msg}</p>}
    </section>
  );
}
