import { t } from '../../i18n';
import { useEffect, useState } from 'react';
import { CLOCK_TOP, patchClock, setClockFixed, useClockSettings } from '../../lib/clock';
import { pageScrollTop, useScrollY } from '../../lib/pageScroll';
import { openMenu } from '../ContextMenu';
import Clock, { clockMenuItems } from './Clock';

// Saatin ekranın üstünde serbest duran hâli (Windows 7 masaüstü gadget'ı gibi), depolama göstergesiyle aynı davranış:
// masaüstünde sürüklenir; üzerine gelince sağında küçük düğmeler çıkar (kapat, seçenekler).
// Ekranda sabit durur ya da sayfayla birlikte kayar (Settings.clock.fixed). Telefonda sol altta küçük analog rozet olur.

const MOBILE = '(max-width: 600px)';
/** sağdaki düğme sütununun genişliği (px) */
const TOOLS = 26;
/** gadget'ın kendisi (px) */
const SIZE = 140;

function useMobile() {
  const [m, setM] = useState(() => matchMedia(MOBILE).matches);
  useEffect(() => {
    const q = matchMedia(MOBILE);
    const on = () => setM(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return m;
}

export default function ClockGadget({ home }: { home: boolean }) {
  const s = useClockSettings();
  const mobile = useMobile();
  const [live, setLive] = useState<{ left: number; top: number } | null>(null);
  const [vp, setVp] = useState({ vw: innerWidth, vh: innerHeight });
  const fixed = s.fixed ?? true;
  const scrollY = useScrollY(!fixed && !mobile);

  useEffect(() => {
    const on = () => setVp({ vw: innerWidth, vh: innerHeight });
    on();
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);

  if (s.hidden || (s.scope === 'home' && !home)) return null;

  if (mobile) {
    return (
      <div className="clock-gadget mobile">
        <Clock s={{ ...s, label: undefined }} bare />
      </div>
    );
  }

  const clamp = (left: number, top: number) => ({
    left: Math.max(0, Math.min(left, vp.vw - SIZE - TOOLS)),
    top: Math.max(0, Math.min(top, vp.vh - SIZE)),
  });
  const top = s.y !== undefined ? s.y * vp.vh : CLOCK_TOP;
  // sayfayla kayan gadget dikeyde ekrana kıstırılmaz, sayfa kaydıkça yukarı gider
  const place = (left: number) => (fixed ? clamp(left, top) : { left: clamp(left, 0).left, top: top - scrollY });
  // Konum kaydedilmemişse sağ kenara yaslı durur
  const style: React.CSSProperties = live ?? (s.x !== undefined ? place(s.x * vp.vw) : { right: 28 + TOOLS, top: place(0).top });

  // Gövdenin her yerinden sürüklenir; az kıpırdayan tık sayılmaz
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
    let cur: { left: number; top: number } | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!cur && Math.hypot(dx, dy) < 4) return;
      cur = clamp(start.left + dx, start.top + dy);
      setLive(cur);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (cur) void patchClock({ x: cur.left / vp.vw, y: (cur.top + (fixed ? 0 : pageScrollTop())) / vp.vh });
      setLive(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const hide = () => void patchClock({ hidden: true });
  const menu = (x: number, y: number) => openMenu(x, y, clockMenuItems(s, [
    { key: 's3', sep: true },
    { key: 'scope-all', icon: s.scope !== 'home' ? '✓' : '', label: t('clock.settings.scopeAll'), run: () => void patchClock({ scope: 'all' }) },
    { key: 'scope-home', icon: s.scope === 'home' ? '✓' : '', label: t('clock.settings.scopeHome'), run: () => void patchClock({ scope: 'home' }) },
    { key: 's4', sep: true },
    { key: 'fixed', icon: fixed ? '✓' : '', label: t('clock.settings.fixedOn'), run: () => void setClockFixed(!fixed, pageScrollTop()) },
    { key: 's5', sep: true },
    { key: 'hide', icon: '×', label: t('clock.hide'), run: hide },
  ]));

  return (
    <div className={`clock-gadget ${live ? 'dragging' : ''}`} style={style}
      onPointerDown={onDown} onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
      <Clock s={s} />
      <div className="meter-tools">
        <button title={t('clock.hide')} onClick={hide}>×</button>
        <button title={t('clock.options')} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); menu(b.right + 2, b.top); }}>⚙</button>
      </div>
    </div>
  );
}
