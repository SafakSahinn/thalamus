import { useMemo, useRef, useState } from 'react';
import { displayTitle, optionHue } from '../lib/format';
import { noteHref } from '../lib/router';
import { findByTitle, searchNotes } from '../lib/search';
import { createNote, resolveFileUrl, setProp, uploadFile, useIndex, useStore } from '../lib/store';
import { relationIds, typeOf, TYPE_MAP, type Note, type PropDef } from '../lib/types';

export function Chip({ text }: { text: string }) {
  return <span className="chip" style={{ '--h': optionHue(text) } as React.CSSProperties}>{text}</span>;
}

export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className={`stars ${onChange ? 'edit' : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= value ? 'on' : ''} onClick={onChange && (() => onChange(i === value ? 0 : i))}>★</span>
      ))}
    </span>
  );
}

/** Not bağlantı rozeti */
export function NoteChip({ note }: { note: Note }) {
  return (
    <a className="notechip" href={noteHref(note.id)}>
      <span>{typeOf(note.type).icon}</span>
      {displayTitle(note)}
    </a>
  );
}

function RelationInput({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  const { alive } = useIndex();
  const ids = relationIds(note.props[def.key]);
  const linked = ids.map((id) => notes[id]).filter((n): n is Note => Boolean(n && !n.deleted_at));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const targets = def.target ?? ['note'];

  const options = useMemo(
    () => (open ? searchNotes(alive, q, { types: targets, limit: 8, exclude: new Set([...ids, note.id]) }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, q, alive, ids.join()],
  );
  const canCreate = q.trim() && !findByTitle(alive, q, targets[0]);
  const total = options.length + (canCreate ? 1 : 0);

  const add = (id: string) => {
    setProp(note.id, def.key, [...ids, id]);
    setQ('');
    setSel(0);
  };
  const create = () => {
    const n = createNote(targets[0], q.trim());
    add(n.id);
  };
  const pick = (i: number) => (i < options.length ? add(options[i].id) : canCreate && create());

  return (
    <div className="relation">
      {linked.map((n) => (
        <span key={n.id} className="relchip">
          <NoteChip note={n} />
          <button className="x" title="Kaldır" onClick={() => setProp(note.id, def.key, ids.filter((x) => x !== n.id))}>×</button>
        </span>
      ))}
      <span className="relinput">
        <input
          value={q}
          placeholder={linked.length ? '+' : `${TYPE_MAP[targets[0]].label} ekle…`}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setSel(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, total - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); if (total) pick(sel); }
            if (e.key === 'Backspace' && !q && ids.length) setProp(note.id, def.key, ids.slice(0, -1));
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {open && total > 0 && (
          <div className="suggest pop">
            {options.map((n, i) => (
              <button key={n.id} className={i === sel ? 'sel' : ''} onMouseDown={(e) => { e.preventDefault(); add(n.id); }}>
                <span className="ic">{typeOf(n.type).icon}</span><span className="lb">{displayTitle(n)}</span>
              </button>
            ))}
            {canCreate && (
              <button className={sel === options.length ? 'sel' : ''} onMouseDown={(e) => { e.preventDefault(); create(); }}>
                <span className="ic">＋</span><span className="lb">Yeni {TYPE_MAP[targets[0]].label.toLocaleLowerCase('tr')}: “{q.trim()}”</span>
              </button>
            )}
          </div>
        )}
      </span>
    </div>
  );
}

/** Kitap/makaledeki kelimeler: kelime + anlamı aynı yerde düzenlenir (ortak sözlüğe yazılır). */
function WordList({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  const { alive, backlinks } = useIndex();
  const ids = relationIds(note.props[def.key]);
  const words = ids.map((id) => notes[id]).filter((n): n is Note => Boolean(n && !n.deleted_at));
  const [w, setW] = useState('');
  const [m, setM] = useState('');
  const wordRef = useRef<HTMLInputElement>(null);
  const existing = w.trim() ? findByTitle(alive, w, 'word') : undefined;

  const add = () => {
    const title = w.trim();
    if (!title) return;
    let target = existing;
    if (!target) target = createNote('word', title, m.trim() ? { meaning: m.trim() } : {});
    else if (m.trim() && !target.props.meaning) setProp(target.id, 'meaning', m.trim());
    if (!ids.includes(target.id)) setProp(note.id, def.key, [...ids, target.id]);
    setW('');
    setM('');
    wordRef.current?.focus();
  };

  return (
    <div className="wordlist">
      {words.map((wd) => {
        const others = (backlinks.get(wd.id) ?? []).filter((id) => id !== note.id && notes[id] && !notes[id].deleted_at);
        return (
          <div key={wd.id} className="wordrow">
            <a href={noteHref(wd.id)} className="word">{wd.title}</a>
            <input
              className="meaning"
              defaultValue={(wd.props.meaning as string) ?? ''}
              placeholder="anlamı…"
              onBlur={(e) => e.target.value !== (wd.props.meaning ?? '') && setProp(wd.id, 'meaning', e.target.value)}
            />
            {others.length > 0 && (
              <span className="also" title={others.map((id) => displayTitle(notes[id])).join(', ')}>
                +{others.length} yerde
              </span>
            )}
            <button className="x" title="Bu kaynaktan kaldır (sözlükte kalır)" onClick={() => setProp(note.id, def.key, ids.filter((x) => x !== wd.id))}>×</button>
          </div>
        );
      })}
      <div className="wordrow add">
        <input ref={wordRef} className="word" value={w} placeholder="Yeni kelime" onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input
          className="meaning"
          value={m}
          placeholder={existing ? `Sözlükte var: ${(existing.props.meaning as string) || 'anlamı boş'}` : 'anlamı (isteğe bağlı)'}
          onChange={(e) => setM(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn small" onClick={add} disabled={!w.trim()}>Ekle</button>
      </div>
    </div>
  );
}

function UrlInput({ note, def }: { note: Note; def: PropDef }) {
  const v = (note.props[def.key] as string) ?? '';
  const [busy, setBusy] = useState(false);
  const open = async () => window.open(await resolveFileUrl(v), '_blank', 'noopener');
  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = def.key === 'pdf' ? 'application/pdf' : 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        setProp(note.id, def.key, await uploadFile(f, f.name));
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };
  const isFile = v.startsWith('gd://') || v.startsWith('local://');
  return (
    <div className="urlinput">
      {isFile ? (
        <span className="muted">📎 {decodeURIComponent(v.split('#')[1] ?? 'Dosya')}</span>
      ) : (
        <input key={note.id + def.key} defaultValue={v} placeholder="https://…" onBlur={(e) => e.target.value.trim() !== v && setProp(note.id, def.key, e.target.value.trim())} />
      )}
      {v && <button className="btn small ghost" onClick={() => void open()}>Aç ↗</button>}
      {isFile && <button className="btn small ghost" onClick={() => setProp(note.id, def.key, '')}>Kaldır</button>}
      {!v && (def.key === 'pdf' || def.key === 'cover') && (
        <button className="btn small ghost" disabled={busy} onClick={upload}>{busy ? 'Yükleniyor…' : 'Dosya yükle'}</button>
      )}
    </div>
  );
}

export function PropValue({ note, def }: { note: Note; def: PropDef }) {
  const v = note.props[def.key];
  const k = note.id + def.key;
  switch (def.kind) {
    case 'text':
      return <input key={k} defaultValue={(v as string) ?? ''} placeholder="Boş" onBlur={(e) => e.target.value !== (v ?? '') && setProp(note.id, def.key, e.target.value)} />;
    case 'longtext':
      return (
        <textarea
          key={k}
          rows={1}
          defaultValue={(v as string) ?? ''}
          placeholder="Boş"
          onInput={(e) => autosize(e.currentTarget)}
          ref={(el) => {
            if (el) autosize(el);
          }}
          onBlur={(e) => e.target.value !== (v ?? '') && setProp(note.id, def.key, e.target.value)}
        />
      );
    case 'number':
      return <input key={k} type="number" defaultValue={(v as number) ?? ''} placeholder="Boş" onBlur={(e) => setProp(note.id, def.key, e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'date':
      return <input type="date" value={(v as string) ?? ''} onChange={(e) => setProp(note.id, def.key, e.target.value)} />;
    case 'url':
      return <UrlInput note={note} def={def} />;
    case 'checkbox':
      return <input type="checkbox" className="check" checked={Boolean(v)} onChange={(e) => setProp(note.id, def.key, e.target.checked || undefined)} />;
    case 'rating':
      return <Stars value={Number(v) || 0} onChange={(x) => setProp(note.id, def.key, x || undefined)} />;
    case 'select':
      return (
        <select value={(v as string) ?? ''} onChange={(e) => setProp(note.id, def.key, e.target.value)} className={v ? 'chip-select' : ''} style={v ? ({ '--h': optionHue(v as string) } as React.CSSProperties) : undefined}>
          <option value="">—</option>
          {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          {typeof v === 'string' && v && !def.options?.includes(v) && <option value={v}>{v}</option>}
        </select>
      );
    case 'multiselect': {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return (
        <div className="relation">
          {arr.map((o) => (
            <span key={o} className="relchip"><Chip text={o} /><button className="x" onClick={() => setProp(note.id, def.key, arr.filter((x) => x !== o))}>×</button></span>
          ))}
          <select value="" onChange={(e) => e.target.value && setProp(note.id, def.key, [...arr, e.target.value])}>
            <option value="">+</option>
            {def.options?.filter((o) => !arr.includes(o)).map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    case 'relation':
      return def.target?.[0] === 'word' ? <WordList note={note} def={def} /> : <RelationInput note={note} def={def} />;
  }
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/** İçe aktarmada tipin alanlarına uymayan değerler props.extra altında saklanır. */
function ExtraProps({ note }: { note: Note }) {
  const extra = note.props.extra as Record<string, string> | undefined;
  if (!extra || !Object.keys(extra).length) return null;
  return (
    <>
      {Object.entries(extra).map(([k, val]) => (
        <div className="prop" key={k}>
          <label title="Notion'dan aktarılan alan">{k}</label>
          <div className="val muted">{val}</div>
        </div>
      ))}
    </>
  );
}

export default function PropertyPanel({ note }: { note: Note }) {
  const t = typeOf(note.type);
  const [showEmpty, setShowEmpty] = useState(false);
  const isEmpty = (d: PropDef) => {
    const v = note.props[d.key];
    return v === undefined || v === '' || (Array.isArray(v) && !v.length);
  };
  const hidden = t.props.filter((d) => isEmpty(d) && !alwaysShow(note, d));
  const visible = t.props.filter((d) => showEmpty || !hidden.includes(d));
  return (
    <div className="props">
      {visible.map((d) => (
        <div className={`prop ${d.target?.[0] === 'word' ? 'wide' : ''}`} key={d.key}>
          <label>{d.label}</label>
          <div className="val"><PropValue note={note} def={d} /></div>
        </div>
      ))}
      <ExtraProps note={note} />
      {hidden.length > 0 && (
        <button className="btn ghost small more" onClick={() => setShowEmpty((s) => !s)}>
          {showEmpty ? 'Boş alanları gizle' : `+ ${hidden.length} alan daha`}
        </button>
      )}
    </div>
  );
}

/** Yeni notta önemli alanlar boş olsa da görünsün */
function alwaysShow(note: Note, d: PropDef) {
  if (d.kind === 'relation' && d.target?.[0] === 'word') return true;
  return ['status', 'author', 'authors', 'meaning', 'language', 'kind', 'speakers', 'definition', 'course', 'date', 'year'].includes(d.key);
}
