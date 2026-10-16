import { lazy, Suspense, useMemo, useState } from 'react';
import PageDecor, { noteIcon } from '../components/PageDecor';
import PropertyPanel, { NoteChip } from '../components/PropertyPanel';
import NoteEditor from '../editor/Editor';
import { displayTitle, relTime } from '../lib/format';
import { linkVia, snippetAround } from '../lib/links';
import { go } from '../lib/router';
import { createNote, deleteNote, restoreNote, updateNote, useIndex, useStore } from '../lib/store';
import { exportNoteMd, printNote } from '../lib/exporter';
import { applyTemplate, isTemplate, saveAsTemplate, templatesFor } from '../lib/templates';
import { relationIds, TYPES, typeOf, type Note, type TypeId } from '../lib/types';

/** Üst sayfa zinciri (en üstten başlayarak) */
function useAncestors(note: Note) {
  const notes = useStore((s) => s.notes);
  const out: Note[] = [];
  const seen = new Set([note.id]);
  let cur = relationIds(note.props.parent)[0];
  while (cur && !seen.has(cur) && notes[cur] && !notes[cur].deleted_at) {
    seen.add(cur);
    out.unshift(notes[cur]);
    cur = relationIds(notes[cur].props.parent)[0];
  }
  return out;
}

/** Boş notta "Şablondan başla" seçenekleri */
function TemplateStarter({ note }: { note: Note }) {
  const notes = useStore((s) => s.notes);
  const tpls = templatesFor(note.type, notes).filter((x) => x.noteId !== note.id);
  if (!tpls.length) return null;
  return (
    <div className="tpl-starter">
      <span className="muted small">Şablondan başla:</span>
      {tpls.map((tp) => (
        <button key={tp.id} type="button" className="btn small ghost" onClick={() => applyTemplate(note, tp)}>{tp.icon} {tp.name}</button>
      ))}
    </div>
  );
}

function SubPages({ note }: { note: Note }) {
  const { alive } = useIndex();
  const kids = alive.filter((n) => relationIds(n.props.parent).includes(note.id)).sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  return (
    <section className="subpages">
      {kids.length > 0 && <h3>Alt sayfalar <span className="count">{kids.length}</span></h3>}
      <div className="list">
        {kids.map((k) => (
          <a key={k.id} className="rowlink" href={`#/n/${k.id}`}><span>{noteIcon(k)}</span><span className="grow">{displayTitle(k)}</span></a>
        ))}
      </div>
      <button type="button" className="linkbtn muted small" onClick={() => go(`/n/${createNote('note', '', { parent: [note.id] }).id}`)}>＋ Alt sayfa ekle</button>
    </section>
  );
}

const GraphView = lazy(() => import('../components/GraphView'));

export function Backlinks({ note }: { note: Note }) {
  const notes = useStore((s) => s.notes);
  const { backlinks } = useIndex();
  const sources = (backlinks.get(note.id) ?? []).map((id) => notes[id]).filter(Boolean);
  if (!sources.length) return null;
  const groups = new Map<TypeId, Note[]>();
  for (const s of sources) groups.set(s.type, [...(groups.get(s.type) ?? []), s]);
  const label = note.type === 'word' ? 'Geçtiği kaynaklar' : 'Bu nota bağlananlar';
  return (
    <section className="backlinks">
      <h3>{label} <span className="count">{sources.length}</span></h3>
      {[...groups].map(([type, list]) => (
        <div key={type} className="bl-group">
          <div className="bl-type">{typeOf(type).icon} {typeOf(type).plural}</div>
          {list.map((s) => {
            const via = linkVia(s, note.id);
            const snip = via ? null : snippetAround(s, displayTitle(note));
            return (
              <a key={s.id} className="bl-item" href={`#/n/${s.id}`}>
                <span className="bl-title">{displayTitle(s)}</span>
                {via && <span className="muted small"> · {via}</span>}
                {snip && <span className="bl-snip">{snip}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </section>
  );
}

/** Notun 2 adım çevresindeki notlar */
function LocalGraph({ note }: { note: Note }) {
  const notes = useStore((s) => s.notes);
  const { backlinks } = useIndex();
  const subset = useMemo(() => {
    const seen = new Set([note.id]);
    let frontier = [note.id];
    for (let depth = 0; depth < 2; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        const n = notes[id];
        for (const x of [...(n?.links ?? []), ...(backlinks.get(id) ?? [])]) {
          if (!seen.has(x) && notes[x] && !notes[x].deleted_at && notes[x].type !== 'daily') {
            seen.add(x);
            next.push(x);
          }
        }
      }
      frontier = next;
      if (seen.size > 120) break;
    }
    return [...seen].map((id) => notes[id]).filter(Boolean);
  }, [note.id, notes, backlinks]);
  if (subset.length < 2) return <p className="muted small">Henüz bağlantı yok. Metinde <code>[[</code> yazarak ya da yukarıdaki alanlardan bağlantı ekleyebilirsin.</p>;
  return (
    <Suspense fallback={<div className="graph local" />}>
      <GraphView notes={subset} focusId={note.id} onOpen={(id) => go(`/n/${id}`)} className="local" />
    </Suspense>
  );
}

export default function NotePage({ id }: { id: string }) {
  const note = useStore((s) => s.notes[id]);
  const rev = useStore((s) => s.remoteRev[id]);
  const ready = useStore((s) => s.ready);
  const [menu, setMenu] = useState(false);
  const [graphOpen, setGraphOpen] = useState(() => localStorage.getItem('localGraph') !== '0');

  if (!note) return <div className="page"><p className="muted">{ready ? 'Not bulunamadı.' : 'Yükleniyor…'}</p></div>;
  const t = typeOf(note.type);

  return (
    <div className="page note-page">
      <PageDecor note={note} />
      {isTemplate(note) && (
        <div className="banner">
          🧩 Bu bir <b>şablon</b>. {typeOf(note.type).plural} koleksiyonunda “+ Yeni ▾” menüsünden kullanılır; başlığı şablonun adıdır.
        </div>
      )}
      {note.deleted_at && (
        <div className="banner warn">
          Bu not çöp kutusunda. <button className="btn small" onClick={() => restoreNote(note.id)}>Geri yükle</button>
        </div>
      )}
      <div className="note-head">
        <Crumbs note={note} />
        <a className="typechip" href={`#/c/${note.type}`} style={{ '--c': t.color } as React.CSSProperties}>{t.icon} {t.label}</a>
        <span className="muted small">düzenlendi {relTime(note.updated_at)}</span>
        <span className="spacer" />
        <button className={`iconbtn ${note.pinned ? 'on' : ''}`} title={note.pinned ? 'Sabitlemeyi kaldır' : 'Kenar çubuğuna sabitle'} onClick={() => updateNote(note.id, { pinned: !note.pinned })}>📌</button>
        <div className="menuwrap">
          <button className="iconbtn" onClick={() => setMenu((m) => !m)} title="Diğer">⋯</button>
          {menu && (
            <div className="dropdown" onMouseLeave={() => setMenu(false)}>
              <label className="muted small">Tipi değiştir</label>
              <select value={note.type} onChange={(e) => { updateNote(note.id, { type: e.target.value as TypeId }); setMenu(false); }}>
                {TYPES.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.label}</option>)}
              </select>
              <button className="btn small" onClick={() => { exportNoteMd(note); setMenu(false); }}>⬇ Markdown olarak indir</button>
              <button className="btn small" onClick={() => { setMenu(false); setTimeout(printNote, 50); }}>🖨 Yazdır / PDF</button>
              {!isTemplate(note) && note.type !== 'daily' && (
                <button className="btn small" onClick={() => { const tpl = saveAsTemplate(note); setMenu(false); go(`/n/${tpl.id}`); }}>🧩 Şablon olarak kaydet</button>
              )}
              {!note.deleted_at && (
                <button className="btn danger small" onClick={() => { deleteNote(note.id); setMenu(false); history.back(); }}>Çöp kutusuna taşı</button>
              )}
            </div>
          )}
        </div>
      </div>

      {note.type === 'daily' ? (
        <h1 className="title static">{displayTitle(note)}</h1>
      ) : (
        <input
          key={note.id}
          className="title"
          defaultValue={note.title}
          placeholder="Başlık"
          autoFocus={!note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
        />
      )}

      <PropertyPanel note={note} />
      {!note.content && !isTemplate(note) && note.type !== 'daily' && <TemplateStarter note={note} />}

      <NoteEditor
        docKey={note.id}
        noteId={note.id}
        content={note.content}
        rev={rev}
        onChange={(doc) => updateNote(note.id, { content: doc })}
      />

      <SubPages note={note} />

      <Backlinks note={note} />

      <section className="localgraph">
        <h3>
          <button className="linkbtn" onClick={() => { setGraphOpen(!graphOpen); localStorage.setItem('localGraph', graphOpen ? '0' : '1'); }}>
            {graphOpen ? '▾' : '▸'} Bağlantı haritası
          </button>
        </h3>
        {graphOpen && <LocalGraph note={note} />}
      </section>
      <div className="note-foot">
        {note.links.length > 0 && (
          <div className="outlinks">
            <span className="muted small">Bağlantı verdiği notlar:</span>
            <OutLinks note={note} />
          </div>
        )}
      </div>
    </div>
  );
}

function OutLinks({ note }: { note: Note }) {
  const notes = useStore((s) => s.notes);
  return (
    <>
      {note.links.map((id) => notes[id]).filter((n) => n && !n.deleted_at).map((n) => <NoteChip key={n.id} note={n} />)}
    </>
  );
}

function Crumbs({ note }: { note: Note }) {
  const up = useAncestors(note);
  if (!up.length) return null;
  return (
    <nav className="crumbs" aria-label="Üst sayfalar">
      {up.map((a) => (
        <span key={a.id}><a href={`#/n/${a.id}`}>{noteIcon(a)} {displayTitle(a)}</a> › </span>
      ))}
    </nav>
  );
}
