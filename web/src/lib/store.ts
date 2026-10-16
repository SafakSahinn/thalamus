import { create } from 'zustand';
import { clearAll, db, delMeta, getMeta, loadAll, putNotes, setMeta } from './db';
import { drive as realDrive, isNotFound, type DFile, type DriveApi, type Folders } from './drive';
import { accessToken, callFn, cloud as cloudConfigured, loadAuth, type AuthState, type Profile } from './google';
import { buildBacklinks, computeLinks, plainText } from './links';
import { applyTypeSettings, DEFAULT_SETTINGS, type Note, type Settings, type TypeId } from './types';

export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

interface State {
  notes: Record<string, Note>;
  ready: boolean;
  /** Google hesabı; undefined: henüz bilinmiyor, null: giriş yapılmamış */
  account: Profile | null | undefined;
  announcements: boolean;
  /** Yeni kayıt olan kullanıcıya bir kez gösterilen karşılama */
  welcome: boolean;
  settings: Settings;
  sync: { status: SyncStatus; pending: number; last?: string; error?: string };
  /** Başka cihazdan gelen değişiklik sayacı (açık editörün içeriği yenilensin diye) */
  remoteRev: Record<string, number>;
}

let cloud = cloudConfigured;
let api: DriveApi = realDrive;

/** Testler için: sahte Drive ile bulut modunu aç */
export function __useDrive(fake: DriveApi) {
  api = fake;
  cloud = true;
}

export const useStore = create<State>(() => ({
  notes: {},
  ready: false,
  account: cloud ? undefined : null,
  announcements: false,
  welcome: false,
  settings: DEFAULT_SETTINGS,
  sync: { status: cloud ? 'idle' : 'local', pending: 0 },
  remoteRev: {},
}));

// Koleksiyon tanımları ayarlarla değişir (bu cihazda ya da başka cihazdan gelince)
useStore.subscribe((s, prev) => {
  if (s.settings.types !== prev.settings.types) applyTypeSettings(s.settings.types);
});

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

/** Açılışta kayıtlı Google oturumunu yükler. */
export async function initAuth() {
  const a = await loadAuth();
  set({ account: a?.profile ?? null, announcements: a?.announcements ?? false });
}

/** Girişten sonra: başka bir hesabın yerel verisi kaldıysa temizle. */
export async function onSignedIn(a: AuthState) {
  const owner = await getMeta<string>('ownerSub');
  if (owner && owner !== a.profile.sub) {
    await clearAll();
    await setMeta('auth', a);
  }
  await setMeta('ownerSub', a.profile.sub);
  set({ account: a.profile, announcements: a.announcements, welcome: Boolean(a.is_new) });
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

export async function writePending() {
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
  // Aynı milisaniyede iki düzenleme olursa da sıralama bozulmasın
  let t = now();
  if (t <= old.updated_at) t = new Date(Date.parse(old.updated_at) + 1).toISOString();
  const n: Note = { ...old, ...patch, updated_at: t };
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
  await setMeta('settings', settings);
  await setMeta('settingsAt', now());
  await setMeta('settingsDirty', true);
  scheduleFlush();
}

// ---------- Drive eşitlemesi ----------
//
// Çekme: ilk seferde özet dosyası + klasör listesi, sonrasında Drive "changes" akışı.
// Gönderme: outbox'taki her not kendi dosyasına yazılır. Çakışmada son düzenleyen kazanır (updated_at).

const SNAPSHOT_EVERY = 25;
const SNAPSHOT_MAX_AGE = 24 * 3600_000;

let folders: Folders | null = null;

async function getFolders(): Promise<Folders> {
  folders ??= (await getMeta<Folders>('folders')) ?? null;
  if (!folders) {
    folders = await api.ensureFolders();
    await setMeta('folders', folders);
  }
  return folders;
}

async function refreshPending() {
  if (!cloud) return;
  const pending = await (await db()).count('outbox');
  set({ sync: { ...get().sync, pending } });
}

/** Bir dizi işi en fazla n tanesi aynı anda olacak şekilde çalıştırır */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const fileData = (n: Note) => {
  const { synced_at: _s, ...rest } = n;
  return rest;
};
const noteProps = (n: Note) => ({ thalamus: 'note', noteId: n.id, updatedAt: n.updated_at });

async function applyRemote(rows: Note[]) {
  if (!rows.length) return;
  const d = await db();
  const notes = { ...get().notes };
  const rev = { ...get().remoteRev };
  const toPut: Note[] = [];
  for (const r of rows) {
    if (!r?.id || !r.updated_at) continue;
    const pending = memQueue.get(r.id) ?? (await d.get('outbox', r.id));
    if (pending && pending.updated_at >= r.updated_at) continue; // yereldeki daha yeni, o gönderilecek
    if (pending) {
      memQueue.delete(r.id);
      await d.delete('outbox', r.id);
    }
    const local = notes[r.id];
    if (local && local.updated_at >= r.updated_at) continue;
    if (local) rev[r.id] = (rev[r.id] ?? 0) + 1;
    const n: Note = { ...r, text: r.text ?? plainText(r.content), links: r.links ?? computeLinks(r) };
    notes[r.id] = n;
    toPut.push(n);
  }
  if (!toPut.length) return;
  set({ notes, remoteRev: rev });
  await putNotes(toPut, false);
}

/** Drive dosya listesinden yeni olanları indirir. */
async function applyFiles(files: DFile[]) {
  const d = await db();
  const fetchIds: string[] = [];
  let settingsFile: DFile | null = null;
  for (const f of files) {
    const p = f.appProperties ?? {};
    if (f.trashed) continue;
    if (p.thalamus === 'note' && p.noteId && p.updatedAt) {
      await d.put('driveIds', f.id, p.noteId);
      const local = get().notes[p.noteId];
      const pending = memQueue.get(p.noteId) ?? (await d.get('outbox', p.noteId));
      const newest = [local?.updated_at, pending?.updated_at].filter(Boolean).sort().pop();
      if (!newest || p.updatedAt > newest) fetchIds.push(f.id);
    } else if (p.thalamus === 'settings') {
      settingsFile = f;
    }
  }
  const got: Note[] = [];
  await pool(fetchIds, 6, async (id) => {
    try {
      got.push(await api.readJson<Note>(id));
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  });
  await applyRemote(got);
  if (settingsFile) await pullSettings(settingsFile);
}

async function pullSettings(f: DFile) {
  await setMeta('settingsFileId', f.id);
  const remoteAt = f.appProperties?.updatedAt ?? '';
  const localAt = (await getMeta<string>('settingsAt')) ?? '';
  if (remoteAt <= localAt) return;
  const s = await api.readJson<Settings>(f.id);
  const settings = { ...DEFAULT_SETTINGS, ...s };
  set({ settings });
  await setMeta('settings', settings);
  await setMeta('settingsAt', remoteAt);
  await delMeta('settingsDirty');
}

async function fullPull() {
  const start = await api.startPageToken();
  const f = await getFolders();
  const rootFiles = await api.list(f.root);
  const snap = rootFiles.find((x) => x.appProperties?.thalamus === 'snapshot');
  if (snap) {
    await setMeta('snapshotId', snap.id);
    const data = await api.readJson<{ notes: Note[] }>(snap.id).catch(() => ({ notes: [] as Note[] }));
    await applyRemote(data.notes ?? []);
  }
  await applyFiles([...rootFiles.filter((x) => x.appProperties?.thalamus === 'settings'), ...(await api.list(f.notes))]);
  await setMeta('changesToken', start);
}

async function pull() {
  const token = await getMeta<string>('changesToken');
  if (!token) return fullPull();
  const { files, next } = await api.changes(token);
  await applyFiles(files);
  await setMeta('changesToken', next);
}

let flushing = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush() {
  if (!cloud || !get().account) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void push().catch(onSyncError), 2000);
}

async function push() {
  if (!cloud || !get().account || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    await writePending();
    const d = await db();
    const f = await getFolders();
    const items = await d.getAll('outbox');
    await pool(items, 4, async (it) => {
      let id = await d.get('driveIds', it.id);
      if (id) {
        try {
          await api.updateJson(id, fileData(it), noteProps(it));
        } catch (e) {
          if (!isNotFound(e)) throw e;
          id = undefined;
        }
      }
      if (!id) {
        id = await api.createJson(f.notes, `${it.id}.json`, fileData(it), noteProps(it));
        await d.put('driveIds', id, it.id);
      }
      const cur = await d.get('outbox', it.id);
      if (cur && cur.updated_at === it.updated_at) await d.delete('outbox', it.id);
    });
    if (items.length) await setMeta('sinceSnapshot', ((await getMeta<number>('sinceSnapshot')) ?? 0) + items.length);
    await pushSettings(f);
    await maybeSnapshot(f);
    set({ sync: { ...get().sync, status: 'idle', last: now(), error: undefined } });
  } finally {
    flushing = false;
    await refreshPending();
  }
}

async function pushSettings(f: Folders) {
  if (!(await getMeta<boolean>('settingsDirty'))) return;
  const at = (await getMeta<string>('settingsAt')) ?? now();
  const props = { thalamus: 'settings', updatedAt: at };
  let id = await getMeta<string>('settingsFileId');
  if (id) {
    try {
      await api.updateJson(id, get().settings, props);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      id = undefined;
    }
  }
  if (!id) await setMeta('settingsFileId', await api.createJson(f.root, 'settings.json', get().settings, props));
  await delMeta('settingsDirty');
}

/** Yeni bir cihazın hızlı açılması için ara ara bütün notları tek dosyaya yazar. */
async function maybeSnapshot(f: Folders, force = false) {
  const since = (await getMeta<number>('sinceSnapshot')) ?? 0;
  const at = (await getMeta<number>('snapshotAt')) ?? 0;
  if (!force && (since === 0 || (since < SNAPSHOT_EVERY && Date.now() - at < SNAPSHOT_MAX_AGE))) return;
  const data = { app: 'thalamus', version: 1, at: now(), notes: Object.values(get().notes).map(fileData) };
  const props = { thalamus: 'snapshot', updatedAt: data.at };
  let id = await getMeta<string>('snapshotId');
  if (id) {
    try {
      await api.updateJson(id, data, props);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      id = undefined;
    }
  }
  if (!id) await setMeta('snapshotId', await api.createJson(f.root, 'snapshot.json', data, props));
  await setMeta('sinceSnapshot', 0);
  await setMeta('snapshotAt', Date.now());
}

function onSyncError(e: unknown) {
  if ((e as Error | undefined)?.name === 'AuthRevokedError') {
    set({ account: null, sync: { ...get().sync, status: 'error', error: 'Google oturumun sona erdi, yeniden giriş yap.' } });
    return;
  }
  if (isNotFound(e)) {
    // Kullanıcı Drive'daki Thalamus klasörünü silmiş olabilir: baştan kur
    folders = null;
    void Promise.all(['folders', 'changesToken', 'snapshotId', 'settingsFileId'].map(delMeta)).then(async () => {
      (await db()).clear('driveIds');
      await putNotes(Object.values(get().notes), true);
      await setMeta('settingsDirty', true);
    });
  }
  const offline = !navigator.onLine;
  set({
    sync: {
      ...get().sync,
      status: offline ? 'offline' : 'error',
      error: offline ? undefined : e instanceof Error ? e.message : String(e),
    },
  });
}

let syncing: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!cloud || !get().account) return Promise.resolve();
  if (!navigator.onLine) {
    set({ sync: { ...get().sync, status: 'offline' } });
    return Promise.resolve();
  }
  syncing ??= (async () => {
    set({ sync: { ...get().sync, status: 'syncing' } });
    try {
      await pull();
      await push();
      set({ sync: { ...get().sync, status: 'idle', last: now(), error: undefined } });
    } catch (e) {
      onSyncError(e);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

let started = false;

export function startSync() {
  if (!cloud || started) return;
  started = true;
  void (async () => {
    // İlk eşitleme: yerel modda (girişten önce) yazılmış notlar da gönderilsin
    if (!(await getMeta<string>('changesToken'))) {
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
    else void writePending().then(() => push()).catch(onSyncError);
  });
  // Açıkken yarım dakikada bir başka cihazlardan gelenlere bak
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 30_000);
}

// ---------- hesap ----------

export async function signOut() {
  await writePending();
  await push().catch(() => undefined);
  await clearAll();
  location.hash = '#/';
  location.reload();
}

/** Hesap kaydını siler ve Google iznini geri alır; istenirse Drive'daki Thalamus klasörünü de siler. */
export async function deleteAccount(alsoDrive: boolean) {
  const token = await accessToken();
  if (alsoDrive) {
    const f = folders ?? (await getMeta<Folders>('folders'));
    if (f) await api.remove(f.root).catch((e) => {
      if (!isNotFound(e)) throw e;
    });
  }
  await callFn({ action: 'delete', access_token: token });
  await clearAll();
  location.hash = '#/';
  location.reload();
}

export async function setAnnouncements(v: boolean) {
  await callFn({ action: 'settings', access_token: await accessToken(), announcements: v });
  set({ announcements: v });
  const a = await loadAuth();
  if (a) await setMeta('auth', { ...a, announcements: v });
}

export async function sendFeedback(message: string) {
  await callFn({ action: 'feedback', access_token: await accessToken(), message });
}

// ---------- dosyalar (görsel, PDF) ----------
//
// "Drive'a yükle" (varsayılan): gd://<dosya kimliği>, her cihazda görünür, bu cihazda önbelleğe alınır.
// "Sadece bu cihazda": local://<kimlik>, yalnızca yüklendiği cihazda görünür.

export type AttachMode = 'drive' | 'local';

export const getAttachMode = (): AttachMode => {
  try {
    return (localStorage.getItem('attachMode') as AttachMode) || 'drive';
  } catch {
    return 'drive';
  }
};

export async function uploadFile(file: File | Blob, name: string): Promise<string> {
  const d = await db();
  if (!cloud || !get().account || getAttachMode() === 'local') {
    const key = uid();
    await d.put('blobs', file, `local:${key}`);
    return `local://${key}#${encodeURIComponent(name)}`;
  }
  const f = await getFolders();
  const id = await api.uploadBlob(f.files, name, file);
  await d.put('blobs', file, `gd:${id}`);
  return `gd://${id}#${encodeURIComponent(name)}`;
}

const urls = new Map<string, Promise<string>>();

export function resolveFileUrl(src: string): Promise<string> {
  if (!/^(gd|local):\/\//.test(src)) return Promise.resolve(src);
  let p = urls.get(src);
  if (!p) {
    p = (async () => {
      const d = await db();
      const [scheme, rest] = src.split('://');
      const id = rest.split('#')[0];
      const key = `${scheme}:${id}`;
      let blob = await d.get('blobs', key);
      if (!blob) {
        if (scheme === 'local') throw new Error('Bu dosya yalnızca yüklendiği cihazda duruyor.');
        blob = await api.readBlob(id);
        await d.put('blobs', blob, key);
      }
      return URL.createObjectURL(blob);
    })();
    p.catch(() => urls.delete(src));
    urls.set(src, p);
  }
  return p;
}

window.addEventListener('beforeunload', () => void writePending());
