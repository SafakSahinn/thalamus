import { describe, expect, it } from 'vitest';
import { normalizeFeed } from './onThisDay';

describe('tarihte bugün', () => {
  const raw = {
    selected: [{ text: 'Manşet', year: 2009, pages: [{ extract: 'özet', thumbnail: { source: 'img' } }] }],
    events: [
      { text: 'Eski olay', year: 1453, pages: [{ normalizedtitle: 'X', extract: 'özet', thumbnail: { source: 'img' }, content_urls: { desktop: { page: 'u' } } }] },
      { text: '  Yeni olay (pictured left) ', year: 2009, pages: [] },
      { text: '', year: 2000 },
      { year: 1999 },
    ],
    holidays: [{ text: 'B günü [en]' }, { text: 'g' }, { text: 'A günü' }],
    births: 'bozuk',
  };

  it('kayıtları sadeleştirir, boşları atar, yeniden eskiye sıralar', () => {
    const f = normalizeFeed(raw);
    expect(f.events.map((e) => e.text)).toEqual(['Yeni olay', 'Eski olay']);
    expect(f.events[1]).toEqual({ text: 'Eski olay', year: 1453, title: 'X', extract: undefined, thumb: undefined, url: 'u' });
    expect(f.selected[0]).toMatchObject({ extract: 'özet', thumb: 'img' });
    expect(f.births).toEqual([]);
    expect(f.deaths).toEqual([]);
    expect(f.holidays.map((e) => e.text)).toEqual(['B günü', 'A günü']);
  });
});
