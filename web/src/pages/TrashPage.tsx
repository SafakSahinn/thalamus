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
        <h1>🗑 Çöp kutusu</h1>
        <span className="spacer" />
        {trash.length > 0 && !confirmAll && <button className="btn danger small" onClick={() => setConfirmAll(true)}>Çöpü boşalt</button>}
      </div>
      <p className="muted small">Çöpe atılan notlar 30 gün sonra kendiliğinden kalıcı olarak silinir. Kalıcı silinen not Drive’ından ve bütün cihazlarından kaldırılır, geri getirilemez.</p>
      {confirmAll && (
        <div className="danger-box">
          <p>Çöpteki <b>{trash.length}</b> not kalıcı olarak silinsin mi? Bu geri alınamaz.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmAll(false)} disabled={busy}>Vazgeç</button>
            <button className="btn danger" disabled={busy} onClick={() => void run(async () => { await emptyTrash(); setConfirmAll(false); })}>{busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}</button>
          </div>
        </div>
      )}
      {!trash.length && <p className="muted">Çöp kutusu boş.</p>}
      <div className="list">
        {trash.map((n) => (
          <div key={n.id} className="rowlink">
            <span>{noteIcon(n)}</span>
            <a className="grow" href={`#/n/${n.id}`}>{displayTitle(n)} <span className="muted small">· {typeOf(n.type).label}</span></a>
            <span className="muted small">{relTime(n.deleted_at!)}</span>
            <button className="btn small" disabled={busy} onClick={() => restoreNote(n.id)}>Geri yükle</button>
            <button className="btn small ghost danger" disabled={busy} title="Kalıcı olarak sil" onClick={() => {
              if (confirm(`"${displayTitle(n)}" kalıcı olarak silinsin mi? Geri getirilemez.`)) void run(() => purgeNote(n.id));
            }}>Kalıcı sil</button>
          </div>
        ))}
      </div>
    </div>
  );
}
