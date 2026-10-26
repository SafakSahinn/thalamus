import { localeTag, t } from '../i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInstalled } from '../lib/plugins';
import { go } from '../lib/router';
import { createNote, useStore } from '../lib/store';
import {
  addSticky, COLORS, MIN_H, MIN_W, paperClass, paperPatch, patchSticky, PATTERNS, placeRect, raiseSticky, removeSticky,
  setStickiesHidden, SHAPE_MIN_W, shapeOf, shapePatch, shapeRect, stickyToNote, useStickyUi, type Sticky,
} from '../lib/sticky';
import { clipId, SHAPES, type ShapeDef } from '../lib/stickyShapes';
import { openMenu, type MenuItem } from './ContextMenu';

// Ekranın üstünde duran yapışkan kâğıtlar. Masaüstünde sürüklenir/boyutlanır; telefonda sağ altta küçük
// renkli düğmeler olarak durur, dokununca ortada açılır. Ayarlardan yalnız ana sayfada görünmesi seçilebilir.

const MOBILE = '(max-width: 600px)';

function useViewport() {
  const read = () => ({ vw: innerWidth, vh: innerHeight, mobile: matchMedia(MOBILE).matches });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return v;
}

export default function StickyNotes({ home }: { home: boolean }) {
  const list = useStore((s) => s.settings.stickies);
  const scope = useStore((s) => s.settings.stickyScope ?? 'all');
  const hidden = useStickyUi((s) => s.hidden);
  const open = useStickyUi((s) => s.open);
  const art = useInstalled('stickyArt');
  const shapes = useInstalled('stickyShape');
  const { vw, vh, mobile } = useViewport();

  // Alt Y: bu cihazda kâğıtları gizle / göster
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyY') {
        e.preventDefault();
        setStickiesHidden(!useStickyUi.getState().hidden);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!list?.length || hidden || (scope === 'home' && !home)) return null;
  // DOM sırası sabit kalsın (sürüklerken öne getirmek işaretçi yakalamasını bozmasın); üstteki = listede sonraki
  const stable = [...list].sort((a, b) => a.id.localeCompare(b.id));
  const z = (id: string) => list.findIndex((s) => s.id === id);

  if (mobile) {
    const cur = list.find((s) => s.id === open);
    return (
      <div className="sticky-layer">
        <div className="sticky-dock">
          {list.map((s) => (
            <button key={s.id} className={`sticky-tab ${paperClass(s, art)} ${s.id === open ? 'on' : ''}`} title={s.text.split('\n')[0] || t('study.sticky.empty')}
              onClick={() => useStickyUi.setState({ open: s.id === open ? null : s.id })}>
              {s.text.trim().charAt(0).toLocaleUpperCase(localeTag())}
            </button>
          ))}
        </div>
        {cur && <Paper key={cur.id} s={cur} rect={mobileRect(cur, shapes, vw, vh)} vw={vw} vh={vh} z={1} art={art} shapes={shapes} mobile />}
        {shapes && <ShapeClips />}
      </div>
    );
  }

  return (
    <div className="sticky-layer">
      {stable.map((s) => {
        const d = shapeOf(s, shapes);
        return <Paper key={s.id} s={s} rect={d ? shapeRect(s, d, vw, vh) : placeRect(s, vw, vh)} vw={vw} vh={vh} z={z(s.id)} art={art} shapes={shapes} />;
      })}
      {shapes && <ShapeClips />}
    </div>
  );
}

type Rect = { left: number; top: number; w: number; h: number };

/** Telefonda açık kâğıt: dikdörtgen CSS'le yerleşir; şekilli kâğıt ekrana sığan en büyük boyutta, oranı korunarak */
function mobileRect(s: Sticky, shapes: boolean, vw: number, vh: number): Rect {
  const d = shapeOf(s, shapes);
  if (!d) return { left: 0, top: 0, w: 0, h: 0 };
  const w = Math.min(vw - 68, (vh * 0.55 * d.w) / d.h);
  return { left: 12, top: 64, w, h: (w * d.h) / d.w };
}

/** Şekillerin kırpma yolları 0-1 kutusuna ölçeklenir: her boyuttaki kâğıda ve menü kutucuğuna oturur */
function ShapeClips() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {SHAPES.map((d) => (
          <clipPath key={d.id} id={clipId(d.id)} clipPathUnits="objectBoundingBox">
            {d.paths.map((p, i) => <path key={i} d={p.d} clipRule={p.evenodd ? 'evenodd' : undefined} transform={`scale(${1 / d.w} ${1 / d.h})`} />)}
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}

function Paper({ s, rect, vw, vh, z, art, shapes, mobile }: { s: Sticky; rect: Rect; vw: number; vh: number; z: number; art: boolean; shapes: boolean; mobile?: boolean }) {
  const shape = shapeOf(s, shapes);
  const [text, setText] = useState(s.text);
  const [live, setLive] = useState<Rect | null>(null);
  const [sizing, setSizing] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  /** şekilli kâğıttaki yazı alanı: içerik kadar yer kaplasın diye contenteditable, içeriğini kendisi tutar */
  const shapeText = useRef<HTMLDivElement>(null);
  const editing = useRef(false);
  const pending = useRef<{ t: number; v: string } | null>(null);

  const showText = (v: string) => {
    const el = shapeText.current;
    if (el && el.innerText !== v) el.textContent = v;
  };

  // Başka cihazdan gelen değişiklik (yazmıyorken)
  useEffect(() => {
    if (!editing.current && !pending.current) {
      setText(s.text);
      showText(s.text);
    }
  }, [s.text]);

  // Dikdörtgenden şekle geçince yeni yazı alanı boş doğar
  useLayoutEffect(() => showText(text), [shape?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yeni açılan kâğıda imleç
  useEffect(() => {
    if (useStickyUi.getState().focus === s.id) {
      (area.current ?? shapeText.current)?.focus();
      useStickyUi.setState({ focus: null });
    }
  }, [s.id]);

  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.t);
    const v = pending.current.v;
    pending.current = null;
    patchSticky(s.id, { text: v });
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onText = (v: string) => {
    setText(v);
    if (pending.current) clearTimeout(pending.current.t);
    pending.current = { v, t: window.setTimeout(flush, 500) };
  };

  // Sürükleme (başlık şeridi) ve boyutlandırma (sağ alt köşe): Pointer Events, bırakınca kaydet
  const startDrag = (e: React.PointerEvent, mode: 'move' | 'size') => {
    if (mobile || e.button !== 0 || (mode === 'move' && (e.target as HTMLElement).closest('button'))) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    if (mode === 'size') setSizing(true);
    const start = { x: e.clientX, y: e.clientY, ...rect };
    let cur: Rect = rect;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (mode === 'move') {
        cur = { ...start, left: Math.max(0, Math.min(start.left + dx, vw - start.w)), top: Math.max(0, Math.min(start.top + dy, vh - start.h)) };
      } else if (shape) {
        // şekil ezilmesin: genişlik sürüklenir, yükseklik orandan gelir
        const ratio = shape.h / shape.w;
        const w = Math.max(SHAPE_MIN_W, Math.min(start.w + dx, vw - start.left, (vh - start.top) / ratio));
        cur = { ...start, w, h: w * ratio };
      } else {
        cur = { ...start, w: Math.max(MIN_W, Math.min(start.w + dx, vw - start.left)), h: Math.max(MIN_H, Math.min(start.h + dy, vh - start.top)) };
      }
      setLive(cur);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (cur !== rect) patchSticky(s.id, mode === 'move' ? { x: cur.left / vw, y: cur.top / vh } : { w: cur.w, h: cur.h });
      setLive(null);
      setSizing(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  // Şekilli kâğıtta boş bir yere tıklayınca yazı oraya taşınır, imleç yazının sonuna konur
  const placeText = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = shapeText.current;
    if (e.target !== e.currentTarget || e.button !== 0 || !el) return;
    e.preventDefault();
    const b = e.currentTarget.getBoundingClientRect();
    const line = parseFloat(getComputedStyle(el).fontSize) * 0.7;
    patchSticky(s.id, { tx: Math.min((e.clientX - b.left) / b.width, 0.9), ty: Math.max(0, (e.clientY - b.top - line) / b.height) });
    el.focus();
    const sel = getSelection();
    sel?.selectAllChildren(el);
    sel?.collapseToEnd();
  };

  const remove = () => {
    if (text.trim() && !confirm(t('study.sticky.confirmDelete'))) return;
    if (pending.current) clearTimeout(pending.current.t);
    pending.current = null;
    removeSticky(s.id);
  };

  const toNote = () => {
    flush();
    const { title, content } = stickyToNote(text);
    const n = createNote('note', title, {}, content);
    removeSticky(s.id);
    useStickyUi.setState({ open: null });
    go(`/n/${n.id}`);
  };

  const patterned = art && !shape && !!s.pattern;
  const addNext = () => addSticky(undefined, s.color, patterned ? s.pattern : undefined, shape?.id);
  const menu = (x: number, y: number) => {
    // desen seçilince şekilli kâğıt dikdörtgene döner (şeklin içi düz renk)
    const pick = (c: string) => patchSticky(s.id, { ...(shape && !COLORS.some((k) => k.id === c) ? shapePatch('rect') : {}), ...paperPatch(c) });
    const items: MenuItem[] = [{ key: 'colors', className: 'sticky-swatch', swatches: COLORS.map((c) => ({ id: c.id, label: c.label, on: !patterned && c.id === s.color })), pick }];
    // desenler renk sırasıyla aynı genişlikte, 6'şarlı sıralar hâlinde (Desenli not kâğıtları eklentisi)
    if (art) {
      for (let i = 0; i < PATTERNS.length; i += COLORS.length) {
        const row = PATTERNS.slice(i, i + COLORS.length);
        items.push({ key: `pat${i}`, className: 'sticky-swatch pat', swatches: row.map((p) => ({ id: p.id, label: p.label, on: patterned && s.pattern === p.id })), pick });
      }
    }
    // şekiller (Şekilli not kâğıtları eklentisi): ilk kutucuk dikdörtgen; kutucukta şeklin kendisi görünür
    if (shapes) {
      const all: (ShapeDef | { id: 'rect'; label: string })[] = [{ id: 'rect', label: t('study.sticky.shapes.rect') }, ...SHAPES];
      for (let i = 0; i < all.length; i += COLORS.length) {
        items.push({
          key: `shape${i}`,
          className: `sticky-swatch shape c-${s.color}`,
          swatches: all.slice(i, i + COLORS.length).map((d) => ({
            id: `s-${d.id}`,
            label: d.label,
            on: (shape?.id ?? 'rect') === d.id,
            style: 'paths' in d ? ({ '--clip': `url(#${clipId(d.id)})`, '--ar': d.w / d.h } as React.CSSProperties) : undefined,
          })),
          pick: (id) => patchSticky(s.id, shapePatch(id.slice(2))),
        });
      }
    }
    items.push({ key: 's1', sep: true }, { key: 'new', icon: '＋', label: t('study.sticky.new'), run: addNext });
    if (text.trim()) items.push({ key: 'note', icon: '📄', label: t('study.sticky.toNote'), run: toNote });
    items.push({ key: 's2', sep: true }, { key: 'del', icon: '🗑', label: t('common.delete'), danger: true, run: remove });
    openMenu(x, y, items);
  };
  const menuTitle = t(art && shapes ? 'study.sticky.menuAll' : art ? 'study.sticky.menuArt' : shapes ? 'study.sticky.menuShape' : 'study.sticky.menu');
  const openFrom = (e: React.MouseEvent) => { const b = e.currentTarget.getBoundingClientRect(); menu(b.left, b.bottom + 2); };

  const r = live ?? rect;

  if (shape) {
    const tx = s.tx ?? shape.tx;
    const ty = s.ty ?? shape.ty;
    // yazı boyutu kâğıt genişliğinin yüzdesi (cqw): şeklin varsayılan genişliğinde 14.5px, kâğıtla birlikte büyür
    const style = { left: r.left, top: r.top, width: r.w, height: r.h, zIndex: z, '--fs': 1450 / shape.width } as React.CSSProperties;
    return (
      <div className={`sticky shaped s-${shape.id} c-${s.color} ${mobile ? 'mobile' : ''} ${live ? 'dragging' : ''} ${sizing ? 'sizing' : ''}`} style={style}
        onPointerDownCapture={() => raiseSticky(s.id)}>
        <div className="sticky-shape" style={{ clipPath: `url(#${clipId(shape.id)})` }} onPointerDown={placeText}
          onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
          <div ref={shapeText} className="sticky-text" contentEditable="plaintext-only" role="textbox" aria-multiline aria-label={t('study.sticky.aria')}
            spellCheck={false} style={{ left: `${tx * 100}%`, top: `${ty * 100}%`, maxWidth: `${(1 - tx) * 100}%` }}
            onInput={(e) => onText(e.currentTarget.innerText)}
            onFocus={() => { editing.current = true; }}
            onBlur={() => { editing.current = false; flush(); }} />
        </div>
        {/* şeklin üstünde, fareyle gelince beliren küçük araç şeridi: boş yerinden sürüklenir */}
        <div className="sticky-tool" title={t('study.sticky.move')} onPointerDown={(e) => startDrag(e, 'move')}>
          <span className="sticky-move" aria-hidden>⠿</span>
          <button title={t('study.sticky.new')} onClick={addNext}>＋</button>
          <button title={menuTitle} onClick={openFrom}>⋯</button>
          {mobile && <button title={t('study.sticky.minimize')} onClick={() => { flush(); useStickyUi.setState({ open: null }); }}>▾</button>}
          <button title={t('common.delete')} onClick={remove}>×</button>
        </div>
        {!mobile && <div className="sticky-grip" title={t('study.sticky.resize')} onPointerDown={(e) => startDrag(e, 'size')} />}
      </div>
    );
  }

  const style: React.CSSProperties = mobile ? { zIndex: z } : { left: r.left, top: r.top, width: r.w, height: r.h, zIndex: z };
  return (
    <div className={`sticky ${paperClass(s, art)} ${mobile ? 'mobile' : ''} ${live ? 'dragging' : ''} ${sizing ? 'sizing' : ''}`} style={style}
      onPointerDownCapture={() => raiseSticky(s.id)}>
      {/* kâğıt ayrı katmanda: kıvrık köşe gölgeleri (::before/::after) onun arkasında kalsın */}
      <div className="sticky-paper">
        <div className="sticky-head" onPointerDown={(e) => startDrag(e, 'move')}
          onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
          <button title={t('study.sticky.new')} onClick={addNext}>＋</button>
          <span className="spacer" />
          <button title={menuTitle} onClick={openFrom}>⋯</button>
          {mobile && <button title={t('study.sticky.minimize')} onClick={() => { flush(); useStickyUi.setState({ open: null }); }}>▾</button>}
          <button title={t('common.delete')} onClick={remove}>×</button>
        </div>
        <textarea ref={area} value={text} spellCheck={false} aria-label={t('study.sticky.aria')}
          onChange={(e) => onText(e.target.value)}
          onFocus={() => { editing.current = true; }}
          onBlur={() => { editing.current = false; flush(); }} />
        {!mobile && <div className="sticky-grip" title={t('study.sticky.resize')} onPointerDown={(e) => startDrag(e, 'size')} />}
      </div>
    </div>
  );
}
