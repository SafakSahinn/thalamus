import { useEffect, useState } from 'react';

// Sayfayla kayan yüzen öğeler (yapışkan notlar, depolama göstergesi) için: sayfanın kaydırılan alanı <main>'dir.

/** Sayfanın kaydırılan alanı */
export const scroller = () => document.querySelector('main');

/** Şu anki kaydırma payı */
export const pageScrollTop = () => scroller()?.scrollTop ?? 0;

/** <main>'in kaydırma payı; yalnız `on` iken dinlenir */
export function useScrollY(on: boolean) {
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
