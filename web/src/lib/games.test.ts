import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameDetails } from './covers';
import { hasPluginData } from './plugins';
import { readingStamp } from './reading';
import { applyTypeSettings, DEFAULT_SETTINGS, isTypeEnabled, TYPE_MAP, TYPES, type Note, type Settings } from './types';

const s = (extra: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...extra });
const mk = (id: string, type: string, deleted = false): Note => ({
  id, type, title: id, props: {}, content: null, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: deleted ? '2026-11-01' : null,
});

afterEach(() => {
  applyTypeSettings(undefined, []);
  vi.unstubAllGlobals();
});

describe('Video Oyunları eklentisi: koleksiyon tipi', () => {
  it('eklenti kurulu değilken listelerde yok, ama tip tanımı duruyor (notlar açılabilir)', () => {
    applyTypeSettings(undefined, []);
    expect(TYPES.some((t) => t.id === 'game')).toBe(false);
    expect(isTypeEnabled('game')).toBe(false);
    expect(TYPE_MAP.game?.label).toBe('Oyun');
  });

  it('kurulunca Filmler’in hemen arkasında görünür', () => {
    applyTypeSettings(undefined, ['games']);
    const ids = TYPES.map((t) => t.id);
    expect(ids.indexOf('game')).toBe(ids.indexOf('movie') + 1);
    expect(isTypeEnabled('game')).toBe(true);
  });

  it('önceki oyun ilişkisinin tersi “Devam oyunu” adıyla görünür', () => {
    applyTypeSettings(undefined, ['games']);
    expect(TYPE_MAP.game.props.find((p) => p.key === '~game.prequel')?.label).toBe('Devam oyunu');
  });

  it('veri: oyun notu ya da koleksiyon ayarı varsa sayılır, çöptekiler sayılmaz', () => {
    expect(hasPluginData('games', s({}), {})).toBe(false);
    expect(hasPluginData('games', s({}), { a: mk('a', 'game', true), b: mk('b', 'book') })).toBe(false);
    expect(hasPluginData('games', s({}), { a: mk('a', 'game') })).toBe(true);
    expect(hasPluginData('games', s({ views: { game: [] } }), {})).toBe(true);
  });

  it('Oynanıyor → Başlama, Bitti → Bitiş tarihi', () => {
    expect(readingStamp('game', { status: 'Oynanacak' }, { status: 'Oynanıyor' }, '2026-11-08')).toEqual({ started: '2026-11-08' });
    expect(readingStamp('game', { status: 'Oynanıyor' }, { status: 'Bitti', started: '2026-11-01' }, '2026-11-08')).toEqual({ finished: '2026-11-08' });
  });
});

describe('gameDetails (Wikidata)', () => {
  it('yıl, stüdyo, platform ve türleri eşler; tanınmayan platform atlanır', async () => {
    const claim = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
    const labels: Record<string, string> = {
      Q1: 'CD Projekt Red', Q2: 'CD Projekt', Q10: 'Microsoft Windows', Q11: 'PlayStation 4', Q12: 'Nintendo Switch', Q13: 'Stadia',
      Q20: 'action role-playing game', Q21: 'open world', Q30: 'The Witcher 2: Assassins of Kings',
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const ids = new URL(url).searchParams.get('ids')!;
      const body = url.includes('props=claims')
        ? { entities: { [ids]: { claims: {
            P577: [{ mainsnak: { datavalue: { value: { time: '+2016-05-19T00:00:00Z' } } } }, { mainsnak: { datavalue: { value: { time: '+2015-05-19T00:00:00Z' } } } }],
            P178: [claim('Q1')], P123: [claim('Q2')], P400: ['Q10', 'Q11', 'Q12', 'Q13'].map(claim), P136: [claim('Q20'), claim('Q21')], P155: [claim('Q30')],
          } } } }
        // Wikidata bazı özel adları yalnız dil bağımsız "mul" etiketinde tutar
        : { entities: Object.fromEntries(ids.split('|').map((id) => [id, { labels: { [['Q11', 'Q12'].includes(id) ? 'mul' : 'en']: { value: labels[id] } } }])) };
      return new Response(JSON.stringify(body));
    }));
    expect(await gameDetails('Q99')).toEqual({
      year: 2015,
      developers: ['CD Projekt Red'],
      publishers: ['CD Projekt'],
      platforms: ['PC', 'PlayStation 4', 'Nintendo Switch'],
      genres: ['Rol yapma (RPG)', 'Açık dünya'],
      prequel: 'The Witcher 2: Assassins of Kings',
    });
  });
});
