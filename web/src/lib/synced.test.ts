import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createNote, initLocal, refreshDerived, saveSettings, useStore } from './store';

describe('senkron blok bağlantıları', () => {
  it('senkron bloğun içindeki [[bağlantı]] onu kullanan sayfanın bağlantısı sayılır, metni aranabilir', async () => {
    await initLocal();
    const target = createNote('concept', 'Gözlemlenebilirlik');
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bkz. ' }, { type: 'wikiLink', attrs: { id: target.id, label: 'Gözlemlenebilirlik' } }] }] };
    const s = useStore.getState().settings;
    await saveSettings({ ...s, synced: { s1: { content: doc, updated_at: new Date().toISOString() } } });
    const page = createNote('note', 'Ders özeti', {}, { type: 'doc', content: [{ type: 'syncedBlock', attrs: { sid: 's1' } }] });
    const n = () => useStore.getState().notes[page.id];
    expect(n().links).toContain(target.id);
    expect(n().text).toContain('Bkz.');

    // Senkron içerik değişince yenilenir
    const other = createNote('concept', 'Kontrol edilebilirlik');
    await saveSettings({ ...useStore.getState().settings, synced: { s1: { content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { id: other.id, label: 'x' } }] }] }, updated_at: new Date().toISOString() } } });
    refreshDerived([page.id]);
    expect(n().links).toContain(other.id);
    expect(n().links).not.toContain(target.id);
  });
});
