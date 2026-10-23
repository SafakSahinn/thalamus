import { fmtNumber, t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { fmtNum, textStats } from '../lib/format';
import { setProp } from '../lib/store';
import type { Note } from '../lib/types';
import { promptText } from './Prompt';

// Yazma modu: notun altında sabit sayaç (kelime, karakter, okuma süresi, bu oturumda yazılan),
// isteğe bağlı kelime hedefi + ilerleme çubuğu (props.__goal) ve dikkat dağıtan her şeyi gizleyen odak modu.

export const useFocus = create<{ on: boolean }>(() => ({ on: false }));

export function setFocus(on: boolean) {
  useFocus.setState({ on });
  document.body.classList.toggle('focus-mode', on);
  try {
    if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  } catch {
    /* tam ekran desteklenmiyor */
  }
}

export default function WritingBar({ note }: { note: Note }) {
  const focus = useFocus((s) => s.on);
  const stats = textStats(note.text ?? '');
  const goal = typeof note.props.__goal === 'number' ? (note.props.__goal as number) : 0;
  // Oturum başlangıcı: not açıldığındaki kelime sayısı
  const base = useRef<{ id: string; words: number } | null>(null);
  if (!base.current || base.current.id !== note.id) base.current = { id: note.id, words: stats.words };
  const session = stats.words - base.current.words;
  const [celebrated, setCelebrated] = useState(false);

  // Odak modundan Esc ile ya da tam ekrandan çıkınca çık; sayfadan ayrılınca kapat
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && useFocus.getState().on && setFocus(false);
    const fs = () => !document.fullscreenElement && useFocus.getState().on && setFocus(false);
    window.addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    return () => {
      window.removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fs);
      if (useFocus.getState().on) setFocus(false);
    };
  }, [note.id]);

  const reached = goal > 0 && stats.words >= goal;
  useEffect(() => {
    if (reached && !celebrated && session > 0) setCelebrated(true);
  }, [reached, celebrated, session]);

  const editGoal = async () => {
    const v = await promptText(t('writing.bar.goalPrompt'), goal ? String(goal) : '1000');
    if (v === null) return;
    const n = Math.round(Number(v.replace(/\D/g, '')));
    setProp(note.id, '__goal', n > 0 ? n : undefined);
  };

  const pct = goal ? Math.min(100, (stats.words / goal) * 100) : 0;
  return (
    <div className={`writing-bar ${focus ? 'focus' : ''}`}>
      {goal > 0 && <div className={`wb-progress ${reached ? 'done' : ''}`}><span style={{ width: `${pct}%` }} /></div>}
      <div className="wb-row">
        <span><b>{fmtNum(stats.words)}</b>{goal > 0 && <span className="muted"> / {fmtNum(goal)}</span>} {t('writing.bar.words')}</span>
        <span className="muted">{t('writing.bar.chars', { count: fmtNum(stats.chars) })}</span>
        <span className="muted">{t('writing.bar.reading', { count: stats.minutes })}</span>
        {session !== 0 && <span className={session > 0 ? 'wb-plus' : 'muted'}>{t('writing.bar.session', { count: `${session > 0 ? '+' : ''}${fmtNum(session)}` })}</span>}
        {celebrated && <span className="wb-plus">{t('writing.bar.reached')}</span>}
        <span className="spacer" />
        <button className="linkbtn" onClick={() => void editGoal()}>🎯 {goal ? fmtNumber(pct / 100, { style: 'percent', maximumFractionDigits: 0 }) : t('writing.bar.setGoal')}</button>
        <button className="linkbtn" title={t('writing.bar.focusTitle')} onClick={() => setFocus(!focus)}>{focus ? t('writing.bar.exitFocus') : t('writing.bar.focus')}</button>
      </div>
    </div>
  );
}
