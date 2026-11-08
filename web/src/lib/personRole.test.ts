import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createNote, initLocal, setProp, useStore } from './store';

describe('kişinin unvanı', () => {
  it('kitaba yazar, filme yönetmen olarak eklenen kişinin boş unvanı dolar', async () => {
    await initLocal();
    const notes = () => useStore.getState().notes;
    const book = createNote('book', 'Kürk Mantolu Madonna');
    const film = createNote('movie', 'Kış Uykusu');
    const sabahattin = createNote('person', 'Sabahattin Ali');
    const nuri = createNote('person', 'Nuri Bilge Ceylan');
    const hoca = createNote('person', 'Bir Hoca', { role: 'Profesör' });

    setProp(book.id, 'author', [sabahattin.id, hoca.id]);
    setProp(film.id, 'director', [nuri.id]);
    expect(notes()[sabahattin.id].props.role).toBe('Yazar');
    expect(notes()[nuri.id].props.role).toBe('Yönetmen');
    expect(notes()[hoca.id].props.role).toBe('Profesör'); // dolu unvana dokunulmaz

    // Kullanıcı unvanı sildiyse, kişi zaten bağlıyken tekrar yazılmaz
    setProp(sabahattin.id, 'role', '');
    setProp(book.id, 'author', [sabahattin.id]);
    expect(notes()[sabahattin.id].props.role).toBeUndefined();
  });
});
