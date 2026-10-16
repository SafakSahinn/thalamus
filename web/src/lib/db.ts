import { openDB, type IDBPDatabase } from 'idb';
import type { Note } from './types';

// Yerel önbellek: uygulama açılırken notlar ağdan beklenmeden buradan gelir.
// outbox: henüz sunucuya gönderilmemiş değişiklikler (çevrimdışı düzenleme).

interface Schema {
  notes: { key: string; value: Note };
  outbox: { key: string; value: Note };
  meta: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  dbp ??= openDB<Schema>('thalamus', 1, {
    upgrade(d) {
      d.createObjectStore('notes', { keyPath: 'id' });
      d.createObjectStore('outbox', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

export async function loadAll(): Promise<Note[]> {
  return (await db()).getAll('notes');
}

export async function putNotes(notes: Note[], outbox: boolean) {
  const d = await db();
  const tx = d.transaction(outbox ? ['notes', 'outbox'] : ['notes'], 'readwrite');
  for (const n of notes) {
    void tx.objectStore('notes').put(n);
    if (outbox) void tx.objectStore('outbox').put(n);
  }
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key) as Promise<T | undefined>;
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key);
}

export async function clearAll() {
  const d = await db();
  await Promise.all([d.clear('notes'), d.clear('outbox'), d.clear('meta')]);
}
