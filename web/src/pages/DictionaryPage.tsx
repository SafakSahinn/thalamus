import { useMemo, useRef, useState } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { norm } from '../lib/links';
import { findByTitle } from '../lib/search';
import { createNote, setProp, useIndex, useStore } from '../lib/store';
import { TYPE_MAP, type Note } from '../lib/types';

const LANGS = TYPE_MAP.word.props.find((p) => p.key === 'language')!.options!;

function Review({ words, onClose }: { words: Note[]; onClose: () => void }) {
  const pool = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const notes = useStore((s) => s.notes);
  const { backlinks } = useIndex();
  if (!pool.length) return <div className="review"><p>Tekrar edilecek kelime yok 🎉</p><button className="btn" onClick={onClose}>Kapat</button></div>;
  const w = notes[pool[i % pool.length].id];
  const next = (learned: boolean) => {
    if (learned) setProp(w.id, 'learned', true);
    setShown(false);
    setI(i + 1);
  };
  const src = (backlinks.get(w.id) ?? []).map((id) => notes[id]).filter((n) => n && !n.deleted_at);
  return (
    <div className="review">
      <div className="muted small">{(i % pool.length) + 1} / {pool.length}</div>
      <div className="review-word">{w.title}</div>
      {shown ? (
        <>
          <div className="review-meaning">{(w.props.meaning as string) || <span className="muted">anlamı girilmemiş</span>}</div>
          {typeof w.props.example === 'string' && <div className="review-example">“{w.props.example}”</div>}
          {src.length > 0 && <div className="review-src">{src.map((n) => <NoteChip key={n.id} note={n} />)}</div>}
          <div className="row center">
            <button className="btn" onClick={() => next(false)}>Tekrar sor</button>
            <button className="btn primary" onClick={() => next(true)}>Öğrendim ✓</button>
          </div>
        </>
      ) : (
        <button className="btn primary" onClick={() => setShown(true)}>Anlamını göster</button>
      )}
      <button className="linkbtn" onClick={onClose}>Tekrarı bitir</button>
    </div>
  );
}

export default function DictionaryPage() {
  const { alive, backlinks } = useIndex();
  const notes = useStore((s) => s.notes);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');
  const [state, setState] = useState<'' | 'new' | 'learned'>('');
  const [review, setReview] = useState(false);
  const [w, setW] = useState('');
  const [m, setM] = useState('');
  const [l, setL] = useState(() => localStorage.getItem('lastLang') ?? 'İngilizce');
  const wRef = useRef<HTMLInputElement>(null);

  const words = useMemo(() => {
    const nq = norm(q);
    return alive
      .filter((n) => n.type === 'word'
        && (!lang || n.props.language === lang)
        && (!state || (state === 'learned') === Boolean(n.props.learned))
        && (!nq || norm(n.title).includes(nq) || norm(String(n.props.meaning ?? '')).includes(nq)))
      .sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  }, [alive, q, lang, state]);

  const existing = w.trim() ? findByTitle(alive, w, 'word') : undefined;
  const add = () => {
    if (!w.trim() || existing) return;
    createNote('word', w.trim(), { meaning: m.trim() || undefined, language: l });
    localStorage.setItem('lastLang', l);
    setW('');
    setM('');
    wRef.current?.focus();
  };

  if (review) return <div className="page"><Review words={words.filter((x) => !x.props.learned)} onClose={() => setReview(false)} /></div>;

  let letter = '';
  return (
    <div className="page wide">
      <div className="coll-head">
        <h1>🔤 Sözlük <span className="count">{words.length}</span></h1>
        <span className="spacer" />
        <button className="btn" onClick={() => setReview(true)}>🃏 Kelime tekrarı</button>
      </div>
      <p className="muted small">Kitaplarda, makalelerde ve filmlerde eklediğin bütün kelimeler burada toplanır. Aynı kelime birden çok kaynakta geçiyorsa hepsi yanında görünür ve haritada birbirine bağlanır.</p>
      <div className="wordrow add big">
        <input ref={wRef} className="word" value={w} placeholder="Kelime" onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="meaning" value={m} placeholder="Anlamı" onChange={(e) => setM(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select value={l} onChange={(e) => setL(e.target.value)}>{LANGS.map((x) => <option key={x}>{x}</option>)}</select>
        <button className="btn primary" disabled={!w.trim() || Boolean(existing)} onClick={add}>Ekle</button>
      </div>
      {existing && <p className="small warn-text">“{existing.title}” sözlükte zaten var: <a href={`#/n/${existing.id}`}>aç</a></p>}
      <div className="toolbar">
        <input className="search" placeholder="Kelime veya anlam ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="">Tüm diller</option>
          {LANGS.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="">Hepsi</option>
          <option value="new">Öğrenilecek</option>
          <option value="learned">Öğrenildi</option>
        </select>
      </div>
      <div className="dict">
        {words.map((wd) => {
          const first = wd.title.charAt(0).toLocaleUpperCase('tr');
          const head = first !== letter ? (letter = first) : null;
          const src = (backlinks.get(wd.id) ?? []).map((id) => notes[id]).filter((n) => n && !n.deleted_at);
          return (
            <div key={wd.id}>
              {head && <div className="dict-letter">{head}</div>}
              <div className="dict-row">
                <input type="checkbox" className="check" title="Öğrendim" checked={Boolean(wd.props.learned)} onChange={(e) => setProp(wd.id, 'learned', e.target.checked || undefined)} />
                <a className="dict-word" href={`#/n/${wd.id}`}>{wd.title}</a>
                <input
                  key={wd.id + String(wd.props.meaning ?? '')}
                  className="meaning"
                  defaultValue={(wd.props.meaning as string) ?? ''}
                  placeholder="anlamı…"
                  onBlur={(e) => e.target.value !== (wd.props.meaning ?? '') && setProp(wd.id, 'meaning', e.target.value)}
                />
                <div className="dict-src">{src.map((n) => <NoteChip key={n.id} note={n} />)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
