import { useMemo } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { displayTitle, relTime, noteIcon } from '../lib/format';
import { go } from '../lib/router';
import { createNote, todayStr, useIndex } from '../lib/store';
import { TYPES, typeOf, type Note, type TypeId } from '../lib/types';
import { RoutineChecks } from './DailyPage';

const QUICK: TypeId[] = ['note', 'book', 'paper', 'lab', 'conference', 'talk', 'movie', 'word', 'concept'];
const ACTIVE = new Set(['Okunuyor', 'İzleniyor', 'Devam ediyor']);

export default function Home() {
  const { alive, backlinks } = useIndex();
  const recent = useMemo(
    () => alive.filter((n) => n.type !== 'daily').sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 10),
    [alive],
  );
  const active = useMemo(() => alive.filter((n) => ACTIVE.has(n.props.status as string)), [alive]);
  const word = useMemo(() => {
    const words = alive.filter((n) => n.type === 'word' && !n.props.learned && n.props.meaning);
    if (!words.length) return null;
    const day = Math.floor(Date.now() / 86_400_000);
    return words[day % words.length];
  }, [alive]);
  const hubs = useMemo(
    () => alive.filter((n) => n.type !== 'daily')
      .map((n) => ({ n, c: (backlinks.get(n.id)?.length ?? 0) + n.links.length }))
      .filter((x) => x.c > 1).sort((a, b) => b.c - a.c).slice(0, 8),
    [alive, backlinks],
  );
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of alive) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [alive]);

  return (
    <div className="page wide home">
      <section className="home-today">
        <div className="row">
          <h2>Bugün</h2>
          <span className="spacer" />
          <a className="btn small" href={`#/daily/${todayStr()}`}>Günlüğü aç →</a>
        </div>
        <RoutineChecks date={todayStr()} compact />
      </section>

      <section>
        <h3>Hızlı ekle</h3>
        <div className="quick">
          {QUICK.map((t) => (
            <button key={t} className="quickbtn" style={{ '--c': typeOf(t).color } as React.CSSProperties} onClick={() => go(`/n/${createNote(t).id}`)}>
              <span>{typeOf(t).icon}</span>{typeOf(t).label}
            </button>
          ))}
        </div>
      </section>

      <div className="home-grid">
        {active.length > 0 && (
          <section>
            <h3>Devam edenler</h3>
            <div className="list">
              {active.map((n) => <Row key={n.id} n={n} meta={String(n.props.status)} />)}
            </div>
          </section>
        )}
        <section>
          <h3>Son düzenlenenler</h3>
          <div className="list">
            {recent.length ? recent.map((n) => <Row key={n.id} n={n} meta={relTime(n.updated_at)} />) : <p className="muted">Henüz not yok. Yukarıdan bir şey ekleyerek başla.</p>}
          </div>
        </section>
        {word && (
          <section className="wotd">
            <h3>Günün kelimesi</h3>
            <a href={`#/n/${word.id}`} className="wotd-word">{word.title}</a>
            <div className="wotd-meaning">{String(word.props.meaning)}</div>
            <a href="#/dictionary" className="small">Sözlüğe git →</a>
          </section>
        )}
        {hubs.length > 0 && (
          <section>
            <h3>En bağlantılı notlar</h3>
            <div className="chips">{hubs.map(({ n }) => <NoteChip key={n.id} note={n} />)}</div>
            <a href="#/graph" className="small">Haritayı aç →</a>
          </section>
        )}
        <section>
          <h3>Koleksiyonlar</h3>
          <div className="colls">
            {TYPES.map((t) => (
              <a key={t.id} href={t.id === 'word' ? '#/dictionary' : t.id === 'daily' ? '#/daily' : `#/c/${t.id}`} className="coll">
                <span>{t.icon}</span> {t.plural} <span className="muted">{counts.get(t.id) ?? 0}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ n, meta }: { n: Note; meta: string }) {
  return (
    <a className="rowlink" href={`#/n/${n.id}`}>
      <span>{noteIcon(n)}</span>
      <span className="grow">{displayTitle(n)}</span>
      <span className="muted small">{meta}</span>
    </a>
  );
}
