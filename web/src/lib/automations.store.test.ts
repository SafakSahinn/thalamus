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
});
