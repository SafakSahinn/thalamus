import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { propValue } from './compute';
import { createNote, initLocal, setProp, useStore } from './store';
import { backKey, typeOf } from './types';

describe('iki yönlü ilişki', () => {
  it('ters alan hedef tipte görünür ve kaynak notlardan hesaplanır', async () => {
    await initLocal();
    const course = createNote('course', 'Doğrusal Sistemler');
    const paper = createNote('paper', 'Kalman 1960', { course: [course.id] });
    const back = typeOf('course').props.find((p) => p.key === backKey('paper', 'course'))!;
    expect(back).toMatchObject({ kind: 'relation', target: ['paper'], back: { type: 'paper', key: 'course' } });
    expect(back.label).toBe('Makale & Bildiriler');
    // Aynı tipten birden çok ilişki varsa etikette alan adı da yazar (ör. Not → Ders ve Kaynak)
    const notes = () => useStore.getState().notes;
    expect(propValue(notes()[course.id], back, notes())).toEqual([paper.id]);

    // Ters taraftan ekleme/çıkarma kaynak notu günceller
    const p2 = createNote('paper', 'Luenberger 1964');
    setProp(course.id, back.key, [paper.id, p2.id]);
    expect(notes()[p2.id].props.course).toEqual([course.id]);
    expect(notes()[course.id].props[back.key]).toBeUndefined(); // ters alan saklanmaz
    setProp(course.id, back.key, [p2.id]);
    expect(notes()[paper.id].props.course).toBeUndefined();
    expect(propValue(notes()[course.id], back, notes())).toEqual([p2.id]);

    // Yeni not oluştururken ters alan verilirse kaynak nota yazılır
    const lab = createNote('course', 'Devre Lab', { [back.key]: [paper.id] });
    expect(notes()[paper.id].props.course).toEqual([lab.id]);
    expect(notes()[lab.id].props[back.key]).toBeUndefined();
  });

  it('tek kayıt sınırlı ilişkide ters taraftan ekleme öncekinin yerine geçer', async () => {
    const { updateProp } = await import('./schema');
    await updateProp('paper', 'course', { single: true });
    const a = createNote('course', 'A dersi');
    const b = createNote('course', 'B dersi');
    const p = createNote('paper', 'Makale', { course: [a.id] });
    const back = typeOf('course').props.find((x) => x.key === backKey('paper', 'course'))!;
    setProp(b.id, back.key, [p.id]);
    expect(useStore.getState().notes[p.id].props.course).toEqual([b.id]);
    await updateProp('paper', 'course', { single: undefined });
  });

  it('aynı tipe birden çok ilişki varsa etikette alan adı da yazar, kendine ilişki "(geri)" olur', () => {
    const paperBacks = typeOf('paper').props.filter((p) => p.back);
    expect(paperBacks.map((p) => p.label)).toContain('Atıf yaptığı yayınlar (geri)');
    const courseBacks = typeOf('course').props.filter((p) => p.back).map((p) => p.label);
    expect(courseBacks).toContain('Notlar');
  });
});
