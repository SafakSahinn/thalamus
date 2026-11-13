import { describe, expect, it } from 'vitest';
import { planCleanup, referencedFiles } from './fileRefs';
import type { Note } from './types';

const mk = (props: Record<string, unknown>, content: unknown = null): Note => ({
  id: 'n', type: 'note', title: '', props, content, text: '', links: [], pinned: false, created_at: '', updated_at: '', deleted_at: null,
});

describe('referencedFiles', () => {
  it('alanlarda, editör içeriğinde, paylaşım görsellerinde ve ayarlarda geçen ekleri bulur', () => {
    const notes = [
      mk({ cover: 'gd://AAA_1-x#kapak.jpg', files: [{ src: 'local://k-2#a.pdf', name: 'a.pdf' }] }),
      mk({ __shareFiles: ['SHR'] }, { type: 'doc', content: [{ type: 'image', attrs: { src: 'gd://IMG9#g%C3%B6rsel.png' } }] }),
    ];
    const refs = referencedFiles(notes, { banner: 'gd://SET' });
    expect([...refs].sort()).toEqual(['gd:AAA_1-x', 'gd:IMG9', 'gd:SET', 'gd:SHR', 'local:k-2']);
  });
});

describe('planCleanup', () => {
  const G = 15 * 60_000;
  it('kullanılan, yeni yüklenen ve süresi dolmamış dosyaya dokunmaz', () => {
    const refs = new Set(['gd:used']);
    const cands = [{ key: 'gd:used', createdMs: 0 }, { key: 'gd:new', createdMs: 1_000_000 - 60_000 }, { key: 'gd:old', createdMs: 0 }, { key: 'local:x' }];
    const first = planCleanup(cands, refs, {}, 1_000_000, G);
    expect(first.remove).toEqual([]);
    expect(first.since).toEqual({ 'gd:old': 1_000_000, 'local:x': 1_000_000 });
    const later = planCleanup(cands, refs, first.since, 1_000_000 + G, G);
    expect(later.remove).toEqual(['gd:old', 'local:x']);
  });

  it('yeniden kullanılırsa bekleme sıfırlanır', () => {
    const since = { 'gd:a': 0 };
    expect(planCleanup([{ key: 'gd:a', createdMs: 0 }], new Set(['gd:a']), since, G * 2, G)).toEqual({ remove: [], since: {} });
  });
});
