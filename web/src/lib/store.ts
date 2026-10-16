import type { RealtimeChannel, Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { clearAll, db, getMeta, loadAll, putNotes, setMeta } from './db';
import { buildBacklinks, computeLinks, plainText } from './links';
import { cloud, supabase } from './supabase';
import { DEFAULT_SETTINGS, type Note, type Settings, type TypeId } from './types';

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

interface State {
  notes: Record<string, Note>;
  ready: boolean;
  /** undefined: henüz bilinmiyor */
  session: Session | null | undefined;
  settings: Settings;
  sync: { status: SyncStatus; pending: number; last?: string; error?: string };
  /** Başka cihazdan gelen değişiklik sayacı (açık editörün içeriği yenilensin diye) */
  remoteRev: Record<string, number>;
}

export const useStore = create<State>(() => ({
  notes: {},
  ready: false,
  session: cloud ? undefined : null,
  settings: DEFAULT_SETTINGS,
  sync: { status: cloud ? 'idle' : 'local', pending: 0 },
  remoteRev: {},
}));

const set = useStore.setState;
const get = useStore.getState;

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export async function initLocal() {
  const all = await loadAll();
  const settings = (await getMeta<Settings>('settings')) ?? DEFAULT_SETTINGS;
  set({ notes: Object.fromEntries(all.map((n) => [n.id, n])), settings, ready: true });
  void refreshPending();
}

// ---------- yerel değişiklikler ----------

const memQueue = new Map<string, Note>();
let writeTimer: ReturnType<typeof setTimeout> | undefined;

function commit(list: Note[]) {
  const notes = { ...get().notes };
  for (const n of list) {
    notes[n.id] = n;
    memQueue.set(n.id, n);
  }
  set({ notes });
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => void writePending(), 300);
}

async function writePending() {
  clearTimeout(writeTimer);
  if (!memQueue.size) return;
  const list = [...memQueue.values()];
  memQueue.clear();
  await putNotes(list, cloud);
  void refreshPending();
  scheduleFlush();
}

export function createNote(
  type: TypeId,
  title = '',
  props: Record<string, unknown> = {},
  content: unknown = null,
): Note {
  const t = now();
  const n: Note = {
    id: uid(), type, title, props, content, text: plainText(content), links: [],
    pinned: false, created_at: t, updated_at: t, deleted_at: null,
  };
  n.links = computeLinks(n);
  commit([n]);
  return n;
}

/** Toplu ekleme (içe aktarma): bağlantıları hesaplanmış hazır notlar. */
export function insertNotes(list: Note[]) {
  commit(list.map((n) => ({ ...n, text: plainText(n.content), links: computeLinks(n) })));
}

export type NotePatch = Partial<Pick<Note, 'title' | 'props' | 'content' | 'pinned' | 'type' | 'deleted_at'>>;

export function updateNote(id: string, patch: NotePatch) {
  const old = get().notes[id];
  if (!old) return;
  const n: Note = { ...old, ...patch, updated_at: now() };
  if ('content' in patch) n.text = plainText(n.content);
  if ('content' in patch || 'props' in patch || 'type' in patch) n.links = computeLinks(n);
  commit([n]);
}

export function setProp(id: string, key: string, value: unknown) {
  const old = get().notes[id];
  if (!old) return;
  const props = { ...old.props };
  if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) delete props[key];
  else props[key] = value;
  updateNote(id, { props });
}

export const deleteNote = (id: string) => updateNote(id, { deleted_at: now() });
export const restoreNote = (id: string) => updateNote(id, { deleted_at: null });

// ---------- günlük ----------

export function todayStr(d = new Date()) {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function findDaily(date: string, notes = get().notes): Note | undefined {
  for (const n of Object.values(notes)) {
    if (n.type === 'daily' && !n.deleted_at && n.props.date === date) return n;
  }
  return undefined;
}

export function ensureDaily(date: string): Note {
  return findDaily(date) ?? createNote('daily', date, { date });
}

// ---------- türetilmiş indeks ----------

let idxFor: Record<string, Note> | null = null;
let idx: { alive: Note[]; backlinks: Map<string, string[]> } = { alive: [], backlinks: new Map() };

export function indexOf(notes: Record<string, Note>) {
  if (idxFor !== notes) {
    const alive = Object.values(notes).filter((n) => !n.deleted_at);
    idx = { alive, backlinks: buildBacklinks(alive) };
    idxFor = notes;
  }
  return idx;
}

export const useIndex = () => indexOf(useStore((s) => s.notes));

// ---------- ayarlar ----------

export async function saveSettings(settings: Settings) {
  set({ settings });
  const t = now();
  await setMeta('settings', settings);
  await setMeta('settingsAt', t);
  if (cloud && get().session) {
    await supabase.from('user_settings').upsert({ data: settings, updated_at: t });
  }
}

async function pullSettings() {
  const { data, error } = await supabase.from('user_settings').select('data,updated_at').maybeSingle();
  if (error) throw error;
  const localAt = (await getMeta<string>('settingsAt')) ?? '';
  if (data && new Date(data.updated_at).toISOString() > localAt) {
    const settings = { ...DEFAULT_SETTINGS, ...(data.data as Settings) };
    set({ settings });
    await setMeta('settings', settings);
    await setMeta('settingsAt', new Date(data.updated_at).toISOString());
  } else if (!data && localAt) {
    await supabase.from('user_settings').upsert({ data: get().settings, updated_at: localAt });
  }
}

// ---------- senkronizasyon ----------

const iso = (s: string | null) => (s ? new Date(s).toISOString() : null);

function fromRow(r: Record<string, unknown>): Note {
  return {
    id: r.id as string,
    type: r.type as TypeId,
    title: (r.title as string) ?? '',
    props: (r.props as Record<string, unknown>) ?? {},
    content: r.content ?? null,
    text: (r.text as string) ?? '',
    links: (r.links as string[]) ?? [],
    pinned: Boolean(r.pinned),
    created_at: iso(r.created_at as string)!,
    updated_at: iso(r.updated_at as string)!,
    deleted_at: iso(r.deleted_at as string | null),
    synced_at: r.synced_at as string,
  };
}

const toRow = (n: Note) => ({
  id: n.id, type: n.type, title: n.title, props: n.props, content: n.content, text: n.text,
  links: n.links, pinned: n.pinned, created_at: n.created_at, updated_at: n.updated_at, deleted_at: n.deleted_at,
});

async function refreshPending() {
  if (!cloud) return;
  const pending = await (await db()).count('outbox');
  set({ sync: { ...get().sync, pending } });
}

async function applyRemote(rows: Note[]) {
  const d = await db();
  const notes = { ...get().notes };
  const rev = { ...get().remoteRev };
  const toPut: Note[] = [];
  for (const r of rows) {
    const pending = memQueue.get(r.id) ?? (await d.get('outbox', r.id));
    if (pending && pending.updated_at > r.updated_at) continue; // yereldeki daha yeni, o gönderilecek
    if (pending) {
      memQueue.delete(r.id);
      await d.delete('outbox', r.id);
    }
    const local = notes[r.id];
    if (local && local.updated_at !== r.updated_at) rev[r.id] = (rev[r.id] ?? 0) + 1;
    notes[r.id] = r;
    toPut.push(r);
  }
  set({ notes, remoteRev: rev });
  await putNotes(toPut, false);
}

async function pull() {
  let cursor = (await getMeta<string>('cursor')) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await supabase
      .from('notes').select('*').gt('synced_at', cursor).order('synced_at').limit(500);
    if (error) throw error;
    if (!data.length) break;
    await applyRemote(data.map(fromRow));
    cursor = data[data.length - 1].synced_at as string;
    await setMeta('cursor', cursor);
    if (data.length < 500) break;
  }
}

let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush() {
  if (!cloud) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush().catch(onSyncError), 1500);
}

async function flush() {
  if (!cloud || !get().session || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    await writePending();
    const d = await db();
    const items = await d.getAll('outbox');
    for (let i = 0; i < items.length; i += 100) {
      const chunk = items.slice(i, i + 100);
      const { error } = await supabase.from('notes').upsert(chunk.map(toRow), { onConflict: 'id' });
      if (error) throw error;
      for (const it of chunk) {
        const cur = await d.get('outbox', it.id);
        if (cur && cur.updated_at === it.updated_at) await d.delete('outbox', it.id);
      }
    }
    set({ sync: { ...get().sync, status: 'idle', last: now(), error: undefined } });
  } finally {
    flushing = false;
    await refreshPending();
  }
}

function onSyncError(e: unknown) {
  const offline = !navigator.onLine;
  set({
    sync: {
      ...get().sync,
      status: offline ? 'offline' : 'error',
      error: offline ? undefined : e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
    },
  });
}

let syncing: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!cloud || !get().session) return Promise.resolve();
  if (!navigator.onLine) {
    set({ sync: { ...get().sync, status: 'offline' } });
    return Promise.resolve();
  }
  syncing ??= (async () => {
    set({ sync: { ...get().sync, status: 'syncing' } });
    try {
      await pull();
      await pullSettings();
      await flush();
      set({ sync: { ...get().sync, status: 'idle', last: now(), error: undefined } });
    } catch (e) {
      onSyncError(e);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

let channel: RealtimeChannel | null = null;
let started = false;

export function startSync() {
  if (!cloud || started) return;
  started = true;
  void (async () => {
    // İlk bulut eşitlemesi: yerel modda yazılmış notlar da gönderilsin
    if (!(await getMeta<string>('cursor'))) {
      const local = Object.values(get().notes);
      if (local.length) await putNotes(local, true);
    }
    await syncNow();
  })();
  let last = 0;
  const soon = () => {
    if (Date.now() - last < 5000) return;
    last = Date.now();
    void syncNow();
  };
  window.addEventListener('focus', soon);
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon();
    else void writePending().then(() => flush()).catch(onSyncError);
  });
  setInterval(() => void syncNow(), 120_000);
  let t: ReturnType<typeof setTimeout> | undefined;
  channel = supabase
    .channel('notes-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
      clearTimeout(t);
      t = setTimeout(() => void syncNow(), 800);
    })
    .subscribe();
}

export async function signOut() {
  await writePending();
  await flush().catch(() => undefined);
  if (channel) await supabase.removeChannel(channel);
  await supabase.auth.signOut();
  await clearAll();
  location.reload();
}

// ---------- dosyalar (görsel, PDF) ----------

export async function uploadFile(file: File | Blob, name: string): Promise<string> {
  const user = get().session?.user;
  if (!cloud || !user) throw new Error('Dosya yüklemek için çevrimiçi hesap gerekli.');
  const safe = name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${user.id}/${uid()}-${safe}`;
  const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return `sb://${path}`;
}

const signed = new Map<string, { url: string; exp: number }>();

export async function resolveFileUrl(src: string): Promise<string> {
  if (!src.startsWith('sb://')) return src;
  const path = src.slice(5);
  const hit = signed.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('files').createSignedUrl(path, 3600);
  if (error) throw error;
  signed.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

window.addEventListener('beforeunload', () => void writePending());
