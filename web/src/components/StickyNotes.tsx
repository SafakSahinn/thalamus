import { useEffect, useRef, useState } from 'react';
import { useInstalled } from '../lib/plugins';
import { go } from '../lib/router';
import { createNote, useStore } from '../lib/store';
import {
  addSticky, COLORS, MIN_H, MIN_W, paperClass, paperPatch, patchSticky, PATTERNS, placeRect, raiseSticky, removeSticky,
  setStickiesHidden, stickyToNote, useStickyUi, type Sticky,
} from '../lib/sticky';
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
            <button key={s.id} className={`sticky-tab ${paperClass(s, art)} ${s.id === open ? 'on' : ''}`} title={s.text.split('\n')[0] || 'Boş not'}
              onClick={() => useStickyUi.setState({ open: s.id === open ? null : s.id })}>
              {s.text.trim().charAt(0).toLocaleUpperCase('tr')}
            </button>
          ))}
        </div>
        {cur && <Paper key={cur.id} s={cur} rect={{ left: 0, top: 0, w: 0, h: 0 }} vw={vw} vh={vh} z={1} art={art} mobile />}
      </div>
    );
  }

  return (
    <div className="sticky-layer">
      {stable.map((s) => <Paper key={s.id} s={s} rect={placeRect(s, vw, vh)} vw={vw} vh={vh} z={z(s.id)} art={art} />)}
    </div>
  );
}

type Rect = { left: number; top: number; w: number; h: number };

function Paper({ s, rect, vw, vh, z, art, mobile }: { s: Sticky; rect: Rect; vw: number; vh: number; z: number; art: boolean; mobile?: boolean }) {
  const [text, setText] = useState(s.text);
  const [live, setLive] = useState<Rect | null>(null);
  const [sizing, setSizing] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(false);
  const pending = useRef<{ t: number; v: string } | null>(null);

  // Başka cihazdan gelen değişiklik (yazmıyorken)
  useEffect(() => {
    if (!editing.current && !pending.current) setText(s.text);
  }, [s.text]);

  // Yeni açılan kâğıda imleç
  useEffect(() => {
    if (useStickyUi.getState().focus === s.id) {
      area.current?.focus();
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
      cur = mode === 'move'
        ? { ...start, left: Math.max(0, Math.min(start.left + dx, vw - start.w)), top: Math.max(0, Math.min(start.top + dy, vh - start.h)) }
        : { ...start, w: Math.max(MIN_W, Math.min(start.w + dx, vw - start.left)), h: Math.max(MIN_H, Math.min(start.h + dy, vh - start.top)) };
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

  const remove = () => {
    if (text.trim() && !confirm('Bu yapışkan not silinsin mi?')) return;
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

  const patterned = art && !!s.pattern;
  const addNext = () => addSticky(undefined, s.color, patterned ? s.pattern : undefined);
  const menu = (x: number, y: number) => {
    const pick = (c: string) => patchSticky(s.id, paperPatch(c));
    const items: MenuItem[] = [{ key: 'colors', className: 'sticky-swatch', swatches: COLORS.map((c) => ({ ...c, on: !patterned && c.id === s.color })), pick }];
    // desenler renk sırasıyla aynı genişlikte, 6'şarlı sıralar hâlinde (Desenli not kâğıtları eklentisi)
    if (art) {
      for (let i = 0; i < PATTERNS.length; i += COLORS.length) {
        const row = PATTERNS.slice(i, i + COLORS.length);
        items.push({ key: `pat${i}`, className: 'sticky-swatch pat', swatches: row.map((p) => ({ id: p.id, label: p.label, on: s.pattern === p.id })), pick });
      }
    }
    items.push({ key: 's1', sep: true }, { key: 'new', icon: '＋', label: 'Yeni yapışkan not', run: addNext });
    if (text.trim()) items.push({ key: 'note', icon: '📄', label: 'Not olarak kaydet', run: toNote });
    items.push({ key: 's2', sep: true }, { key: 'del', icon: '🗑', label: 'Sil', danger: true, run: remove });
    openMenu(x, y, items);
  };

  const r = live ?? rect;
  const style: React.CSSProperties = mobile ? { zIndex: z } : { left: r.left, top: r.top, width: r.w, height: r.h, zIndex: z };
  return (
    <div className={`sticky ${paperClass(s, art)} ${mobile ? 'mobile' : ''} ${live ? 'dragging' : ''} ${sizing ? 'sizing' : ''}`} style={style}
      onPointerDownCapture={() => raiseSticky(s.id)}>
      {/* kâğıt ayrı katmanda: kıvrık köşe gölgeleri (::before/::after) onun arkasında kalsın */}
      <div className="sticky-paper">
        <div className="sticky-head" onPointerDown={(e) => startDrag(e, 'move')}
          onContextMenu={(e) => { e.preventDefault(); menu(e.clientX, e.clientY); }}>
          <button title="Yeni yapışkan not" onClick={addNext}>＋</button>
          <span className="spacer" />
          <button title={art ? 'Renk, desen ve diğer' : 'Renk ve diğer'} onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); menu(b.left, b.bottom + 2); }}>⋯</button>
          {mobile && <button title="Küçült" onClick={() => { flush(); useStickyUi.setState({ open: null }); }}>▾</button>}
          <button title="Sil" onClick={remove}>×</button>
        </div>
        <textarea ref={area} value={text} spellCheck={false} aria-label="Yapışkan not"
          onChange={(e) => onText(e.target.value)}
          onFocus={() => { editing.current = true; }}
          onBlur={() => { editing.current = false; flush(); }} />
        {!mobile && <div className="sticky-grip" title="Boyutlandır" onPointerDown={(e) => startDrag(e, 'size')} />}
      </div>
    </div>
  );
}
