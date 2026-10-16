import { useEffect, useMemo, useState } from 'react';
import { Chip, ComputedValue, NoteChip, Stars } from '../components/PropertyPanel';
import TypeEditor from '../components/TypeEditor';
import { displayTitle, fmtDate, relTime } from '../lib/format';
import { norm } from '../lib/links';
import { go } from '../lib/router';
import { createNote, resolveFileUrl, useIndex, useStore } from '../lib/store';
import { relationIds, typeOf, type Note, type PropDef } from '../lib/types';

export function Cell({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  if (['formula', 'rollup', 'created', 'updated'].includes(def.kind)) return <ComputedValue note={note} def={def} />;
  const v = note.props[def.key];
  if (v === undefined || v === null || v === '') return null;
  switch (def.kind) {
    case 'email': return <a href={`mailto:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    case 'phone': return <a href={`tel:${v}`} onClick={(e) => e.stopPropagation()}>{String(v)}</a>;
    case 'select': return <Chip text={String(v)} />;
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

function Cover({ src, icon }: { src?: string; icon: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (src) resolveFileUrl(src).then(setUrl, () => setUrl(null));
  }, [src]);
  return url ? <img className="cover" src={url} alt="" loading="lazy" /> : <div className="cover empty">{icon}</div>;
}

type SortKey = 'updated' | 'title' | string;

export default function CollectionPage({ type, edit }: { type: string; edit?: boolean }) {
  const t = typeOf(type);
  const [editing, setEditing] = useState(Boolean(edit));
  const { alive } = useIndex();
  const pref = `view:${t.id}`;
  const [view, setView] = useState<'table' | 'cards'>(() => (localStorage.getItem(pref) as 'table' | 'cards') ?? (t.cover ? 'cards' : 'table'));
  const [q, setQ] = useState('');
  const statusDef = t.props.find((p) => p.kind === 'select');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortKey>(t.sort ?? 'updated');
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    setQ('');
    setStatus('');
    setSort(t.sort ?? 'updated');
    setAsc(false);
    setView((localStorage.getItem(`view:${t.id}`) as 'table' | 'cards') ?? (t.cover ? 'cards' : 'table'));
  }, [t]);

  const list = useMemo(() => {
    const nq = norm(q);
    const rows = alive.filter((n) => n.type === t.id
      && (!status || n.props[statusDef!.key] === status)
      && (!nq || norm(displayTitle(n)).includes(nq) || norm(n.text).includes(nq)));
    const key = (n: Note): string | number => {
      if (sort === 'updated') return n.updated_at;
      if (sort === 'title') return norm(displayTitle(n));
      const v = n.props[sort];
      return typeof v === 'number' ? v : typeof v === 'string' ? v : '';
    };
    rows.sort((a, b) => {
      const x = key(a), y = key(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort === 'title' ? (asc ? -c : c) : asc ? c : -c;
    });
    return rows;
  }, [alive, t, q, status, statusDef, sort, asc]);

  const cols = t.props.filter((p) => p.table);
  const sortable = t.props.filter((p) => ['date', 'number', 'rating', 'text', 'select'].includes(p.kind));
  const newNote = () => {
    const props: Record<string, unknown> = status && statusDef ? { [statusDef.key]: status } : {};
    go(`/n/${createNote(t.id, '', props).id}`);
  };

  return (
    <div className="page wide">
      {editing && <TypeEditor typeId={t.id} onClose={() => { setEditing(false); if (edit) history.replaceState(null, '', `#/c/${t.id}`); }} />}
      <div className="coll-head">
        <h1>{t.icon} {t.plural} <span className="count">{list.length}</span></h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setEditing(true)} title="Koleksiyonun adını, simgesini ve alanlarını düzenle">⚙ Alanlar</button>
        <button className="btn primary" onClick={newNote}>+ Yeni {t.label.toLocaleLowerCase('tr')}</button>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Bu koleksiyonda ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        {statusDef && (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{statusDef.label}: tümü</option>
            {statusDef.options?.map((o) => <option key={o}>{o}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Son düzenlenen</option>
          <option value="title">Ada göre</option>
          {sortable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <button className="iconbtn" title="Sıralama yönü" onClick={() => setAsc(!asc)}>{asc ? '↑' : '↓'}</button>
        <div className="seg">
          {(['table', 'cards'] as const).map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); localStorage.setItem(pref, v); }}>
              {v === 'table' ? '☰ Tablo' : '▦ Kart'}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p>Henüz {t.label.toLocaleLowerCase('tr')} yok.</p>
          <button className="btn" onClick={newNote}>İlkini ekle</button>
        </div>
      ) : view === 'table' ? (
        <div className="tablewrap">
          <table className="dbtable">
            <thead>
              <tr>
                <th>Ad</th>
                {cols.map((c) => <th key={c.key}>{c.label}</th>)}
                <th>Düzenlendi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id} onClick={() => go(`/n/${n.id}`)}>
                  <td className="tname">{n.pinned && '📌 '}{displayTitle(n)}</td>
                  {cols.map((c) => <td key={c.key} onClick={c.kind === 'relation' ? (e) => (e.target as HTMLElement).closest('a') && e.stopPropagation() : undefined}><Cell note={n} def={c} /></td>)}
                  <td className="muted small">{relTime(n.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cards">
          {list.map((n) => (
            <a key={n.id} className="card" href={`#/n/${n.id}`}>
              {t.cover && <Cover src={n.props[t.cover] as string | undefined} icon={t.icon} />}
              <div className="card-body">
                <div className="card-title">{displayTitle(n)}</div>
                {cols.slice(0, 3).map((c) => (n.props[c.key] !== undefined ? <div key={c.key} className="card-prop"><Cell note={n} def={c} /></div> : null))}
                {!t.cover && n.text && <div className="card-snip">{n.text.slice(0, 140)}</div>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
