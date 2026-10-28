import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';

// Sağ tık menüsü: herhangi bir bileşen openMenu(x, y, öğeler) ile açar. Dışarı tıklayınca, Esc'de,
// kaydırınca ya da pencere boyutu değişince kapanır. Ekranın kenarından taşarsa içeri kayar.

export type MenuItem =
  | { key: string; icon?: string; label: string; danger?: boolean; run: () => void }
  | { key: string; sep: true }
  /** tek satırda renk seçimi; kutucuğun içine önizleme konabilir (content) */
  | { key: string; swatches: { id: string; label: string; on?: boolean; style?: React.CSSProperties; content?: React.ReactNode }[]; className: string; pick: (id: string) => void };

const useMenu = create<{ menu: { x: number; y: number; items: MenuItem[] } | null }>(() => ({ menu: null }));

export const openMenu = (x: number, y: number, items: MenuItem[]) => useMenu.setState({ menu: { x, y, items } });
export const closeMenu = () => useMenu.setState({ menu: null });

export default function ContextMenu() {
  const menu = useMenu((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(4, Math.min(menu.x, innerWidth - r.width - 4)),
      top: Math.max(4, Math.min(menu.y, innerHeight - r.height - 4)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    // açan sağ tıkın kendisi menüyü hemen kapatmasın
    const t = setTimeout(() => {
      addEventListener('pointerdown', onDown, true);
      addEventListener('contextmenu', onDown, true);
    }, 0);
    addEventListener('keydown', onKey);
    addEventListener('resize', closeMenu);
    addEventListener('scroll', closeMenu, true);
    return () => {
      clearTimeout(t);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('contextmenu', onDown, true);
      removeEventListener('keydown', onKey);
      removeEventListener('resize', closeMenu);
      removeEventListener('scroll', closeMenu, true);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div ref={ref} className="ctxmenu" role="menu" style={pos} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it) => {
        if ('sep' in it) return <div key={it.key} className="ctxmenu-sep" />;
        if ('swatches' in it) {
          return (
            <div key={it.key} className="ctxmenu-swatches">
              {it.swatches.map((s) => (
                <button key={s.id} className={`${it.className} c-${s.id} ${s.on ? 'on' : ''}`} title={s.label} aria-label={s.label} style={s.style}
                  onClick={() => { closeMenu(); it.pick(s.id); }}>{s.content}</button>
              ))}
            </div>
          );
        }
        return (
          <button key={it.key} role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { closeMenu(); it.run(); }}>
            <span className="ic">{it.icon}</span>{it.label}
          </button>
        );
      })}
    </div>
  );
}
