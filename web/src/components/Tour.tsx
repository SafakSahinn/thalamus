import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { t, type Messages } from '../i18n';
import { parse, useHash, type Route } from '../lib/router';

// Adım adım tanıtım turu: gerçek düğmeleri sırayla vurgular, kullanıcı kendisi tıklar.
// Hedefler data-tour="…" ile işaretli. Hedef görünmüyorsa (telefonda kapalı menü) önce menü düğmesi gösterilir.

interface Step {
  target: string;
  text: ReactNode;
  /** Bu sayfaya gelince kendiliğinden ilerler (yoksa "İleri" düğmesi) */
  until?: (r: Route) => boolean;
  /** Hedef kenar çubuğunda: telefonda önce menü açılmalı */
  sidebar?: boolean;
}

type TourKey = keyof Messages['tour'];
/** Adım; metin her gösterimde etkin dilden kurulur */
const tourStep = (target: string, key: TourKey, o: Pick<Step, 'until' | 'sidebar'> = {}): Step => ({ target, ...o, get text() { return t.rich(`tour.${key}`); } });

const STEPS: Step[] = [
  tourStep('new-note', 'newNote', { until: (r) => r.name === 'note' }),
  tourStep('title', 'title'),
  tourStep('editor', 'editor'),
  tourStep('props', 'props'),
  tourStep('nav-daily', 'navDaily', { sidebar: true, until: (r) => r.name === 'daily' }),
  tourStep('routines', 'routines'),
  tourStep('coll-book', 'collBook', { sidebar: true, until: (r) => r.name === 'collection' && r.type === 'book' }),
  tourStep('views', 'views'),
  tourStep('coll-word', 'collWord', { sidebar: true, until: (r) => r.name === 'dictionary' }),
  tourStep('dictionary', 'dictionary'),
  tourStep('nav-calendar', 'navCalendar', { sidebar: true, until: (r) => r.name === 'calendar' }),
  tourStep('calendar', 'calendar'),
  tourStep('nav-graph', 'navGraph', { sidebar: true, until: (r) => r.name === 'graph' }),
  tourStep('graph', 'graph'),
  tourStep('search', 'search'),
  tourStep('nav-settings', 'navSettings', { sidebar: true, until: (r) => r.name === 'settings' }),
  tourStep('gcal', 'gcal'),
  tourStep('', 'done'),
];

const useTour = create<{ step: number | null }>(() => ({ step: null }));

export const startTour = () => useTour.setState({ step: 0 });
const stop = () => useTour.setState({ step: null });
const next = () => useTour.setState((s) => ({ step: s.step === null || s.step + 1 >= STEPS.length ? null : s.step + 1 }));

const find = (name: string): HTMLElement | null => {
  if (!name) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth) return el;
  }
  return null;
};

export default function Tour() {
  const step = useTour((s) => s.step);
  const hash = useHash();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viaMenu, setViaMenu] = useState(false);
  const s = step === null ? null : STEPS[step];

  // Hedef sayfaya gelindiyse ilerle
  // Kullanıcı birkaç adım öne geçtiyse (ör. açıklamayı okumadan başka sayfaya tıkladıysa) tur da oraya atlar
  useEffect(() => {
    if (step === null) return;
    const r = parse(hash);
    for (let i = STEPS.length - 1; i >= step; i--) {
      if (STEPS[i].until?.(r)) {
        useTour.setState({ step: i + 1 < STEPS.length ? i + 1 : null });
        return;
      }
    }
  }, [hash, step]);

  // Hedefi izle (sayfa değişir, menü açılır, düzen kayar)
  useLayoutEffect(() => {
    if (!s) return;
    let shown: HTMLElement | null = null;
    const tick = () => {
      let el = find(s.target);
      let menu = false;
      if (!el && s.sidebar) {
        el = find('menu');
        menu = Boolean(el);
      }
      setViaMenu(menu);
      // Yalnızca hedef ilk bulunduğunda kaydır; kullanıcının kaydırmasıyla kavga etme
      if (el && !menu && el !== shown) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      shown = menu ? null : el;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    tick();
    const id = setInterval(tick, 250);
    addEventListener('resize', tick);
    return () => {
      clearInterval(id);
      removeEventListener('resize', tick);
    };
  }, [s]);

  if (!s || step === null) return null;

  const pad = 6;
  const W = Math.min(340, innerWidth - 32);
  let top = innerHeight / 2 - 90;
  let left = innerWidth / 2 - W / 2;
  if (rect) {
    const below = rect.bottom + pad + 12;
    top = below + 190 < innerHeight ? below : Math.max(16, rect.top - pad - 12 - 190);
    left = Math.min(Math.max(16, rect.left + rect.width / 2 - W / 2), innerWidth - W - 16);
    // Büyük hedefte (editör, takvim) kartı hedefin içine, alta yerleştir
    if (rect.height > innerHeight * 0.5) top = Math.min(innerHeight - 220, Math.max(rect.top + 16, innerHeight - 240));
  }

  return (
    <div className="tour" aria-live="polite">
      {rect ? (
        <div className="tour-hole" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" role="dialog" aria-label={t('tour.aria')} style={{ top, left, width: W }}>
        <div className="tour-text">{viaMenu ? t.rich('tour.openMenu') : s.text}</div>
        <div className="tour-foot">
          <span className="muted small">{step + 1} / {STEPS.length}</span>
          <span className="spacer" />
          {step + 1 < STEPS.length && <button type="button" className="btn ghost small" onClick={stop}>{t('tour.skipTour')}</button>}
          {!s.until && (
            <button type="button" className="btn primary small" onClick={next}>{step + 1 < STEPS.length ? t('tour.next') : t('tour.finish')}</button>
          )}
          {s.until && <button type="button" className="btn small" onClick={next} title={t('tour.skipStepTitle')}>{t('tour.skipStep')}</button>}
        </div>
      </div>
    </div>
  );
}
