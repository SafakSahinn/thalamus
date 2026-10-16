import { describe, expect, it } from 'vitest';
import { checkFormula, evaluate } from './formula';

const props: Record<string, unknown> = { Sayfa: 300, Durum: 'Bitti', Bitiş: '2026-10-20', Puan: 4, Yazar: ['Harari'] };
const ctx = { prop: (n: string) => props[n], now: new Date('2026-10-16T12:00:00') };
const ev = (s: string) => evaluate(s, ctx);

describe('formül dili', () => {
  it('aritmetik ve öncelik', () => {
    expect(ev('1 + 2 * 3')).toBe(7);
    expect(ev('(1 + 2) * 3')).toBe(9);
    expect(ev('-2 ^ 2')).toBe(-4);
    expect(ev('2 ^ 3 ^ 2')).toBe(512);
    expect(ev('10 % 4')).toBe(2);
    expect(ev('prop("Sayfa") / 30')).toBe(10);
  });
  it('metin ve karşılaştırma', () => {
    expect(ev('prop("Puan") * 20 + "%"')).toBe('80%');
    expect(ev('if(prop("Durum") == "Bitti", "✅", "⏳")')).toBe('✅');
    expect(ev('prop("Sayfa") > 200 and not empty(prop("Yazar"))')).toBe(true);
    expect(ev('contains(prop("Yazar"), "Harari")')).toBe(true);
    expect(ev('upper("çiğdem")')).toBe('ÇİĞDEM');
    expect(ev('concat("a", 1, true)')).toBe('a1true');
  });
  it('tarihler', () => {
    expect(ev('dateBetween(prop("Bitiş"), today(), "days")')).toBe(4);
    expect(ev('year(prop("Bitiş"))')).toBe(2026);
    expect(ev('formatDate(dateAdd(prop("Bitiş"), 1, "months"))')).toBe('20 Kasım 2026');
  });
  it('if yalnızca seçilen dalı değerlendirir', () => {
    expect(ev('if(true, 1, 1 / 0)')).toBe(1);
  });
  it('hatalar', () => {
    expect(() => ev('1 / 0')).toThrow('Sıfıra');
    expect(() => ev('foo(1)')).toThrow('Bilinmeyen işlev');
    expect(checkFormula('prop("a"')).toMatch(/bekleniyordu/);
    expect(checkFormula('Sayfa + 1')).toMatch(/prop/);
    expect(checkFormula('round(prop("Puan") * 20) + "%"')).toBeNull();
  });
});
