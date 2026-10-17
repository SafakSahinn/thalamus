// Çalışma süresi takibi: bir notta (ders, makale, proje…) zamanlayıcı başlat; durdurunca oturum o notun
// gizli alanına (props.__time) yazılır. İsteğe bağlı pomodoro (25 dk). Çalışan zamanlayıcı sayfa yenilense de sürer.

import { create } from 'zustand';
import { showNotification } from './notify';
import { relationIds, type Note } from './types';
import { setProp, useStore } from './store';

export interface Session {
  start: string;
  /** dakika */
  min: number;
}

interface Running {
  noteId: string;
  start: number;
  /** pomodoro süresi (dk); yoksa serbest */
  pomo?: number;
}

const KEY = 'studyTimer';
const load = (): Running | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Running | null;
  } catch {
    return null;
  }
};

export const useTimer = create<{ running: Running | null }>(() => ({ running: load() }));

const persist = (r: Running | null) => {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch {
    /* yok say */
  }
  useTimer.setState({ running: r });
};

export const sessionsOf = (n: Note): Session[] => (Array.isArray(n.props.__time) ? (n.props.__time as Session[]) : []);
export const totalMin = (n: Note) => sessionsOf(n).reduce((a, s) => a + s.min, 0);

export function startTimer(noteId: string, pomo?: number) {
  stopTimer();
  persist({ noteId, start: Date.now(), pomo });
}

/** Durdur ve kaydet (1 dakikadan kısa oturumlar kaydedilmez) */
export function stopTimer(): Session | null {
  const r = useTimer.getState().running;
  if (!r) return null;
  persist(null);
  const min = Math.round((Date.now() - r.start) / 60_000);
  const n = useStore.getState().notes[r.noteId];
  if (!n || min < 1) return null;
  const s: Session = { start: new Date(r.start).toISOString(), min: r.pomo ? Math.min(min, r.pomo) : min };
  setProp(n.id, '__time', [...sessionsOf(n), s]);
  return s;
}

export const fmtMin = (m: number) => (m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`);

/** Pomodoro bitince bildir ve kaydet (uygulama açıkken saniyede bir kontrol) */
export function watchTimer() {
  const id = setInterval(() => {
    const r = useTimer.getState().running;
    if (!r?.pomo || Date.now() - r.start < r.pomo * 60_000) return;
    const n = useStore.getState().notes[r.noteId];
    stopTimer();
    void showNotification({ title: '🍅 Pomodoro bitti', body: `${n?.title || 'Çalışma'}: ${r.pomo} dakika tamam. Kısa bir mola ver.`, noteId: r.noteId, key: `pomo-${r.start}` }).catch(() => undefined);
  }, 1000);
  return () => clearInterval(id);
}

/** Oturumu kime yazalım: dersi olan not (makale, deney, not) ders altında toplanır */
export function groupOf(n: Note, notes: Record<string, Note>): Note {
  const c = relationIds(n.props.course)[0];
  return (c && notes[c]) || n;
}

const p2 = (x: number) => String(x).padStart(2, '0');
export const localDay = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Son `days` günün günlük dakikaları ve dönem içindeki (gruplanmış) not toplamları */
export function studyStats(notes: Record<string, Note>, days: number, today = new Date()) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
  const byDay = new Map<string, number>();
  const byGroup = new Map<string, number>();
  for (let i = 0; i < days; i++) byDay.set(localDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)), 0);
  for (const n of Object.values(notes)) {
    if (n.deleted_at) continue;
    for (const s of sessionsOf(n)) {
      const d = new Date(s.start);
      if (d < from) continue;
      const k = localDay(d);
      if (byDay.has(k)) byDay.set(k, byDay.get(k)! + s.min);
      const g = groupOf(n, notes);
      byGroup.set(g.id, (byGroup.get(g.id) ?? 0) + s.min);
    }
  }
  return {
    days: [...byDay].map(([day, min]) => ({ day, min })),
    groups: [...byGroup].map(([id, min]) => ({ note: notes[id], min })).filter((x) => x.note).sort((a, b) => b.min - a.min),
    total: [...byDay.values()].reduce((a, b) => a + b, 0),
  };
}
