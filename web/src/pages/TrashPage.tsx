import { t } from '../i18n';
import { useState } from 'react';
import { displayTitle, noteIcon, relTime } from '../lib/format';
import { emptyTrash, purgeNote, restoreNote, useStore } from '../lib/store';
import { typeOf } from '../lib/types';

export default function TrashPage() {
  const notes = useStore((s) => s.notes);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const trash = Object.values(notes).filter((n) => n.deleted_at).sort((a, b) => (a.deleted_at! < b.deleted_at! ? 1 : -1));
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <div className="row">
        <h1>{t('pages.trash.title')}</h1>
        <span className="spacer" />
        {trash.length > 0 && !confirmAll && <button className="btn danger small" onClick={() => setConfirmAll(true)}>{t('pages.trash.empty')}</button>}
      </div>
      <p className="muted small">{t('pages.trash.info')}</p>
      {confirmAll && (
        <div className="danger-box">
          <p>{t('pages.trash.confirmAll', { count: trash.length })}</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmAll(false)} disabled={busy}>{t('common.cancel')}</button>
            <button className="btn danger" disabled={busy} onClick={() => void run(async () => { await emptyTrash(); setConfirmAll(false); })}>{busy ? t('pages.trash.deleting') : t('pages.trash.purge')}</button>
          </div>
        </div>
      )}
      {!trash.length && <p className="muted">{t('pages.trash.none')}</p>}
      <div className="list">
        {trash.map((n) => (
          <div key={n.id} className="rowlink">
            <span>{noteIcon(n)}</span>
            <a className="grow" href={`#/n/${n.id}`}>{displayTitle(n)} <span className="muted small">· {typeOf(n.type).label}</span></a>
            <span className="muted small">{relTime(n.deleted_at!)}</span>
            <button className="btn small" disabled={busy} onClick={() => restoreNote(n.id)}>{t('pages.trash.restore')}</button>
            <button className="btn small ghost danger" disabled={busy} title={t('pages.trash.purge')} onClick={() => {
              if (confirm(t('pages.trash.confirmOne', { title: displayTitle(n) }))) void run(() => purgeNote(n.id));
            }}>{t('pages.trash.purgeOne')}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
