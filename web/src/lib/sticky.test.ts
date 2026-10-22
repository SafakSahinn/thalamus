import { describe, expect, it } from 'vitest';
import { newSticky, placeRect, stickyToNote } from './sticky';

describe('yapışkan notlar', () => {
  it('küçülen ekranda kâğıt içeri kıstırılır, boyut ekrana sığar', () => {
    expect(placeRect({ x: 0.9, y: 0.9, w: 220, h: 200 }, 1000, 800)).toEqual({ left: 780, top: 600, w: 220, h: 200 });
    expect(placeRect({ x: 0.1, y: 0.1, w: 900, h: 900 }, 600, 500)).toEqual({ left: 0, top: 0, w: 600, h: 500 });
    expect(placeRect({ x: 0, y: 0, w: 50, h: 50 }, 1000, 800)).toMatchObject({ w: 160, h: 110 });
  });

  it('yeni kâğıt tıklanan noktada; nokta yoksa öncekinin üstüne binmez', () => {
    const a = newSticky([], 1000, 800, { x: 300, y: 200 });
    expect([a.x * 1000, a.y * 800]).toEqual([300, 200]);
    const b = newSticky([], 1000, 800);
    const c = newSticky([b], 1000, 800);
    expect(c.x * 1000).toBe(b.x * 1000 - 24);
    expect(c.y * 800).toBe(b.y * 800 + 24);
    // kenara yakın tıklama: kâğıt ekranda kalır
    const d = newSticky([], 1000, 800, { x: 990, y: 790 });
    expect([d.x * 1000, d.y * 800]).toEqual([780, 600]);
  });

  it('nota dönüştürme: ilk dolu satır başlık, kalanı paragraflar', () => {
    expect(stickyToNote('\n Alışveriş \n\nsüt\n\nekmek\n')).toEqual({
      title: 'Alışveriş',
      content: { type: 'doc', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'süt' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'ekmek' }] },
      ] },
    });
    expect(stickyToNote('tek satır')).toEqual({ title: 'tek satır', content: null });
  });
});
