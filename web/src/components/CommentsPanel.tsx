import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { addComment, closeComments, deleteComment, replyComment, resolveComment, useCommentPanel, type Comment } from '../lib/comments';
import { relTime } from '../lib/format';
import { useHash } from '../lib/router';
import { useStore } from '../lib/store';

// Sağda açılan yorum paneli: açık yorumlar, çözülenler, yanıtlar, sayfaya genel yorum

function Thread({ noteId, c, focused }: { noteId: string; c: Comment; focused: boolean }) {
  const [reply, setReply] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focused]);
  const jump = () => document.querySelector(`[data-comment="${c.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return (
    <div ref={ref} className={`thread ${focused ? 'focused' : ''} ${c.resolved ? 'resolved' : ''}`}>
      {c.quote && <button type="button" className="thread-quote" onClick={jump} title={t('pages.comments.showInText')}>“{c.quote.length > 120 ? `${c.quote.slice(0, 119)}…` : c.quote}”</button>}
      <div className="thread-msg">
        <div className="thread-text">{c.text}</div>
        <div className="muted small">{relTime(c.created_at)}</div>
      </div>
      {c.replies.map((r) => (
        <div key={r.id} className="thread-msg reply">
          <div className="thread-text">{r.text}</div>
          <div className="muted small">{relTime(r.created_at)}</div>
        </div>
      ))}
      {!c.resolved && (
        <form className="thread-reply" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { replyComment(noteId, c.id, reply.trim()); setReply(''); } }}>
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('pages.comments.reply')} />
        </form>
      )}
      <div className="thread-actions">
        <button type="button" className="linkbtn small" onClick={() => resolveComment(noteId, c.id, !c.resolved)}>{c.resolved ? t('pages.comments.reopen') : t('pages.comments.resolve')}</button>
        <button type="button" className="linkbtn small danger-link" onClick={() => deleteComment(noteId, c.id)}>{t('common.delete')}</button>
      </div>
    </div>
  );
}

export default function CommentsPanel() {
  const { noteId, focus } = useCommentPanel();
  const note = useStore((s) => (noteId ? s.notes[noteId] : undefined));
  const [text, setText] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const hash = useHash();
  useEffect(() => closeComments(), [hash]);
  if (!noteId || !note) return null;
  const list = Array.isArray(note.props.__comments) ? (note.props.__comments as Comment[]) : [];
  const open = list.filter((c) => !c.resolved);
  const done = list.filter((c) => c.resolved);
  return (
    <aside className="comments-panel" aria-label={t('pages.comments.aria')}>
      <div className="comments-head">
        <b>{t('pages.comments.title')}</b>
        <span className="muted small">{t('pages.comments.openCount', { count: open.length })}</span>
        <span className="spacer" />
        <button type="button" className="iconbtn" onClick={closeComments} aria-label={t('common.close')}>×</button>
      </div>
      <form className="comment-new" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addComment(noteId, text.trim()); setText(''); } }}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('pages.comments.placeholder')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit(); }} />
        <button type="submit" className="btn small primary" disabled={!text.trim()}>{t('pages.comments.add')}</button>
      </form>
      {open.length === 0 && <p className="muted small">{t('pages.comments.none')}</p>}
      {open.map((c) => <Thread key={c.id} noteId={noteId} c={c} focused={focus === c.id} />)}
      {done.length > 0 && (
        <>
          <button type="button" className="linkbtn small" onClick={() => setShowResolved(!showResolved)}>{showResolved ? '▾' : '▸'} {t('pages.comments.resolved', { count: done.length })}</button>
          {showResolved && done.map((c) => <Thread key={c.id} noteId={noteId} c={c} focused={focus === c.id} />)}
        </>
      )}
    </aside>
  );
}
