import { describe, expect, it } from 'vitest';
import { hasPluginData, installedList, withoutPlugin } from './plugins';
import { DEFAULT_SETTINGS, type Settings } from './types';

const s = (extra: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...extra });

describe('installedList', () => {
  it('yeni hesapta hiçbir eklenti kurulu değil', () => {
    expect(installedList(s({}))).toEqual([]);
  });

  it('market öncesi hesapta kullanılanlar kurulu sayılır', () => {
    const sticky = { id: 'a', text: '', color: 'yellow' as const, x: 0, y: 0, w: 200, h: 160 };
    expect(installedList(s({ stickies: [sticky], homeLayout: [{ id: 'otd', on: true }] }))).toEqual(['sticky', 'otd']);
    expect(installedList(s({ stickies: [], homeLayout: [{ id: 'otd', on: false }] }))).toEqual([]);
  });

  it('kaydedilmiş liste varsa ona uyulur, bilinmeyen kimlikler atlanır', () => {
    expect(installedList(s({ installed: ['otd', 'eski'], stickies: [{ id: 'a', text: '', color: 'yellow', x: 0, y: 0, w: 200, h: 160 }] }))).toEqual(['otd']);
  });
});

describe('hasPluginData', () => {
  it('eklentinin ayarlarda bıraktığı veriyi görür', () => {
    expect(hasPluginData('sticky', s({}))).toBe(false);
    expect(hasPluginData('sticky', s({ stickyScope: 'home' }))).toBe(true);
    expect(hasPluginData('otd', s({ otdLang: 'en' }))).toBe(true);
    expect(hasPluginData('otd', s({ homeLayout: [{ id: 'today', on: true }] }))).toBe(false);
    expect(hasPluginData('wallpaper', s({}))).toBe(false);
    expect(hasPluginData('wallpaper', s({ wallpaper: 'aero' }))).toBe(true);
    expect(hasPluginData('clock', s({}))).toBe(false);
    expect(hasPluginData('clock', s({ clock: { skin: 'wood' } }))).toBe(true);
    expect(hasPluginData('clock', s({ homeLayout: [{ id: 'clock', on: true }] }))).toBe(true);
  });
});

describe('eklenti bağımlılıkları', () => {
  it('bir eklenti kaldırılınca ona bağlı olanlar da kalkar', () => {
    expect(withoutPlugin(['sticky', 'stickyArt', 'stickyShape', 'otd'], 'sticky')).toEqual(['otd']);
    expect(withoutPlugin(['sticky', 'stickyArt'], 'stickyArt')).toEqual(['sticky']);
  });

  it('desenli kâğıt verisi yalnız desen seçilmiş kâğıt varsa sayılır', () => {
    const plain = { id: 'a', text: '', color: 'yellow' as const, x: 0, y: 0, w: 200, h: 160 };
    expect(hasPluginData('stickyArt', s({ stickies: [plain] }))).toBe(false);
    expect(hasPluginData('stickyArt', s({ stickies: [{ ...plain, pattern: 'gece' }] }))).toBe(true);
    expect(hasPluginData('stickyShape', s({ stickies: [plain] }))).toBe(false);
    expect(hasPluginData('stickyShape', s({ stickies: [{ ...plain, shape: 'bulut' }] }))).toBe(true);
  });
});
