import { displayTitle, relTime, noteIcon } from '../lib/format';
import { restoreNote, useStore } from '../lib/store';
import { typeOf } from '../lib/types';

export default function TrashPage() {
  const notes = useStore((s) => s.notes);
  const trash = Object.values(notes).filter((n) => n.deleted_at).sort((a, b) => (a.deleted_at! < b.deleted_at! ? 1 : -1));
  return (
    <div className="page">
      <h1>🗑 Çöp kutusu</h1>
      {!trash.length && <p className="muted">Çöp kutusu boş.</p>}
      <div className="list">
        {trash.map((n) => (
          <div key={n.id} className="rowlink">
            <span>{noteIcon(n)}</span>
            <a className="grow" href={`#/n/${n.id}`}>{displayTitle(n)}</a>
            <span className="muted small">{relTime(n.deleted_at!)}</span>
            <button className="btn small" onClick={() => restoreNote(n.id)}>Geri yükle</button>
          </div>
        ))}
      </div>
    </div>
  );
}
