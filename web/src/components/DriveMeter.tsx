import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import {
  METER_TOP, patchMeter, refreshMeter, setMeterFixed, SKINS, useMeter, useMeterSettings, VIEWS, watchMeter, type MeterSettings,
} from '../lib/driveMeter';
import { pageScrollTop, useScrollY } from '../lib/pageScroll';
import { openMenu, type MenuItem } from './ContextMenu';
import MeterView, { Badge, meterTooltip } from './meter/MeterView';

// Depolama göstergesinin ekranın üstünde serbest duran hâli (Windows 7 masaüstü gadget'ı gibi).
// Masaüstünde sürüklenir; üzerine gelince sağında orijinaldeki gibi küçük düğmeler çıkar (kapat, boy, seçenekler).
// Ekranda sabit durur ya da sayfayla birlikte kayar (Settings.meter.fixed).
// Telefonda yer kaplamasın diye hangi görünüm seçilmiş olursa olsun sol altta küçük metin rozeti olur.

const MOBILE = '(max-width: 600px)';
/** sağdaki düğme sütununun genişliği (px) */
const TOOLS = 26;

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

/** Görünüm, kaplama ve boy seçimleri (gadget menüsü ve ana sayfa bileşeni ortak) */
export function meterMenuItems(s: MeterSettings, extra: MenuItem[] = []): MenuItem[] {
  const view = s.view ?? 'win7';
  const check = (on: boolean) => (on ? '✓' : '');
  const items: MenuItem[] = [
    { key: 'refresh', icon: '⟳', label: t('meter.refresh'), run: () => void refreshMeter() },
    { key: 's1', sep: true },
    ...VIEWS.map((v): MenuItem => ({ key: `v-${v}`, icon: check(view === v), label: t(`meter.views.${v}`), run: () => void patchMeter({ view: v }) })),
  ];
  if (view === 'win7') {
    items.push({ key: 's2', sep: true });
    for (const k of SKINS) items.push({ key: `k-${k}`, icon: check((s.skin ?? 'original') === k), label: t(`meter.skins.${k}`), run: () => void patchMeter({ skin: k }) });
  }
  return [...items, ...extra];
}

export default function DriveMeter({ home }: { home: boolean }) {
  const s = useMeterSettings();
  const data = useMeter((m) => m.data);
  const error = useMeter((m) => m.error);
  const mobile = useMobile();
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<{ left: number; top: number } | null>(null);
  const [vp, setVp] = useState({ vw: innerWidth, vh: innerHeight });
  const fixed = s.fixed ?? true;
  const scrollY = useScrollY(!fixed && !mobile);

  useEffect(() => watchMeter(), []);
  useEffect(() => {
    const on = () => setVp({ vw: innerWidth, vh: innerHeight });
    on(); // ilk çizimle dinleyici arasında boyut değişmiş olabilir
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);

  if (s.hidden || (s.scope === 'home' && !home)) return null;
  const tip = meterTooltip(data, error);

  if (mobile) {
    return (
      <div className="meter-gadget mobile" title={tip} onClick={() => void refreshMeter()}>
        {data ? <Badge d={data} /> : <span className="meter-badge dim">{t('meter.loading')}</span>}
      </div>
    );
  }

  // Boyut görünüme göre değişir; sağdaki düğme sütunu da ekrana sığmalı
  const size = () => ({ w: (box.current?.offsetWidth ?? 260) + TOOLS, h: box.current?.offsetHeight ?? 190 });
  const clamp = (left: number, top: number) => {
    const { w, h } = size();
    return { left: Math.max(0, Math.min(left, vp.vw - w)), top: Math.max(0, Math.min(top, vp.vh - h)) };
  };
  const top = s.y !== undefined ? s.y * vp.vh : METER_TOP;
  // sayfayla kayan gadget dikeyde ekrana kıstırılmaz, sayfa kaydıkça yukarı gider
  const place = (left: number) => (fixed ? clamp(left, top) : { left: clamp(left, 0).left, top: top - scrollY });
  // Konum kaydedilmemişse sağ kenara yaslı durur (görünüm değişince genişlik değişse de taşmaz)
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
      if (cur) void patchMeter({ x: cur.left / vp.vw, y: (cur.top + (fixed ? 0 : pageScrollTop())) / vp.vh });
      setLive(null);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const hide = () => void patchMeter({ hidden: true });
  const menu = (x: number, y: number) => openMenu(x, y, meterMenuItems(s, [
    { key: 's3', sep: true },
    { key: 'scope-all', icon: s.scope !== 'home' ? '✓' : '', label: t('meter.settings.scopeAll'), run: () => void patchMeter({ scope: 'all' }) },
    { key: 'scope-home', icon: s.scope === 'home' ? '✓' : '', label: t('meter.settings.scopeHome'), run: () => void patchMeter({ scope: 'home' }) },
    { key: 's4', sep: true },
    { key: 'fixed', icon: fixed ? '✓' : '', label: t('meter.settings.fixedOn'), run: () => void setMeterFixed(!fixed, pageScrollTop()) },
    { key: 's5', sep: true },
    { key: 'hide', icon: '×', label: t('meter.hide'), run: hide },
  ]));
  const win7 = (s.view ?? 'win7') === 'win7';

  return (
    <div ref={box} className={`meter-gadget ${live ? 'dragging' : ''}`} style={style} title={tip}
      onPointerDown={onDown} onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
      {data ? <MeterView data={data} s={s} /> : <span className="meter-badge dim">{t('meter.loading')}</span>}
      <div className="meter-tools">
        <button title={t('meter.hide')} onClick={hide}>×</button>
        {win7 && <button title={s.size === 'small' ? t('meter.larger') : t('meter.smaller')} onClick={() => void patchMeter({ size: s.size === 'small' ? 'large' : 'small' })}>
          {s.size === 'small' ? '⤢' : '⤡'}
        </button>}
        <button title={t('meter.options')} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); menu(b.right + 2, b.top); }}>⚙</button>
        <button title={t('meter.refresh')} onClick={() => void refreshMeter()}>⟳</button>
      </div>
    </div>
  );
}
