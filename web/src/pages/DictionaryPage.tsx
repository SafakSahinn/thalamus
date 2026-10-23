import { localeTag, t } from '../i18n';
import { useMemo, useRef, useState } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { norm } from '../lib/links';
import { go } from '../lib/router';
import { findByTitle } from '../lib/search';
import { createNote, setProp, useIndex, useStore } from '../lib/store';
import { optionLabel, TYPE_MAP, type Note } from '../lib/types';

const LANGS = TYPE_MAP.word.props.find((p) => p.key === 'language')!.options!;

export default function DictionaryPage() {
  const { alive, backlinks } = useIndex();
  const notes = useStore((s) => s.notes);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');
  const [state, setState] = useState<'' | 'new' | 'learned'>('');
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
      .sort((a, b) => a.title.localeCompare(b.title, localeTag()));
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


  let letter = '';
  return (
    <div className="page wide" data-tour="dictionary">
      <div className="coll-head">
        <h1>{t('blocks.dict.title')} <span className="count">{words.length}</span></h1>
        <span className="spacer" />
        <button className="btn" onClick={() => go('/tekrar')}>{t('blocks.dict.review')}</button>
      </div>
      <p className="muted small">{t('blocks.dict.intro')}</p>
      <div className="wordrow add big">
        <input ref={wRef} className="word" value={w} placeholder={t('blocks.dict.word')} onChange={(e) => setW(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="meaning" value={m} placeholder={t('blocks.dict.meaning')} onChange={(e) => setM(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select value={l} onChange={(e) => setL(e.target.value)}>{LANGS.map((x) => <option key={x} value={x}>{optionLabel(x)}</option>)}</select>
        <button className="btn primary" disabled={!w.trim() || Boolean(existing)} onClick={add}>{t('common.add')}</button>
      </div>
      {existing && <p className="small warn-text">{t.rich('blocks.dict.exists', { title: existing.title, link: <a href={`#/n/${existing.id}`}>{t('blocks.dict.open')}</a> })}</p>}
      <div className="toolbar">
        <input className="search" placeholder={t('blocks.dict.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="">{t('blocks.dict.allLangs')}</option>
          {LANGS.map((x) => <option key={x} value={x}>{optionLabel(x)}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="">{t('blocks.dict.all')}</option>
          <option value="new">{t('blocks.dict.toLearn')}</option>
          <option value="learned">{t('blocks.dict.learned')}</option>
        </select>
      </div>
      <div className="dict">
        {words.map((wd) => {
          const first = wd.title.charAt(0).toLocaleUpperCase(localeTag());
          const head = first !== letter ? (letter = first) : null;
          const src = (backlinks.get(wd.id) ?? []).map((id) => notes[id]).filter((n) => n && !n.deleted_at);
          return (
            <div key={wd.id}>
              {head && <div className="dict-letter">{head}</div>}
              <div className="dict-row">
                <input type="checkbox" className="check" title={t('blocks.dict.learnedTitle')} checked={Boolean(wd.props.learned)} onChange={(e) => setProp(wd.id, 'learned', e.target.checked || undefined)} />
                <a className="dict-word" href={`#/n/${wd.id}`}>{wd.title}</a>
                <input
                  key={wd.id + String(wd.props.meaning ?? '')}
                  className="meaning"
                  defaultValue={(wd.props.meaning as string) ?? ''}
                  placeholder={t('blocks.dict.meaningPlaceholder')}
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
