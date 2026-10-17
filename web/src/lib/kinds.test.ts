import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addProp } from './schema';
import { createNote, initLocal, useStore } from './store';
import { typeOf, uidText } from './types';
import { applyView, matches } from './views';

describe('yeni alan türleri', () => {
  it('benzersiz numara: mevcut notlara sırayla, yenilere artarak verilir', async () => {
    await initLocal();
    const a = createNote('lab', 'Deney A');
    const b = createNote('lab', 'Deney B');
    const key = await addProp('lab', { label: 'No', kind: 'uid', prefix: 'DENEY' });
    const notes = () => useStore.getState().notes;
    expect([notes()[a.id].props[key], notes()[b.id].props[key]]).toEqual([1, 2]);
    const c = createNote('lab', 'Deney C');
    expect(notes()[c.id].props[key]).toBe(3);
    const def = typeOf('lab').props.find((p) => p.key === key)!;
    expect(uidText(def, 3)).toBe('DENEY-3');
  });

  it('durum alanı: bitmiş / bitmemiş filtreleri gruplara bakar', async () => {
    const key = await addProp('lab', {
      label: 'İlerleme', kind: 'select', options: ['Başlanmadı', 'Sürüyor', 'Tamamlandı'],
      statusGroups: { Başlanmadı: 'todo', Sürüyor: 'doing', Tamamlandı: 'done' },
    });
    const t = typeOf('lab');
    const x = createNote('lab', 'X', { [key]: 'Tamamlandı' });
    const y = createNote('lab', 'Y', { [key]: 'Sürüyor' });
    const notes = useStore.getState().notes;
    expect(matches(notes[x.id], { key, op: 'done' }, t, notes)).toBe(true);
    expect(matches(notes[y.id], { key, op: 'not_done' }, t, notes)).toBe(true);
    const view = { id: 'v', name: 'v', kind: 'table' as const, filters: [{ key, op: 'not_done' }], sort: [] };
    expect(applyView([notes[x.id], notes[y.id]], view, t, notes).map((n) => n.title)).toEqual(['Y']);
  });
});
