import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { computeLinks, plainText, wikiTargets } from './links';
import { buildNotes, guessColumn, guessType, parseDate, parseRelation, readNotionZip } from './notionImport';

const H1 = '0123456789abcdef0123456789abcdef';
const H2 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const H3 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const HDB = 'cccccccccccccccccccccccccccccccc';
const HP = 'dddddddddddddddddddddddddddddddd';
const H4 = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

async function fakeExport() {
  const inner = new JSZip();
  const root = 'Private & Shared';
  inner.file(`${root}/Kitaplarım ${HDB}.csv`, '﻿Name,Yazar,Durum,Puan,Etiketler,Bitiş\nSuç ve Ceza,Dostoyevski,Bitti,⭐⭐⭐⭐⭐,"Roman, Rus edebiyatı","October 3, 2025"\nYeraltından Notlar,Dostoyevski,Okunuyor,,Rus edebiyatı,\n');
  inner.file(`${root}/Kitaplarım ${HDB}_all.csv`, '﻿Name,Yazar,Durum,Puan,Etiketler,Bitiş\nSuç ve Ceza,Dostoyevski,Bitti,⭐⭐⭐⭐⭐,"Roman, Rus edebiyatı","October 3, 2025"\nYeraltından Notlar,Dostoyevski,Okunuyor,,Rus edebiyatı,\nBeyaz Geceler,Dostoyevski,Okunacak,,,\n');
  inner.file(`${root}/Kitaplarım ${HDB}/Suç ve Ceza ${H1}.md`,
    `# Suç ve Ceza\n\nYazar: Dostoyevski\nDurum: Bitti\n\nRaskolnikov üzerine notlar. Bkz. [Yeraltından Notlar](Yeraltından%20Notlar%20${H2}.md).\n\n- [x] Birinci bölüm\n- [ ] İkinci bölüm\n\nFormül: $V = IR$ ve\n\n$$\n\\frac{1}{2}mv^2\n$$\n\n![kapak](Su%C3%A7%20ve%20Ceza%20${H1}/kapak.png)\n`);
  inner.file(`${root}/Kitaplarım ${HDB}/Suç ve Ceza ${H1}/kapak.png`, new Uint8Array([137, 80, 78, 71]));
  inner.file(`${root}/Kitaplarım ${HDB}/Yeraltından Notlar ${H2}.md`, `# Yeraltından Notlar\n\nDurum: Okunuyor\n\nYeraltı adamı.\n`);
  inner.file(`${root}/Ders Notları ${HP}.md`, `# Ders Notları\n\n## Devre Analizi\n\nThevenin eşdeğeri. [Suç ve Ceza](Kitapl%C4%B1m/Su%C3%A7%20ve%20Ceza%20${H1}.md) ile ilgisi yok :)\n\n| a | b |\n|---|---|\n| 1 | 2 |\n`);
  inner.file(`${root}/Boş sayfa ${H3}.md`, `# Boş sayfa\n`);
  inner.file(`${root}/Ders Notları ${HP}/Op-amp ${H4}.md`, `# Op-amp\n\nEviren kuvvetlendirici.\n`);
  const outer = new JSZip();
  outer.file('Export-123-Part-1.zip', await inner.generateAsync({ type: 'uint8array' }));
  return outer.generateAsync({ type: 'uint8array' });
}

describe('yardımcılar', () => {
  it('tarihleri çözer', () => {
    expect(parseDate('October 3, 2025')).toBe('2025-10-03');
    expect(parseDate('2025/10/03')).toBe('2025-10-03');
    expect(parseDate('03/10/2025')).toBe('2025-10-03');
    expect(parseDate('3 Ekim 2025')).toBe('2025-10-03');
    expect(parseDate('October 3, 2025 → October 9, 2025')).toBe('2025-10-03');
    expect(parseDate('yarın')).toBeUndefined();
  });
  it('ilişki değerlerini çözer', () => {
    expect(parseRelation('A (x/A%20h.md), B (B.md)')).toEqual([{ title: 'A', path: 'x/A h.md' }, { title: 'B', path: 'B.md' }]);
    expect(parseRelation('Roman, Rus edebiyatı')).toEqual([{ title: 'Roman' }, { title: 'Rus edebiyatı' }]);
  });
  it('tip ve sütun tahmini', () => {
    expect(guessType('Kitaplarım')).toBe('book');
    expect(guessType('Reading List')).toBe('book');
    expect(guessType('Okuduğum Makaleler')).toBe('paper');
    expect(guessType('Kelimeler')).toBe('word');
    expect(guessType('Habit Tracker')).toBe('daily');
    expect(guessType('Rastgele')).toBe('note');
    expect(guessColumn('Yazar', 'book', [])).toBe('author');
    expect(guessColumn('Etiketler', 'book', [])).toBe('topics');
    expect(guessColumn('Bitiş', 'book', [])).toBe('finished');
    expect(guessColumn('Spor', 'daily', ['Yes', 'No'])).toBe('routine');
    expect(guessColumn('Garip', 'book', ['x'])).toBe('extra');
  });
});

describe('Notion zip içe aktarma', () => {
  it('iç içe zip, _all.csv, satır sayfaları, bağlantılar', async () => {
    const parsed = await readNotionZip(await fakeExport());
    expect(parsed.databases).toHaveLength(1);
    const db = parsed.databases[0];
    expect(db.name).toBe('Kitaplarım');
    expect(db.rows).toHaveLength(3); // _all.csv tercih edildi
    expect(db.titleColumn).toBe('Name');
    // 4 md + CSV'de olup md'si olmayan 1 satır (Beyaz Geceler)
    expect(parsed.pages).toHaveLength(6);
    const suc = parsed.pages.find((p) => p.title === 'Suç ve Ceza')!;
    expect(suc.dbKey).toBe(HDB);
    expect(suc.row?.Durum).toBe('Bitti');
    expect(suc.body).not.toMatch(/^Yazar:/m); // özellik satırları ayıklandı
    expect(parsed.assets.size).toBe(1);

    const uploads: string[] = [];
    const res = await buildNotes(parsed, {
      mappings: { [HDB]: { type: 'book', columns: { Yazar: 'author', Durum: 'status', Puan: 'rating', Etiketler: 'topics', 'Bitiş': 'finished' } } },
      pageType: 'note',
      existing: [],
      upload: async (_b, name) => {
        uploads.push(name);
        return `sb://u/${name}`;
      },
    });
    const by = (t: string) => res.notes.find((n) => n.title === t)!;
    const sucN = by('Suç ve Ceza');
    expect(sucN.type).toBe('book');
    expect(sucN.props.status).toBe('Bitti');
    expect(sucN.props.rating).toBe(5);
    expect(sucN.props.finished).toBe('2025-10-03');
    // yazar ve etiketler ayrı notlar olarak oluşturulup bağlandı (tek Dostoyevski)
    const dosto = res.notes.filter((n) => n.title === 'Dostoyevski');
    expect(dosto).toHaveLength(1);
    expect(dosto[0].type).toBe('person');
    expect(sucN.props.author).toEqual([dosto[0].id]);
    const rus = by('Rus edebiyatı');
    expect(rus.type).toBe('concept');
    expect(by('Yeraltından Notlar').props.topics).toEqual([rus.id]);
    // içerik: wiki bağlantısı, görev listesi, formüller, görsel
    const yer = by('Yeraltından Notlar');
    expect(wikiTargets(sucN.content)).toEqual([yer.id]);
    const json = JSON.stringify(sucN.content);
    expect(json).toContain('"taskList"');
    expect(json).toContain('"checked":true');
    expect(json).toContain('"inlineMath"');
    expect(json).toContain('"blockMath"');
    expect(json).toContain('sb://u/kapak.png');
    expect(uploads).toEqual(['kapak.png']);
    expect(plainText(sucN.content)).toContain('Raskolnikov');
    expect(computeLinks(sucN)).toEqual(expect.arrayContaining([yer.id, dosto[0].id]));
    // veritabanı dışı sayfa: tablo + başlık; bozuk göreli bağlantı (yanlış klasör) yine hash ile çözülür
    const ders = by('Ders Notları');
    expect(ders.type).toBe('note');
    expect(JSON.stringify(ders.content)).toContain('"table"');
    expect(wikiTargets(ders.content)).toEqual([sucN.id]);
    // md'si olmayan satır da not oldu
    expect(by('Beyaz Geceler').props.status).toBe('Okunacak');
    expect(by('Boş sayfa').content).toBeNull();
    // Notion alt sayfası üst sayfasına bağlandı
    expect(by('Op-amp').props.parent).toEqual([ders.id]);
    expect(computeLinks(by('Op-amp'))).toContain(ders.id);

    // ikinci aktarımda aynı sayfalar atlanır
    const again = await buildNotes(parsed, { mappings: { [HDB]: { type: 'book', columns: {} } }, pageType: 'note', existing: res.notes });
    expect(again.skipped).toBe(parsed.pages.length);
    expect(again.notes).toHaveLength(0);
  });
});
