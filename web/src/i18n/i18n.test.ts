import { isValidElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { detectLocale, getLocale, LOCALE_IDS, LOCALES, setLocalePref, t, tOr, weekdays } from '.';
import en from './locales/en';
import tr from './locales/tr';

afterEach(async () => {
  await setLocalePref('tr');
});

describe('detectLocale', () => {
  it('tarayıcı listesindeki ilk desteklenen dili seçer', () => {
    expect(detectLocale(['tr-TR', 'en-US'])).toBe('tr');
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['de-DE', 'tr'])).toBe('tr');
  });
  it('hiçbiri desteklenmiyorsa İngilizceye düşer', () => {
    expect(detectLocale(['fr-FR', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('t', () => {
  it('yer tutucuları doldurur', () => {
    expect(t('market.installedCount', { count: 3 })).toBe('Kurulu (3)');
  });
  it('dil değişince metin ve çoğul biçim değişir', async () => {
    await setLocalePref('en');
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(t('sidebar.morePages', { count: 1 })).toBe('+ 1 more page');
    expect(t('sidebar.morePages', { count: 4 })).toBe('+ 4 more pages');
  });
  it('bilinmeyen dinamik anahtar için yedek metni döndürür', () => {
    expect(tOr('options.Kendi seçeneğim', 'Kendi seçeneğim')).toBe('Kendi seçeneğim');
    expect(tOr('options.Bitti', 'x')).toBe('Bitti');
  });
  it('rich: mesajdaki etiketleri ve yer tutucuları öğeye çevirir', () => {
    const parts = t.rich('tour.navDaily') as unknown[];
    const b = parts.find((p) => isValidElement(p)) as ReactElement<{ children: unknown }>;
    expect(b.type).toBe('b');
    expect(b.props.children).toBe('Günlük');
  });
});

describe('dil dosyaları', () => {
  // Bir yaprak ya düz metindir ya da çoğul biçimdir ({ other: … }); ikisi de aynı anahtarı karşılar
  const keys = (o: object, pre = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' || (v && typeof v === 'object' && 'other' in v) ? [pre + k] : keys(v as object, `${pre}${k}.`)));

  it('her dil kaynak dilin bütün anahtarlarını içerir, fazlası yok', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });
  it('kayıtlı her dilin adı ve yükleyicisi var', async () => {
    for (const id of LOCALE_IDS) {
      expect(LOCALES[id].name).toBeTruthy();
      expect(Object.keys(await LOCALES[id].load())).toEqual(Object.keys(tr));
    }
  });
  it('yer tutucular dillerde aynı', () => {
    const ph = (s: unknown) => JSON.stringify(s).match(/\{\w+\}/g)?.filter((x) => x !== '{today}').sort() ?? [];
    const get = (o: object, k: string) => k.split('.').reduce<unknown>((x, p) => (x as Record<string, unknown>)[p], o);
    const bad = keys(tr).filter((k) => JSON.stringify([...new Set(ph(get(tr, k)))]) !== JSON.stringify([...new Set(ph(get(en, k)))]));
    expect(bad).toEqual([]);
  });
});

describe('weekdays', () => {
  it('pazartesiden başlayan 7 gün', () => {
    expect(weekdays('long')).toHaveLength(7);
    expect(weekdays('long')[0].toLocaleLowerCase('tr')).toBe('pazartesi');
    expect(weekdays('long', false)[0].toLocaleLowerCase('tr')).toBe('pazar');
  });
});
