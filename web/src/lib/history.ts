// Sayfa geçmişi: bu cihazda tutulan sürümler + Google Drive'ın dosya sürümleri.

import { db } from './db';
import type { Note } from './types';

export interface Version {
  /** benzersiz anahtar */
  key: string;
  at: string;
  title: string;
  props: Record<string, unknown>;
  content: unknown;
  source: 'device' | 'drive';
  /** Drive sürümü: içerik ihtiyaç olunca indirilir */
  load?: () => Promise<Note>;
}

export interface Snapshot {
  k: string;
  noteId: string;
  at: string;
  title: string;
  props: Record<string, unknown>;
  content: unknown;
}

const GAP = 10 * 60_000;
const KEEP = 60;
const lastSnap = new Map<string, number>();

/** Notun önceki halini kaydet (aynı not için en fazla 10 dakikada bir) */
export async function snapshot(old: Note, force = false) {
  if (old.props.__template && !force) return;
  const last = lastSnap.get(old.id) ?? 0;
  if (!force && Date.now() - last < GAP) return;
  if (!old.content && !old.title) return;
  lastSnap.set(old.id, Date.now());
  const d = await db();
  const snap: Snapshot = { k: `${old.id}|${old.updated_at}`, noteId: old.id, at: old.updated_at, title: old.title, props: old.props, content: old.content };
  await d.put('history', snap);
  const keys = await d.getAllKeysFromIndex('history', 'note', old.id);
  if (keys.length > KEEP) {
    keys.sort();
    for (const k of keys.slice(0, keys.length - KEEP)) await d.delete('history', k);
  }
}

export async function deviceVersions(noteId: string): Promise<Version[]> {
  const d = await db();
  const list = await d.getAllFromIndex('history', 'note', noteId);
  return list.map((s) => ({ key: `d:${s.k}`, at: s.at, title: s.title, props: s.props, content: s.content, source: 'device' as const }));
}

export async function dropHistory(noteId: string) {
  const d = await db();
  for (const k of await d.getAllKeysFromIndex('history', 'note', noteId)) await d.delete('history', k);
}
