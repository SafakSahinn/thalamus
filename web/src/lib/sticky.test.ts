import { describe, expect, it } from 'vitest';
import {
  blocksOf, blocksPatch, fixedPatch, isFixed, newSticky, paperClass, paperPatch, placeRect, SHAPE_MIN_W, shapeOf, shapePatch, shapeRect, stickyToNote,
  stripPatterns, stripShapes,
} from './sticky';
import { SHAPES } from './stickyShapes';

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

describe('desenli kâğıtlar', () => {
  it('desen seçilince baz rengi de değişir, renk seçilince desen kalkar', () => {
    expect(paperPatch('sehir')).toEqual({ pattern: 'sehir', color: 'blue' });
    expect(paperPatch('pink')).toEqual({ color: 'pink', pattern: undefined });
  });

  it('desen yalnız eklenti kuruluyken görünür, bilinmeyen desen düz renge düşer', () => {
    expect(paperClass({ color: 'green', pattern: 'dag' }, true)).toBe('c-dag pat');
    expect(paperClass({ color: 'green', pattern: 'dag' }, false)).toBe('c-green');
    expect(paperClass({ color: 'blue', pattern: 'eski' as never }, true)).toBe('c-blue');
  });

  it('verisiyle kaldırınca desen alanları silinir, gerisi kalır', () => {
    const s = { id: 'a', text: 'x', color: 'pink' as const, x: 0, y: 0, w: 200, h: 160, pattern: 'kiraz' as const };
    expect(stripPatterns([s])).toEqual([{ id: 'a', text: 'x', color: 'pink', x: 0, y: 0, w: 200, h: 160 }]);
  });
});

describe('şekilli kâğıtlar', () => {
  it('şekil seçilince desen kalkar, boyut şeklin oranına göre kurulur; dikdörtgene dönünce varsayılan boyut', () => {
    expect(shapePatch('bmw')).toEqual({ shape: 'bmw', pattern: undefined, tx: undefined, ty: undefined, blocks: undefined, w: 340, h: 128 });
    expect(shapePatch('rect')).toEqual({ shape: undefined, tx: undefined, ty: undefined, blocks: undefined, w: 220, h: 200 });
  });

  it('şekilli kâğıt oranını korur, ekrana sığar', () => {
    const d = { w: 400, h: 200 };
    expect(shapeRect({ x: 0, y: 0, w: 300 }, d, 1000, 800)).toEqual({ left: 0, top: 0, w: 300, h: 150 });
    // dar ekran: genişlik ekrana iner, yükseklik orandan
    expect(shapeRect({ x: 0.5, y: 0, w: 900 }, d, 600, 800)).toEqual({ left: 0, top: 0, w: 600, h: 300 });
    // alçak ekran: yükseklik sığmazsa genişlik de küçülür
    expect(shapeRect({ x: 0, y: 0, w: 900 }, d, 1000, 200)).toEqual({ left: 0, top: 0, w: 400, h: 200 });
  });

  it('şekil yalnız eklenti kuruluyken; bilinmeyen şekil dikdörtgen', () => {
    expect(shapeOf({ shape: 'kalp' }, true)?.id).toBe('kalp');
    expect(shapeOf({ shape: 'kalp' }, false)).toBeUndefined();
    expect(shapeOf({ shape: 'eski' as never }, true)).toBeUndefined();
  });

  it('verisiyle kaldırınca şekil alanları silinir, gerisi kalır', () => {
    const s = { id: 'a', text: 'x', color: 'pink' as const, x: 0, y: 0, w: 200, h: 160, shape: 'ev' as const, tx: 0.3, ty: 0.5, blocks: [{ id: 'b', text: 'x', x: 0, y: 0 }] };
    expect(stripShapes([s])).toEqual([{ id: 'a', text: 'x', color: 'pink', x: 0, y: 0, w: 200, h: 160 }]);
  });

  it('her şeklin geçerli boyutu, varsayılan yazı yeri ve en az bir yolu var', () => {
    for (const d of SHAPES) {
      expect(d.w > 0 && d.h > 0 && d.width >= SHAPE_MIN_W).toBe(true);
      expect(d.tx >= 0 && d.tx < 1 && d.ty >= 0 && d.ty < 1).toBe(true);
      expect(d.paths.length).toBeGreaterThan(0);
      for (const p of d.paths) expect(p.d).not.toMatch(/NaN|undefined/);
    }
  });
});

describe('şekilli kâğıtta birden fazla yazı', () => {
  const d = { tx: 0.2, ty: 0.4 };
  it('eski kâğıt tek yazı olarak açılır: yeri tx/ty ya da şeklin varsayılanı', () => {
    expect(blocksOf({ text: 'a' }, d)).toEqual([{ id: 'b0', text: 'a', x: 0.2, y: 0.4 }]);
    expect(blocksOf({ text: 'a', tx: 0.5, ty: 0.1 }, d)).toEqual([{ id: 'b0', text: 'a', x: 0.5, y: 0.1 }]);
    const blocks = [{ id: 'x', text: 'b', x: 0, y: 0 }];
    expect(blocksOf({ text: 'b', blocks }, d)).toBe(blocks);
  });

  it('kaydederken boş olmayan yazılar alt alta text olur, eski tx/ty silinir', () => {
    const blocks = [{ id: '1', text: 'süt', x: 0, y: 0 }, { id: '2', text: '  ', x: 0.5, y: 0.5 }, { id: '3', text: 'ekmek', x: 0.1, y: 0.8 }];
    expect(blocksPatch(blocks)).toEqual({ blocks, tx: undefined, ty: undefined, text: 'süt\nekmek' });
  });
});

describe('ekranda sabit ya da sayfayla kayan kâğıt', () => {
  it('kâğıdın kendi seçimi varsayılandan önce gelir; ikisi de yoksa sabit', () => {
    expect(isFixed({}, undefined)).toBe(true);
    expect(isFixed({}, false)).toBe(false);
    expect(isFixed({ fixed: true }, false)).toBe(true);
    expect(isFixed({ fixed: false }, true)).toBe(false);
  });

  it('sabitlik değişince kâğıt ekranda olduğu yerde kalır', () => {
    // sayfa 400px kaymış, ekran 800px: ekranın %10'undaki kâğıt sayfa başından %60'tadır
    const a = fixedPatch({ y: 0.1 }, false, 400, 800);
    expect(a.fixed).toBe(false);
    expect(a.y).toBeCloseTo(0.6);
    const b = fixedPatch({ y: 0.6 }, true, 400, 800);
    expect(b.fixed).toBe(true);
    expect(b.y).toBeCloseTo(0.1);
    expect(fixedPatch({ y: 0.2 }, true, 400, 800)).toEqual({ fixed: true, y: 0 });
  });
});
