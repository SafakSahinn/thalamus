import { useMemo, useState } from 'react';
import { displayTitle, noteIcon } from '../lib/format';
import { searchNotes } from '../lib/search';
import { setProp, useIndex } from '../lib/store';
import { relationIds, typeOf, type Note } from '../lib/types';

/** Notu başka bir sayfanın altına taşı (ya da en üst düzeye çıkar) */
export default function MoveDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const { alive } = useIndex();
  const [q, setQ] = useState('');
  // Kendisi ve alt sayfaları hedef olamaz (döngü olmasın)
  const blocked = useMemo(() => {
    const out = new Set([note.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of alive) {
        if (!out.has(n.id) && relationIds(n.props.parent).some((p) => out.has(p))) {
          out.add(n.id);
          grew = true;
        }
      }
    }
    return out;
  }, [alive, note.id]);
  const list = searchNotes(alive, q, { limit: 40, exclude: blocked }).filter((n) => n.type !== 'daily');
  const current = relationIds(note.props.parent)[0];
  const move = (parent: string | undefined) => {
    setProp(note.id, 'parent', parent ? [parent] : undefined);
    onClose();
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-label="Taşı">
        <input autoFocus value={q} placeholder={`“${displayTitle(note)}” şunun altına taşınsın…`} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
        <div className="palette-list">
          {current && (
            <button type="button" onClick={() => move(undefined)}>
              <span className="ic">⤒</span><span className="lb">En üst düzeye çıkar (üst sayfası olmasın)</span>
            </button>
          )}
          {list.map((n) => (
            <button key={n.id} type="button" className={n.id === current ? 'sel' : ''} onClick={() => move(n.id)}>
              <span className="ic">{noteIcon(n)}</span>
              <span className="lb">{displayTitle(n)}</span>
              <span className="hint">{n.id === current ? 'şu anki üst sayfa' : typeOf(n.type).label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
