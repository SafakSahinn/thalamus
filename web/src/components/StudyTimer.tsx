import { useEffect, useState } from 'react';
import { displayTitle } from '../lib/format';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { fmtMin, startTimer, stopTimer, totalMin, useTimer } from '../lib/timer';
import type { Note } from '../lib/types';

// Çalışma zamanlayıcısı: not başlığındaki düğme + kenar çubuğundaki çalışan sayaç.

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Saniyede bir yenilenen geçen/kalan süre */
function useElapsed() {
  const running = useTimer((s) => s.running);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!running) return null;
  const el = now - running.start;
  return { running, text: running.pomo ? clock(running.pomo * 60_000 - el) : clock(el) };
}

export function TimerButton({ note }: { note: Note }) {
  const t = useElapsed();
  const [menu, setMenu] = useState(false);
  const total = totalMin(note);
  if (t?.running.noteId === note.id) {
    return (
      <button className="lock-badge timer-on" title="Durdur ve kaydet" onClick={() => stopTimer()}>
        {t.running.pomo ? '🍅' : '⏱'} {t.text} ⏹
      </button>
    );
  }
  return (
    <span className="menuwrap">
      <button className="lock-badge" title={total ? `Bu notta toplam ${fmtMin(total)} çalışıldı` : 'Çalışma süresini ölç'} onClick={() => setMenu((m) => !m)}>
        ⏱ {total ? fmtMin(total) : 'Çalış'}
      </button>
      {menu && (
        <div className="dropdown" onMouseLeave={() => setMenu(false)}>
          <button className="btn small" onClick={() => { startTimer(note.id); setMenu(false); }}>⏱ Zamanlayıcıyı başlat</button>
          <button className="btn small" onClick={() => { startTimer(note.id, 25); setMenu(false); }}>🍅 Pomodoro (25 dk)</button>
          <button className="btn small" onClick={() => { startTimer(note.id, 50); setMenu(false); }}>🍅 Uzun odak (50 dk)</button>
          <button className="btn small" onClick={() => { setMenu(false); go('/calisma'); }}>📊 Çalışma istatistikleri</button>
        </div>
      )}
    </span>
  );
}

/** Kenar çubuğunda: zamanlayıcı çalışırken hangi notta olduğunu ve süreyi gösterir */
export function TimerPill() {
  const t = useElapsed();
  const note = useStore((s) => (t ? s.notes[t.running.noteId] : undefined));
  if (!t) return null;
  return (
    <div className="timer-pill">
      <a href={`#/n/${t.running.noteId}`} title="Nota git">
        {t.running.pomo ? '🍅' : '⏱'} <b>{t.text}</b> <span className="muted">{note ? displayTitle(note) : ''}</span>
      </a>
      <button className="iconbtn" title="Durdur ve kaydet" onClick={() => stopTimer()}>⏹</button>
    </div>
  );
}
