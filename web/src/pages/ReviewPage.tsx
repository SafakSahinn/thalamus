import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { NoteChip } from '../components/PropertyPanel';
import { displayTitle } from '../lib/format';
import { dueCards, intervalText, NEW_KEY, newPerDay, review, srsOf, type Grade } from '../lib/srs';
import { setProp, todayStr, useIndex, useStore } from '../lib/store';
import { optionLabel, typeOf, type Note } from '../lib/types';

// Aralıklı tekrar ekranı (#/tekrar): bugün vadesi gelen kelime ve kavram kartları + günlük yeni kart sınırı.

const gradeBtn = (g: Grade, key: string, cls: 'again' | 'hard' | 'good' | 'easy') => ({ g, key, cls, get label() { return t(`study.review.grades.${cls}`); } });
const GRADES: { g: Grade; readonly label: string; key: string; cls: string }[] = [
  gradeBtn(0, '1', 'again'),
  gradeBtn(3, '2', 'hard'),
  gradeBtn(4, '3', 'good'),
  gradeBtn(5, '4', 'easy'),
];

function Back({ n }: { n: Note }) {
  const notes = useStore((s) => s.notes);
  const { backlinks } = useIndex();
  const src = (backlinks.get(n.id) ?? []).map((id) => notes[id]).filter((x) => x && !x.deleted_at && x.type !== 'word').slice(0, 6);
  const text = n.type === 'word' ? n.props.meaning : n.props.definition;
  return (
    <div className="card-back">
      <div className="review-meaning">{typeof text === 'string' && text ? text : <span className="muted">{n.type === 'word' ? t('study.review.noMeaning') : t('study.review.noDefinition')}</span>}</div>
      {typeof n.props.example === 'string' && n.props.example && <div className="review-example">“{n.props.example}”</div>}
      {src.length > 0 && <div className="review-src"><span className="muted small">{t('study.review.seenIn')}</span> {src.map((x) => <NoteChip key={x.id} note={x} />)}</div>}
    </div>
  );
}

export default function ReviewPage() {
  const notes = useStore((s) => s.notes);
  const today = todayStr();
  // Oturum başında deste sabitlenir; "Tekrar" denen kart oturumun sonuna bir kez daha eklenir
  const [queue, setQueue] = useState<string[]>(() => {
    const { due, fresh } = dueCards(Object.values(useStore.getState().notes), todayStr(), newPerDay());
    return [...due, ...fresh].map((n) => n.id);
  });
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const card = queue[pos] ? notes[queue[pos]] : undefined;
  const stats = useMemo(() => dueCards(Object.values(notes), today, newPerDay()), [notes, today]);

  const grade = (g: Grade) => {
    if (!card) return;
    setProp(card.id, '__srs', review(srsOf(card), g, today));
    if (g === 0 && queue.filter((x) => x === card.id).length < 2) setQueue((q) => [...q, card.id]);
    setDone((d) => d + 1);
    setShown(false);
    setPos((p) => p + 1);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShown(true);
      }
      const hit = GRADES.find((x) => x.key === e.key);
      if (hit && shown) grade(hit.g);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  if (!card) {
    return (
      <div className="page review-page">
        <h1>{t('study.review.title')}</h1>
        <div className="review-done">
          <div className="review-big">🎉</div>
          <p>{done ? t('study.review.doneToday', { count: done }) : t('study.review.none')}</p>
          <p className="muted small">{t('study.review.newHint', { count: newPerDay() })}</p>
          {stats.due.length + stats.fresh.length > 0 && (
            <button className="btn" onClick={() => { setQueue([...stats.due, ...stats.fresh].map((n) => n.id)); setPos(0); }}>Kalan {stats.due.length + stats.fresh.length} kartla devam et</button>
          )}
        </div>
      </div>
    );
  }

  const s = srsOf(card);
  const ty = typeOf(card.type);
  return (
    <div className="page review-page">
      <div className="review-top">
        <h1>{t('study.review.title')}</h1>
        <span className="muted small">{Math.min(pos + 1, queue.length)} / {queue.length}{!s ? t('study.review.newCard') : ''}</span>
        <span className="spacer" />
        <label className="muted small">{t('study.review.perDay')}{' '}
          <select defaultValue={newPerDay()} onChange={(e) => { try { localStorage.setItem(NEW_KEY, e.target.value); } catch { /* yok say */ } }}>
            {[5, 10, 20, 30, 50].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="review-progress"><span style={{ width: `${(pos / Math.max(1, queue.length)) * 100}%` }} /></div>
      <div className="review-card">
        <div className="muted small">{ty.icon} {ty.label}{typeof card.props.language === 'string' ? ` · ${optionLabel(card.props.language)}` : ''}</div>
        <div className="review-word">{displayTitle(card)}</div>
        {shown ? <Back n={card} /> : <button className="btn primary review-show" onClick={() => setShown(true)}>{t('study.review.show')} <kbd>{t('study.review.space')}</kbd></button>}
      </div>
      {shown && (
        <div className="review-grades">
          {GRADES.map((x) => (
            <button key={x.g} className={`grade ${x.cls}`} onClick={() => grade(x.g)}>
              <b>{x.label}</b>
              <span className="small">{intervalText(s, x.g, today)}</span>
              <kbd>{x.key}</kbd>
            </button>
          ))}
        </div>
      )}
      <p className="muted small review-help">{t('study.review.help')}</p>
    </div>
  );
}
