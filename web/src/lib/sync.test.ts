import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { NotFoundError, type DFile, type DriveApi, type Folders } from './drive';

// Aynı kullanıcının Drive'ını taklit eden bellek içi Drive. Birden çok "cihaz" aynı örneği paylaşır.
class FakeDrive implements DriveApi {
  files = new Map<string, { parent: string; name: string; props: Record<string, string>; data: unknown; folder?: boolean }>();
  log: string[] = [];
  reads = 0;
  private n = 0;
  private touch(id: string) {
    this.log.push(id);
  }
  private newId() {
    return `f${++this.n}`;
  }
  async ensureFolders(): Promise<Folders> {
    const find = (kind: string, parent: string) =>
      [...this.files].find(([, f]) => f.folder && f.parent === parent && f.props.thalamus === kind)?.[0];
    const mk = (name: string, kind: string, parent: string) => {
      const id = this.newId();
      this.files.set(id, { parent, name, props: { thalamus: kind }, data: null, folder: true });
      return id;
    };
    const root = find('root', 'root') ?? mk('Thalamus', 'root', 'root');
    const notes = find('notes', root) ?? mk('notes', 'notes', root);
    const files = find('files', root) ?? mk('files', 'files', root);
    return { root, notes, files };
  }
  async list(parent: string): Promise<DFile[]> {
    if (!this.files.has(parent)) throw new NotFoundError('yok');
    return [...this.files].filter(([, f]) => f.parent === parent).map(([id, f]) => ({ id, appProperties: { ...f.props } }));
  }
  async startPageToken() {
    return String(this.log.length);
  }
  async changes(token: string) {
    const ids = [...new Set(this.log.slice(Number(token)))];
    return {
      files: ids.filter((id) => this.files.has(id)).map((id) => ({ id, appProperties: { ...this.files.get(id)!.props } })),
      removed: ids.filter((id) => !this.files.has(id)),
      next: String(this.log.length),
    };
  }
  async readJson<T>(id: string): Promise<T> {
    const f = this.files.get(id);
    if (!f) throw new NotFoundError('yok');
    this.reads++;
    return structuredClone(f.data) as T;
  }
  async createJson(parent: string, name: string, data: unknown, props: Record<string, string>) {
    if (!this.files.has(parent)) throw new NotFoundError('klasör yok');
    const id = this.newId();
    this.files.set(id, { parent, name, props: { ...props }, data: structuredClone(data) });
    this.touch(id);
    return id;
  }
  async updateJson(id: string, data: unknown, props: Record<string, string>) {
    const f = this.files.get(id);
    if (!f) throw new NotFoundError('yok');
    f.data = structuredClone(data);
    f.props = { ...props };
    this.touch(id);
  }
  async uploadBlob(parent: string, name: string, blob: Blob) {
    const id = this.newId();
    this.files.set(id, { parent, name, props: { thalamus: 'file' }, data: blob });
    this.touch(id);
    return id;
  }
  async readBlob(id: string) {
    const f = this.files.get(id);
    if (!f) throw new NotFoundError('yok');
    return f.data as Blob;
  }
  async remove(id: string) {
    const drop = (x: string) => {
      for (const [cid, c] of this.files) if (c.parent === x) drop(cid);
      this.files.delete(x);
      this.touch(x);
    };
    drop(id);
  }
  noteFiles() {
    return [...this.files.values()].filter((f) => f.props.thalamus === 'note');
  }
}

type Store = typeof import('./store');

const drive = new FakeDrive();

/** Ayrı bir cihaz: kendi yerel veritabanı ve kendi modül örneği. */
async function device(): Promise<Store> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const s: Store = await import('./store');
  s.__useDrive(drive);
  s.useStore.setState({ account: { sub: 'u1', email: 'a@b.c', name: 'A', picture: null } });
  await s.initLocal();
  return s;
}

const tick = (ms = 3) => new Promise((r) => setTimeout(r, ms));
const notesOf = (s: Store) => s.useStore.getState().notes;

beforeAll(() => {
  URL.createObjectURL = () => 'blob:fake';
});

describe('Drive eşitlemesi (iki cihaz, sahte Drive)', () => {
  let A: Store;
  let B: Store;
  let bookId = '';

  it('A notları Drive’a yazar, B ilk açılışta hepsini alır', async () => {
    A = await device();
    const book = A.createNote('book', 'Suç ve Ceza', { status: 'Bitti' });
    bookId = book.id;
    A.createNote('word', 'ephemeral', { meaning: 'gelip geçici' });
    await A.writePending();
    await A.syncNow();
    expect(A.useStore.getState().sync.error).toBeUndefined();
    expect(drive.noteFiles()).toHaveLength(2);
    expect(A.useStore.getState().sync.pending).toBe(0);

    B = await device();
    await B.syncNow();
    expect(notesOf(B)[bookId]?.title).toBe('Suç ve Ceza');
    expect(Object.keys(notesOf(B))).toHaveLength(2);
  });

  it('B’deki düzenleme A’ya gelir ve açık editör için remoteRev artar', async () => {
    await tick();
    B.updateNote(bookId, { title: 'Suç ve Ceza (2. okuma)' });
    await B.writePending();
    await B.syncNow();
    expect(drive.noteFiles()).toHaveLength(2); // yeni dosya değil, aynı dosya güncellendi
    await A.syncNow();
    expect(notesOf(A)[bookId].title).toBe('Suç ve Ceza (2. okuma)');
    expect(A.useStore.getState().remoteRev[bookId]).toBe(1);
  });

  it('Çakışma: sonra yapılan düzenleme kazanır, eski olan yenisini ezmez', async () => {
    await tick();
    B.setProp(bookId, 'rating', 3); // önce B
    await B.writePending();
    await tick();
    A.setProp(bookId, 'rating', 5); // sonra A (henüz gönderilmedi)
    await A.writePending();
    await B.syncNow(); // B'nin eski düzenlemesi Drive'a gider
    await A.syncNow(); // A çekerken kendi daha yeni değişikliğini korur, sonra gönderir
    expect(notesOf(A)[bookId].props.rating).toBe(5);
    await B.syncNow();
    expect(notesOf(B)[bookId].props.rating).toBe(5);
  });

  it('Kendi gönderdiğini geri indirmez', async () => {
    const before = drive.reads;
    await A.syncNow();
    await A.syncNow();
    expect(drive.reads).toBe(before);
  });

  it('Silme (çöp kutusu) diğer cihaza geçer', async () => {
    await tick();
    A.deleteNote(bookId);
    await A.writePending();
    await A.syncNow();
    await B.syncNow();
    expect(notesOf(B)[bookId].deleted_at).toBeTruthy();
  });

  it('Rutin ayarları eşitlenir', async () => {
    await tick();
    await A.saveSettings({ routines: [{ id: 'r1', label: 'Koşu', icon: '🏃' }] });
    await A.syncNow();
    await B.syncNow();
    expect(B.useStore.getState().settings.routines.map((r) => r.label)).toEqual(['Koşu']);
  });

  it('Görsel eki Drive’a yüklenir ve diğer cihazda açılır', async () => {
    const src = await A.uploadFile(new Blob(['png'], { type: 'image/png' }), 'şema.png');
    expect(src).toMatch(/^gd:\/\/f\d+#/);
    expect(await B.resolveFileUrl(src)).toBe('blob:fake');
  });

  it('Özet dosyası: yeni cihaz notları tek dosyadan alır, tek tek indirmez', async () => {
    for (let i = 0; i < 30; i++) A.createNote('note', `Not ${i}`);
    await A.writePending();
    await A.syncNow();
    expect([...drive.files.values()].some((f) => f.props.thalamus === 'snapshot')).toBe(true);
    await tick();
    A.createNote('concept', 'Özetten sonra eklenen');
    await A.writePending();
    await A.syncNow();

    const before = drive.reads;
    const C = await device();
    await C.syncNow();
    const total = Object.keys(notesOf(A)).length;
    expect(Object.keys(notesOf(C))).toHaveLength(total);
    // 1 özet + 1 ayar + yalnızca özetten sonra değişen not(lar)
    expect(drive.reads - before).toBeLessThanOrEqual(4);
  });

  it('Kalıcı silme diğer cihaza geçer ve yeni cihazda özet dosyasından dirilmez', async () => {
    const victim = A.createNote('note', 'Silinecek not');
    await A.writePending();
    await A.syncNow();
    await B.syncNow();
    expect(notesOf(B)[victim.id]).toBeTruthy();
    await A.purgeNote(victim.id);
    expect(notesOf(A)[victim.id]).toBeUndefined();
    await B.syncNow();
    expect(notesOf(B)[victim.id]).toBeUndefined();
    const D = await device();
    await D.syncNow();
    expect(notesOf(D)[victim.id]).toBeUndefined();
  });

  it('Kullanıcı Drive’daki klasörü silerse bir sonraki eşitlemede baştan kurulur', async () => {
    const root = [...drive.files].find(([, f]) => f.props.thalamus === 'root')![0];
    await drive.remove(root);
    await tick();
    A.createNote('note', 'Klasör silindikten sonra');
    await A.writePending();
    await A.syncNow(); // hata: klasör yok → sıfırlar
    await tick(20);
    await A.syncNow(); // yeniden kurar ve her şeyi gönderir
    expect(A.useStore.getState().sync.error).toBeUndefined();
    expect(drive.noteFiles().length).toBe(Object.keys(notesOf(A)).length);
  });
});
