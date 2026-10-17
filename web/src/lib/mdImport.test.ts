import { describe, expect, it } from 'vitest';
import { buildMdNotes, obsidianToMd, parseFrontmatter } from './mdImport';

describe('Markdown / Obsidian içe aktarma', () => {
  it('YAML başlığını ve Obsidian bağlantılarını çözer', () => {
    const { data, body } = parseFrontmatter('---\ntitle: Kalman\ntags: [filtre, kontrol]\nyazar:\n  - Kalman\n  - Bucy\n---\nMetin');
    expect(data).toEqual({ title: 'Kalman', tags: ['filtre', 'kontrol'], yazar: ['Kalman', 'Bucy'] });
    expect(body).toBe('Metin');
    expect(obsidianToMd('Bak [[Doğrusal Sistemler|ders]] ve [[Kalman#Giriş]] ![[şekil 1.png|300]]\n```\n[[kod]]\n```'))
      .toBe('Bak [ders](<Doğrusal Sistemler.md>) ve [Kalman](<Kalman.md>) ![](<şekil 1.png>)\n```\n[[kod]]\n```');
  });

  it('klasörleri üst sayfa yapar, bağlantıları ve görselleri bağlar', async () => {
    const f = (path: string, text: string) => ({ path, blob: new Blob([text]) });
    const r = await buildMdNotes(
      [
        f('Dersler/Doğrusal Sistemler.md', '# Durum uzayı\n[[Kalman]] filtresine bak. ![[a.png]]'),
        f('Kalman.md', '---\ntitle: Kalman Filtresi\nyil: 1960\n---\nTahmin + düzeltme.'),
        f('ekler/a.png', 'PNG'),
      ],
      [],
      async (_b, name) => `local://${name}`,
    );
    expect(r.folders).toBe(1);
    expect(r.images).toBe(1);
    const ders = r.notes.find((n) => n.title === 'Doğrusal Sistemler')!;
    const kalman = r.notes.find((n) => n.title === 'Kalman Filtresi')!;
    const folder = r.notes.find((n) => n.title === 'Dersler')!;
    expect(ders.props.parent).toEqual([folder.id]);
    expect(kalman.props.extra).toEqual({ yil: '1960' });
    const json = JSON.stringify(ders.content);
    expect(json).toContain(kalman.id); // [[Kalman]] → not bağlantısı (dosya adından)
    expect(json).toContain('local://a.png');
  });
});
