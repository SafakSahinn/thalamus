import { localeTag, t } from '../i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInstalled } from '../lib/plugins';
import { go } from '../lib/router';
import { createNote, uid, useStore } from '../lib/store';
import {
  addSticky, blocksOf, blocksPatch, COLORS, fixedPatch, isFixed, MIN_H, MIN_W, paperClass, paperPatch, patchSticky, PATTERNS, placeRect,
  raiseSticky, removeSticky, setStickiesHidden, SHAPE_MIN_W, shapeOf, shapePatch, shapeRect, stickyToNote, useStickyUi,
  type Sticky, type StickyBlock,
} from '../lib/sticky';
import { clipId, SHAPES, type ShapeDef } from '../lib/stickyShapes';
import { openMenu, type MenuItem } from './ContextMenu';

// Ekranın üstünde duran yapışkan kâğıtlar. Masaüstünde sürüklenir/boyutlanır; telefonda sağ altta küçük
// renkli düğmeler olarak durur, dokununca ortada açılır. Ayarlardan yalnız ana sayfada görünmesi seçilebilir.
// Kâğıt ekranda sabit durabilir ya da sayfayla birlikte kayabilir (Settings.stickyFixed, her kâğıt kendisi de seçer):
// kayan kâğıdın y'si sayfanın başına göredir, ekrandaki yeri <main>'in kaydırma payı kadar yukarıdadır.

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

/** Sayfanın kaydırılan alanı */
const scroller = () => document.querySelector('main');

/** <main>'in kaydırma payı; yalnız sayfayla kayan kâğıt varken dinlenir */
function useScrollY(on: boolean) {
  const [y, setY] = useState(0);
  useEffect(() => {
    const m = scroller();
    if (!on || !m) return;
    let raf = 0;
    const read = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setY(m.scrollTop)); };
    read();
    m.addEventListener('scroll', read, { passive: true });
    return () => { cancelAnimationFrame(raf); m.removeEventListener('scroll', read); };
  }, [on]);
  return on ? y : 0;
}

export default function StickyNotes({ home }: { home: boolean }) {
  const list = useStore((s) => s.settings.stickies);
  const scope = useStore((s) => s.settings.stickyScope ?? 'all');
  const fixedDef = useStore((s) => s.settings.stickyFixed);
  const hidden = useStickyUi((s) => s.hidden);
  const open = useStickyUi((s) => s.open);
  const art = useInstalled('stickyArt');
  const shapes = useInstalled('stickyShape');
  const { vw, vh, mobile } = useViewport();
  const scrollY = useScrollY(!mobile && !!list?.some((s) => !isFixed(s, fixedDef)));

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
        {cur && <Paper key={cur.id} s={cur} rect={mobileRect(cur, shapes, vw, vh)} vw={vw} vh={vh} z={1} art={art} shapes={shapes} fixed scrollY={0} mobile />}
        {shapes && <ShapeClips />}
      </div>
    );
  }

  return (
    <div className="sticky-layer">
      {stable.map((s) => {
        const d = shapeOf(s, shapes);
        const fixed = isFixed(s, fixedDef);
        const r = d ? shapeRect(s, d, vw, vh) : placeRect(s, vw, vh);
        // sayfayla kayan kâğıt: dikeyde ekrana kıstırılmaz, sayfa kaydıkça yukarı gider
        const rect = fixed ? r : { ...r, top: Math.max(0, s.y * vh) - scrollY };
        return <Paper key={s.id} s={s} rect={rect} vw={vw} vh={vh} z={z(s.id)} art={art} shapes={shapes} fixed={fixed} scrollY={fixed ? 0 : scrollY} />;
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

function Paper({ s, rect, vw, vh, z, art, shapes, fixed, scrollY, mobile }: {
  s: Sticky; rect: Rect; vw: number; vh: number; z: number; art: boolean; shapes: boolean; fixed: boolean; scrollY: number; mobile?: boolean;
}) {
  const shape = shapeOf(s, shapes);
  const [text, setText] = useState(s.text);
  const [blocks, setBlocks] = useState<StickyBlock[]>(() => (shape ? blocksOf(s, shape) : []));
  /** yeni eklenen, imlecin konacağı yazı */
  const [fresh, setFresh] = useState<string | null>(null);
  const [live, setLive] = useState<Rect | null>(null);
  const [sizing, setSizing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(false);
  const pending = useRef<{ t: number; patch: Partial<Sticky> } | null>(null);

  // Başka cihazdan gelen değişiklik (yazmıyorken)
  useEffect(() => {
    if (!editing.current && !pending.current) {
      setText(s.text);
      setBlocks(shape ? blocksOf(s, shape) : []);
    }
  }, [s.text, s.blocks, shape?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Yeni açılan kâğıda imleç
  useEffect(() => {
    if (useStickyUi.getState().focus === s.id) {
      (area.current ?? root.current?.querySelector<HTMLElement>('.sticky-text'))?.focus();
      useStickyUi.setState({ focus: null });
    }
  }, [s.id]);

  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.t);
    const { patch } = pending.current;
    pending.current = null;
    patchSticky(s.id, patch);
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** yazı değişikliklerini biriktirip yarım saniye sonra kaydeder */
  const schedule = (patch: Partial<Sticky>) => {
    if (pending.current) clearTimeout(pending.current.t);
    pending.current = { patch: { ...pending.current?.patch, ...patch }, t: window.setTimeout(flush, 500) };
  };
  const onText = (v: string) => {
    setText(v);
    schedule({ text: v });
  };
  /** şekilli kâğıdın yazıları değişti; taşıma gibi tek seferlik değişiklikler hemen kaydedilir */
  const onBlocks = (next: StickyBlock[], now = false) => {
    const patch = blocksPatch(next);
    setBlocks(next);
    setText(patch.text ?? '');
    schedule(patch);
    if (now) flush();
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
      // sayfayla kayan kâğıdın y'si sayfa başına göre
      if (cur !== rect) patchSticky(s.id, mode === 'move' ? { x: cur.left / vw, y: (cur.top + scrollY) / vh } : { w: cur.w, h: cur.h });
      setLive(null);
      setSizing(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  // Şekilli kâğıtta boş bir yere tıklayınca oraya yeni bir yazı eklenir
  const addBlock = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    e.preventDefault();
    const b = e.currentTarget.getBoundingClientRect();
    const first = e.currentTarget.querySelector<HTMLElement>('.sticky-text');
    const line = parseFloat(first ? getComputedStyle(first).fontSize : '14') * 0.7;
    const id = uid();
    // boş yazılar kaydedilmez: yazmaya başlayınca kaydolur; yazılmadan bırakılan boş yazılar burada düşer
    setBlocks((l) => [...l.filter((x) => x.text.trim()), { id, text: '', x: Math.min((e.clientX - b.left) / b.width, 0.9), y: Math.max(0, (e.clientY - b.top - line) / b.height) }]);
    setFresh(id);
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
    flush();
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
    if (!mobile) {
      items.push({ key: 'fixed', icon: fixed ? '✓' : '', label: t('study.sticky.fixed'), run: () => patchSticky(s.id, fixedPatch(s, !fixed, scroller()?.scrollTop ?? 0, vh)) });
    }
    items.push({ key: 's2', sep: true }, { key: 'del', icon: '🗑', label: t('common.delete'), danger: true, run: remove });
    openMenu(x, y, items);
  };
  const menuTitle = t(art && shapes ? 'study.sticky.menuAll' : art ? 'study.sticky.menuArt' : shapes ? 'study.sticky.menuShape' : 'study.sticky.menu');
  const openFrom = (e: React.MouseEvent) => { const b = e.currentTarget.getBoundingClientRect(); menu(b.left, b.bottom + 2); };

  const r = live ?? rect;

  if (shape) {
    // yazı boyutu kâğıt genişliğinin yüzdesi (cqw): şeklin varsayılan genişliğinde 14.5px, kâğıtla birlikte büyür
    const style = { left: r.left, top: r.top, width: r.w, height: r.h, zIndex: z, '--fs': 1450 / shape.width } as React.CSSProperties;
    return (
      <div ref={root} className={`sticky shaped s-${shape.id} c-${s.color} ${mobile ? 'mobile' : ''} ${live ? 'dragging' : ''} ${sizing ? 'sizing' : ''}`} style={style}
        onPointerDownCapture={() => raiseSticky(s.id)}>
        <div className="sticky-shape" style={{ clipPath: `url(#${clipId(shape.id)})` }} onPointerDown={addBlock}
          // fare tıklamasının varsayılanı (odağı alıp sayfada seçim başlatmak) yeni yazının odağını çalmasın
          onMouseDown={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
          onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
          {blocks.map((b) => (
            <TextBlock key={b.id} b={b} autoFocus={b.id === fresh}
              onInput={(v) => onBlocks(blocks.map((x) => (x.id === b.id ? { ...x, text: v } : x)))}
              onMove={(x, y) => onBlocks(blocks.map((k) => (k.id === b.id ? { ...k, x, y } : k)), true)}
              onFocus={() => { editing.current = true; }}
              onBlur={(v) => {
                editing.current = false;
                if (fresh === b.id) setFresh(null);
                // boş bırakılan yazı silinir (son yazı kalır)
                if (!v.trim() && blocks.length > 1) onBlocks(blocks.filter((x) => x.id !== b.id));
                flush();
              }} />
          ))}
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
    <div ref={root} className={`sticky ${paperClass(s, art)} ${mobile ? 'mobile' : ''} ${live ? 'dragging' : ''} ${sizing ? 'sizing' : ''}`} style={style}
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

/** İmleci tıklanan noktadaki harfin yanına koyar (bulunamazsa yazının sonuna) */
function placeCaret(el: HTMLElement, x: number, y: number) {
  const sel = getSelection();
  if (!sel) return;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const range = document.createRange();
  const pos = doc.caretPositionFromPoint?.(x, y);
  const old = pos ? null : doc.caretRangeFromPoint?.(x, y);
  if (pos && el.contains(pos.offsetNode)) range.setStart(pos.offsetNode, pos.offset);
  else if (old && el.contains(old.startContainer)) range.setStart(old.startContainer, old.startOffset);
  else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Şekilli kâğıttaki bir yazı: içerik kadar yer kaplar (contenteditable, içeriğini kendisi tutar).
 * Düzenlenmiyorken sürüklenirse taşınır, tıklanırsa imleç tıklanan yere konur; düzenlenirken fare yazı seçer.
 */
function TextBlock({ b, autoFocus, onInput, onMove, onFocus, onBlur }: {
  b: StickyBlock; autoFocus: boolean; onInput: (v: string) => void; onMove: (x: number, y: number) => void; onFocus: () => void; onBlur: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  // dışarıdan gelen metin (yazarken dokunma: imleç kaybolur)
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== b.text) el.textContent = b.text;
  }, [b.text]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (e.button !== 0 || document.activeElement === el) return;
    e.preventDefault();
    const paper = (el.parentElement as HTMLElement).getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    let cur: { x: number; y: number } | null = null;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      // birkaç piksellik titreme tıklama sayılır
      if (!cur && Math.hypot(dx, dy) < 4) return;
      cur = {
        x: Math.max(0, Math.min(b.x + dx / paper.width, 0.95)),
        y: Math.max(0, Math.min(b.y + dy / paper.height, 0.95)),
      };
      setDrag(cur);
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setDrag(null);
      if (cur) onMove(cur.x, cur.y);
      else if (ev.type === 'pointerup') {
        el.focus();
        placeCaret(el, ev.clientX, ev.clientY);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const x = drag?.x ?? b.x;
  const y = drag?.y ?? b.y;
  return (
    <div ref={ref} className={`sticky-text ${drag ? 'dragging' : ''}`} contentEditable="plaintext-only" role="textbox" aria-multiline
      aria-label={t('study.sticky.aria')} title={t('study.sticky.dragText')} spellCheck={false}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, maxWidth: `${(1 - x) * 100}%` }}
      onPointerDown={down}
      // düzenlenmiyorken fare tıklaması odak/seçim başlatmasın: tıklama mı sürükleme mi, bırakınca belli olur
      onMouseDown={(e) => { if (document.activeElement !== e.currentTarget) e.preventDefault(); }}
      onInput={(e) => onInput(e.currentTarget.innerText)}
      onFocus={onFocus}
      onBlur={(e) => onBlur(e.currentTarget.innerText)} />
  );
}
