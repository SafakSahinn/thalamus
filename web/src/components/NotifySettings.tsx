import { t } from '../i18n';
import { useState } from 'react';
import { disableNotifications, enableNotifications, notifyEnabled, showNotification } from '../lib/notify';

/** Ayarlar → Bildirimler (bu cihaza özel) */
export default function NotifySettings() {
  const [on, setOn] = useState(notifyEnabled);
  const [msg, setMsg] = useState('');
  const supported = typeof Notification !== 'undefined';
  return (
    <section>
      <h3>{t('panels.notify.title')}</h3>
      <p className="muted small">{t('panels.notify.hint')}</p>
      {!supported ? (
        <p className="muted small">{t('panels.notify.unsupported')}</p>
      ) : on ? (
        <div className="row">
          <span className="ok small">{t('panels.notify.on')}</span>
          <button className="btn small" onClick={() => void showNotification({ title: '🔔 Thalamus', body: t('panels.notify.testBody'), noteId: '', key: `test-${Date.now()}` })}>{t('panels.notify.test')}</button>
          <button className="btn small" onClick={() => { disableNotifications(); setOn(false); }}>{t('panels.notify.off')}</button>
        </div>
      ) : (
        <button className="btn primary" onClick={() => void enableNotifications().then(() => { setOn(true); setMsg(''); }, (e: Error) => setMsg(e.message))}>{t('panels.notify.enable')}</button>
      )}
      {msg && <p className="err small">{msg}</p>}
    </section>
  );
}
