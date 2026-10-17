import { useEffect, useRef, useState } from 'react';
import { Chip, ComputedValue, NoteChip, PropButton, PropValue, Stars } from '../../components/PropertyPanel';
import { propValue } from '../../lib/compute';
import { fmtDate } from '../../lib/format';
import { resolveFileUrl, useStore } from '../../lib/store';
import { fileRefs, relationIds, uidText, type Note, type PropDef } from '../../lib/types';

/** Salt okunur hücre görünümü */
export function Cell({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  if (def.kind === 'button') return <PropButton note={note} def={def} />;
  if (['formula', 'rollup', 'created', 'updated'].includes(def.kind)) return <ComputedValue note={note} def={def} />;
  const v = def.back ? propValue(note, def, notes) : note.props[def.key];
  if (v === undefined || v === null || v === '') return null;
  switch (def.kind) {
    case 'email': return <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    case 'phone': return <a href={`tel:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    case 'select': return <Chip text={String(v)} def={def} />;
    case 'uid': return <span className="uid">{uidText(def, v)}</span>;
    case 'files': {
      const f = fileRefs(v);
      return f.length ? <span className="muted">📎 {f.length === 1 ? f[0].name : `${f.length} dosya`}</span> : null;
    }
    case 'multiselect': return <>{(v as string[]).map((x) => <Chip key={x} text={x} />)}</>;
    case 'rating': return <Stars value={Number(v)} />;
    case 'date': return <>{fmtDate(v)}</>;
    case 'checkbox': return <>{v ? '✓' : ''}</>;
    case 'url': return <span className="muted">↗</span>;
    case 'relation': {
      const list = relationIds(v).map((id) => notes[id]).filter((n) => n && !n.deleted_at);
      return <>{list.slice(0, 3).map((n) => <NoteChip key={n.id} note={n} />)}{list.length > 3 && <span className="muted"> +{list.length - 3}</span>}</>;
    }
    case 'longtext': return <span className="clip">{String(v)}</span>;
    default: return <>{String(v)}</>;
  }
}

/** Doğrudan tabloda düzenlenebilen alan türleri */
const INLINE = new Set(['text', 'number', 'select', 'date', 'checkbox', 'rating', 'email', 'phone']);

/** Tablo hücresi: basit alanlar yerinde düzenlenir, diğerleri tıklayınca küçük pencerede açılır */
export function EditCell({ note, def }: { note: Note; def: PropDef }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  if (['formula', 'rollup', 'created', 'updated'].includes(def.kind)) return <ComputedValue note={note} def={def} />;
  if (def.kind === 'button') return <PropButton note={note} def={def} />;
  if (INLINE.has(def.kind)) return <div className="cell-edit"><PropValue note={note} def={def} /></div>;
  return (
    <div className="cell-pop-wrap" ref={ref}>
      <div className="cell-view" onClick={() => setOpen(true)}><Cell note={note} def={def} />&nbsp;</div>
      {open && <div className="cell-pop"><PropValue note={note} def={def} /></div>}
    </div>
  );
}

export function Cover({ src, icon }: { src?: string; icon: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (src) resolveFileUrl(src).then(setUrl, () => setUrl(null));
  }, [src]);
  return url ? <img className="cover" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="cover empty">{icon}</div>;
}
