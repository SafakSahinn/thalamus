import { openDB, type IDBPDatabase } from 'idb';
import type { Snapshot } from './history';
import type { Note } from './types';

// Yerel veritabanı: uygulama açılırken notlar ağı beklemeden buradan gelir.
// outbox: henüz Drive'a gönderilmemiş değişiklikler (çevrimdışı düzenleme).
// driveIds: not kimliği → Drive dosya kimliği.  blobs: görsel/PDF ekleri (yerel ya da Drive önbelleği).

interface Schema {
  notes: { key: string; value: Note };
  outbox: { key: string; value: Note };
  meta: { key: string; value: unknown };
  driveIds: { key: string; value: string };
  blobs: { key: string; value: Blob };
  history: { key: string; value: Snapshot; indexes: { note: string } };
}

const STORES = ['notes', 'outbox', 'meta', 'driveIds', 'blobs', 'history'] as const;

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  dbp ??= openDB<Schema>('thalamus', 3, {
    upgrade(d, old) {
      if (old < 1) {
        d.createObjectStore('notes', { keyPath: 'id' });
        d.createObjectStore('outbox', { keyPath: 'id' });
        d.createObjectStore('meta');
      }
      if (old < 2) {
        d.createObjectStore('driveIds');
        d.createObjectStore('blobs');
      }
      if (old < 3) {
        d.createObjectStore('history', { keyPath: 'k' }).createIndex('note', 'noteId');
      }
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

export async function delMeta(key: string) {
  await (await db()).delete('meta', key);
}

export async function clearAll() {
  const d = await db();
  await Promise.all(STORES.map((s) => d.clear(s)));
}
