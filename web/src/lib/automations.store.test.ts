import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createNote, initLocal, saveSettings, setProp, todayStr, useStore } from './store';

describe('otomasyonlar notlarda çalışır', () => {
  it('Durum Bitti olunca bitiş tarihi bugün olur; yeni kitap Okunacak başlar', async () => {
    await initLocal();
    const s = useStore.getState().settings;
    await saveSettings({
      ...s,
      automations: {
        book: [
          { id: 'r1', on: true, when: { kind: 'changed', key: 'status', to: 'Bitti' }, then: [{ key: 'finished', value: 'today' }] },
          { id: 'r2', on: true, when: { kind: 'created' }, then: [{ key: 'status', value: 'Okunacak' }] },
        ],
      },
    });
    const b = createNote('book', 'Kürk Mantolu Madonna');
    const notes = () => useStore.getState().notes;
    expect(notes()[b.id].props.status).toBe('Okunacak');
    setProp(b.id, 'status', 'Bitti');
    expect(notes()[b.id].props.finished).toBe(todayStr());
  });

  it('düğme alanı eylemlerini kayda uygular', async () => {
    const { runButton } = await import('./store');
    const b = createNote('book', 'Sapiens', { status: 'Okunuyor', rating: 3 });
    runButton(b.id, [{ key: 'status', value: 'Okunacak' }, { key: 'rating', value: '5' }, { key: 'finished', value: 'clear' }]);
    expect(useStore.getState().notes[b.id].props).toMatchObject({ status: 'Okunacak', rating: 5 });
    expect(useStore.getState().notes[b.id].props.finished).toBeUndefined();
  });
});
