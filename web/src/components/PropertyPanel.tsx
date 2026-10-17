import { useEffect, useMemo, useRef, useState } from 'react';
import { propValue, showValue } from '../lib/compute';
import { relTime } from '../lib/format';
import { googleCalendarUrl, icsFile } from '../lib/upcoming';
import { fetchImageBlob, getCoverMode, searchBookCovers, searchPosters, type CoverHit } from '../lib/covers';

/** Kapak görselini indirip Drive'a (ya da cihaza) kaydeder; dönen değer gd:// veya local:// adresidir. */
async function saveCover(url: string, title: string): Promise<string> {
  const blob = await fetchImageBlob(url);
  const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const safe = title.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'kapak';
  return uploadFile(blob, `kapak-${safe}.${ext}`);
}
import { displayTitle, optionHue, noteIcon } from '../lib/format';
import { noteHref } from '../lib/router';
import { findByTitle, searchNotes } from '../lib/search';
import { createNote, indexOf, resolveFileUrl, setProp, uploadFile, useIndex, useStore } from '../lib/store';
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
      <span>{noteIcon(note)}</span>
      {displayTitle(note)}
    </a>
  );
}

function RelationInput({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  const { alive } = useIndex();
  const ids = relationIds(propValue(note, def, notes));
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
                <span className="ic">{noteIcon(n)}</span><span className="lb">{displayTitle(n)}</span>
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

/** Kitap kapağı / film afişi arama penceresi */
function CoverFinder({ note, onClose }: { note: Note; onClose: () => void }) {
  const notes = useStore((s) => s.notes);
  const isBook = note.type === 'book';
  const people = relationIds(note.props[isBook ? 'author' : 'director']).map((id) => notes[id]?.title).filter(Boolean);
  const [q, setQ] = useState([note.title, ...(isBook ? people : [])].join(' ').trim());
  const [hits, setHits] = useState<CoverHit[] | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const run = async (query: string) => {
    if (!query.trim()) return;
    setHits(null);
    setErr('');
    try {
      setHits(await (isBook ? searchBookCovers(query) : searchPosters(query)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setHits([]);
    }
  };
  useEffect(() => {
    void run(q);
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    setTimeout(() => document.addEventListener('mousedown', out), 0);
    return () => document.removeEventListener('mousedown', out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = async (h: CoverHit) => {
    let cover = h.url;
    if (getCoverMode() === 'save') {
      setSaving(true);
      try {
        cover = await saveCover(h.url, note.title || h.title);
      } catch {
        // indirilemezse bağlantı olarak kalsın
      } finally {
        setSaving(false);
      }
    }
    setProp(note.id, 'cover', cover);
    // Boş alanları da doldur
    const cur = useStore.getState().notes[note.id];
    if (isBook && h.pages && !cur.props.pages) setProp(note.id, 'pages', h.pages);
    if (isBook && h.authors?.length && !relationIds(cur.props.author).length) {
      const { alive } = indexOf(useStore.getState().notes);
      const ids = h.authors.slice(0, 3).map((a) => (findByTitle(alive, a, 'person') ?? createNote('person', a)).id);
      setProp(note.id, 'author', ids);
    }
    if (!isBook && h.year && !cur.props.year) setProp(note.id, 'year', h.year);
    onClose();
  };
  return (
    <div className="cover-finder" ref={ref}>
      <div className="row">
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run(q)} placeholder={isBook ? 'Kitap adı ve yazar' : 'Film adı'} />
        <button type="button" className="btn small" onClick={() => void run(q)}>Ara</button>
      </div>
      <p className="muted small">{isBook ? 'Google Books, Open Library ve Wikipedia’dan.' : 'Wikipedia’dan.'} {saving ? 'Görsel indirilip kaydediliyor…' : 'Seçtiğin görsel kapak olur'}{isBook ? '; yazar ve sayfa sayısı boşsa onlar da doldurulur' : ''}.</p>
      {err && <p className="err small">{err}</p>}
      {hits === null ? (
        <p className="muted small">Aranıyor…</p>
      ) : hits.length === 0 ? (
        <p className="muted small">Sonuç bulunamadı. Adı farklı yazmayı dene.</p>
      ) : (
        <div className="cf-grid">
          {hits.map((h) => (
            <button key={h.url} type="button" className="cf-item" onClick={() => void pick(h)} disabled={saving} title={[h.title, h.sub].filter(Boolean).join(' · ')}>
              <img src={h.url} alt="" loading="lazy" referrerPolicy="no-referrer" onLoad={(e) => { if (e.currentTarget.naturalWidth < 10) (e.currentTarget.closest('.cf-item') as HTMLElement).style.display = 'none'; }} onError={(e) => ((e.currentTarget.closest('.cf-item') as HTMLElement).style.display = 'none')} />
              <span>{h.title}{h.year ? ` (${h.year})` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverThumb({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    resolveFileUrl(src).then(setUrl, () => setUrl(null));
  }, [src]);
  return url ? <img className="cover-thumb" src={url} alt="" referrerPolicy="no-referrer" /> : null;
}

function UrlInput({ note, def }: { note: Note; def: PropDef }) {
  const [finder, setFinder] = useState(false);
  const canFind = def.key === 'cover' && (note.type === 'book' || note.type === 'movie');
  const [saveErr, setSaveErr] = useState('');
  const keep = async () => {
    setBusy(true);
    setSaveErr('');
    try {
      setProp(note.id, def.key, await saveCover(v, note.title));
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
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
      {def.key === 'cover' && v && <CoverThumb src={v} />}
      {isFile ? (
        <span className="muted">📎 {decodeURIComponent(v.split('#')[1] ?? 'Dosya')}</span>
      ) : (
        <input key={note.id + def.key} defaultValue={v} placeholder="https://…" onBlur={(e) => e.target.value.trim() !== v && setProp(note.id, def.key, e.target.value.trim())} />
      )}
      {v && <button className="btn small ghost" onClick={() => void open()}>Aç ↗</button>}
      {isFile && <button className="btn small ghost" onClick={() => setProp(note.id, def.key, '')}>Kaldır</button>}
      {(def.key === 'cover' || (!v && def.key === 'pdf')) && (
        <button className="btn small ghost" disabled={busy} onClick={upload}>{busy ? 'Yükleniyor…' : v ? 'Değiştir' : 'Dosya yükle'}</button>
      )}
      {def.key === 'cover' && /^https?:/.test(v) && (
        <button className="btn small ghost" disabled={busy} onClick={() => void keep()} title="Görseli indirip Drive’ına kaydeder; site kaldırsa bile kapak kaybolmaz">💾 Drive’a kaydet</button>
      )}
      {saveErr && <span className="err small">{saveErr}</span>}
      {canFind && <button className="btn small ghost" onClick={() => setFinder(!finder)}>🔍 {note.type === 'book' ? 'Kapak bul' : 'Afiş bul'}</button>}
      {finder && <CoverFinder note={note} onClose={() => setFinder(false)} />}
    </div>
  );
}

/** Tarihi Google Takvim'e ya da .ics ile Apple/Outlook takvimine ekle */
export function AddToCalendar({ note, def, date }: { note: Note; def: PropDef; date: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', out);
    return () => document.removeEventListener('mousedown', out);
  }, [open]);
  const ics = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([icsFile(note, def, date)], { type: 'text/calendar;charset=utf-8' }));
    a.download = `${(note.title || 'etkinlik').replace(/[\\/:*?"<>|]+/g, '-')} - ${def.label}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setOpen(false);
  };
  return (
    <span className="cal-btn" ref={ref}>
      <button type="button" className="iconbtn" title="Takvime ekle (hatırlatma için)" onClick={() => setOpen(!open)}>📅</button>
      {open && (
        <div className="tb-pop cal-pop">
          <a className="bm-row" href={googleCalendarUrl(note, def, date)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Google Takvim’e ekle ↗</a>
          <button type="button" className="bm-row" onClick={ics}>Apple / Outlook takvimine ekle (.ics)</button>
          <p className="muted small">Takvim uygulaman tarihten önce sana hatırlatır.</p>
        </div>
      )}
    </span>
  );
}

/** Hesaplanan alan (formül, toplama, oluşturulma/düzenlenme zamanı) */
export function ComputedValue({ note, def }: { note: Note; def: PropDef }) {
  const notes = useStore((s) => s.notes);
  const v = propValue(note, def, notes);
  if (def.kind === 'created' || def.kind === 'updated') return <span className="muted computed" title={String(v)}>{relTime(String(v))}</span>;
  const text = showValue(v);
  const err = text.startsWith('⚠');
  return <span className={`computed ${err ? 'err' : ''}`}>{text || <span className="muted">—</span>}</span>;
}

export function PropValue({ note, def }: { note: Note; def: PropDef }) {
  const v = note.props[def.key];
  const k = note.id + def.key;
  switch (def.kind) {
    case 'formula':
    case 'rollup':
    case 'created':
    case 'updated':
      return <ComputedValue note={note} def={def} />;
    case 'email':
    case 'phone':
      return (
        <div className="urlinput">
          <input key={k} type={def.kind === 'email' ? 'email' : 'tel'} defaultValue={(v as string) ?? ''} placeholder="Boş" onBlur={(e) => e.target.value.trim() !== (v ?? '') && setProp(note.id, def.key, e.target.value.trim())} />
          {typeof v === 'string' && v && <a className="btn small ghost" href={`${def.kind === 'email' ? 'mailto' : 'tel'}:${v}`}>{def.kind === 'email' ? '✉' : '📞'}</a>}
        </div>
      );
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
      return (
        <div className="urlinput">
          <input type="date" value={(v as string) ?? ''} onChange={(e) => setProp(note.id, def.key, e.target.value)} />
          {typeof v === 'string' && v && note.type !== 'daily' && <AddToCalendar note={note} def={def} date={v} />}
        </div>
      );
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
  const notes = useStore((s) => s.notes);
  const [showEmpty, setShowEmpty] = useState(false);
  const isEmpty = (d: PropDef) => {
    if (['formula', 'rollup', 'created', 'updated'].includes(d.kind)) return false;
    const v = d.back ? propValue(note, d, notes) : note.props[d.key];
    return v === undefined || v === '' || (Array.isArray(v) && !v.length);
  };
  const hidden = t.props.filter((d) => isEmpty(d) && !alwaysShow(note, d));
  const visible = t.props.filter((d) => showEmpty || !hidden.includes(d));
  return (
    <div className="props" data-tour="props">
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
  if (d.key === 'cover' && (note.type === 'book' || note.type === 'movie')) return true;
  return ['status', 'author', 'authors', 'meaning', 'language', 'kind', 'speakers', 'definition', 'course', 'date', 'year'].includes(d.key);
}
