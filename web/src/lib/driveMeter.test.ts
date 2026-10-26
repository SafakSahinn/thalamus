import { describe, expect, it } from 'vitest';
import { meterFixedPatch, meterValues, smallScale } from './driveMeter';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe('depolama göstergesi', () => {
  it('küçük kadran en az 1 GB, aşılınca 2-5-10 adımlarıyla büyür', () => {
    expect(smallScale(38 * MB)).toBe(GB);
    expect(smallScale(GB)).toBe(GB);
    expect(smallScale(1.5 * GB)).toBe(2 * GB);
    expect(smallScale(3 * GB)).toBe(5 * GB);
    expect(smallScale(7 * GB)).toBe(10 * GB);
    expect(smallScale(15 * GB)).toBe(20 * GB);
  });

  it('kadran değerleri', () => {
    const v = meterValues({ local: false, limit: 15 * GB, usage: 12 * GB, thalamus: 512 * MB, at: 0 });
    expect(v.fill).toBeCloseTo(0.8);
    expect(v.small).toBeCloseTo(0.5);
    expect(v.share).toBeCloseTo(0.5 / 12);
  });

  it('sınırsız hesapta büyük kadran 0, taşma 1 ile sınırlı', () => {
    expect(meterValues({ local: false, usage: 5 * GB, thalamus: 0, at: 0 }).fill).toBe(0);
    expect(meterValues({ local: false, limit: GB, usage: 2 * GB, thalamus: 0, at: 0 }).fill).toBe(1);
  });
});

describe('gadget sabit ya da sayfayla kayan', () => {
  it('sabitlik değişince gadget ekranda olduğu yerde kalır', () => {
    // ekranın 100px'inde, sayfa 400px kaymış, ekran 800px
    expect(meterFixedPatch(false, 100, 400, 800)).toEqual({ fixed: false, y: 0.625 });
    expect(meterFixedPatch(true, 100, 400, 800)).toEqual({ fixed: true, y: 0.125 });
    expect(meterFixedPatch(true, -50, 0, 800)).toEqual({ fixed: true, y: 0 });
  });
});
