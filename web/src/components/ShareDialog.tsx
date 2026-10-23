import { t } from '../i18n';
import { useState } from 'react';
import { cloud } from '../lib/google';
import { publishShare, shareUrl, unpublishShare } from '../lib/share';
import { useStore } from '../lib/store';
import type { Note } from '../lib/types';

export default function ShareDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const account = useStore((s) => s.account);
  const live = useStore((s) => s.notes[note.id]) ?? note;
  const id = live.props.__share as string | undefined;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl(id!));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal prompt share-dialog" role="dialog" aria-label={t('dialogs.share.aria')}>
        <div className="row"><h3>{t('dialogs.share.title')}</h3><span className="spacer" /><button className="iconbtn" onClick={onClose} aria-label={t('common.close')}>×</button></div>
        {!cloud || !account ? (
          <p className="muted">{t('dialogs.share.needLogin')}</p>
        ) : id ? (
          <>
            <p>{t('dialogs.share.live')}</p>
            <div className="row">
              <input className="grow share-link" readOnly value={shareUrl(id)} onFocus={(e) => e.target.select()} />
              <button className="btn" onClick={() => void copy()}>{copied ? t('dialogs.share.copied') : t('common.copy')}</button>
            </div>
            <p className="muted small">{t('dialogs.share.liveHint')}</p>
            <div className="row end">
              <a className="btn ghost" href={shareUrl(id)} target="_blank" rel="noopener noreferrer">{t('dialogs.share.openPage')}</a>
              <button className="btn danger" disabled={busy} onClick={() => void run(() => unpublishShare(live))}>{busy ? '…' : t('dialogs.share.unpublish')}</button>
            </div>
          </>
        ) : (
          <>
            <p>{t('dialogs.share.intro')}</p>
            <ul className="muted small">
              <li>{t('dialogs.share.li1')}</li>
              <li>{t('dialogs.share.li2')}</li>
              <li>{t('dialogs.share.li3')}</li>
            </ul>
            <div className="row end">
              <button className="btn ghost" onClick={onClose}>{t('common.cancel')}</button>
              <button className="btn primary" disabled={busy} onClick={() => void run(() => publishShare(live))}>{busy ? t('dialogs.share.publishing') : t('dialogs.share.publish')}</button>
            </div>
          </>
        )}
        {err && <p className="err small">{err}</p>}
      </div>
    </div>
  );
}
