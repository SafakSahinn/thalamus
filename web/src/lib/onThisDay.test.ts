import { describe, expect, it } from 'vitest';
import { normalizeFeed, paginate } from './onThisDay';

describe('tarihte bugün', () => {
  const raw = {
    events: [
      { text: 'Eski olay', year: 1453, pages: [{ normalizedtitle: 'X', extract: 'özet', thumbnail: { source: 'img' }, content_urls: { desktop: { page: 'u' } } }] },
      { text: '  Yeni olay (pictured left) ', year: 2009, pages: [] },
      { text: '', year: 2000 },
      { year: 1999 },
    ],
    holidays: [{ text: 'B günü' }, { text: 'A günü' }],
    births: 'bozuk',
  };

  it('kayıtları sadeleştirir, boşları atar, yeniden eskiye sıralar', () => {
    const f = normalizeFeed(raw);
    expect(f.events.map((e) => e.text)).toEqual(['Yeni olay', 'Eski olay']);
    expect(f.events[1]).toMatchObject({ year: 1453, title: 'X', extract: 'özet', thumb: 'img', url: 'u' });
    expect(f.births).toEqual([]);
    expect(f.selected).toEqual([]);
    expect(f.holidays.map((e) => e.text)).toEqual(['B günü', 'A günü']);
  });

  it('bölümleri sayfalara böler, boş bölüm sayfa üretmez', () => {
    const f = normalizeFeed({ events: Array.from({ length: 5 }, (_, i) => ({ text: `e${i}`, year: i })), deaths: [{ text: 'd', year: 1 }] });
    const p = paginate(f, 2);
    expect(p.map((x) => `${x.kind}:${x.items.length}`)).toEqual(['events:2', 'events:2', 'events:1', 'deaths:1']);
  });
});
