// Google Drive REST API (yalnızca drive.file izni: uygulama sadece kendi oluşturduğu dosyaları görür).
// Yerleşim: Drive'ım / Thalamus / notes / <not kimliği>.json   ·   Thalamus / files / <ekler>
// Her not dosyasının appProperties'inde noteId ve updatedAt durur; böylece içerik indirmeden karşılaştırılır.

import { accessToken, expireToken } from './google';

export type Kind = 'root' | 'notes' | 'files' | 'note' | 'settings' | 'snapshot';

export interface DFile {
  id: string;
  appProperties?: Record<string, string>;
  trashed?: boolean;
}

export interface Folders {
  root: string;
  notes: string;
  files: string;
}

export interface DriveApi {
  ensureFolders(): Promise<Folders>;
  /** Klasördeki dosyaların meta verisi (içerik yok) */
  list(parent: string): Promise<DFile[]>;
  startPageToken(): Promise<string>;
  /** removed: silinmiş (ya da çöpe atılmış) dosya kimlikleri */
  changes(token: string): Promise<{ files: DFile[]; removed: string[]; next: string }>;
  readJson<T>(id: string): Promise<T>;
  createJson(parent: string, name: string, data: unknown, props: Record<string, string>): Promise<string>;
  /** Dosya yoksa (kullanıcı silmişse) NotFoundError fırlatır */
  updateJson(id: string, data: unknown, props: Record<string, string>): Promise<void>;
  uploadBlob(parent: string, name: string, blob: Blob): Promise<string>;
  readBlob(id: string): Promise<Blob>;
  remove(id: string): Promise<void>;
}

export class NotFoundError extends Error {
  name = 'NotFoundError';
}
export class DriveFullError extends Error {
  name = 'DriveFullError';
}

/** Modül örnekleri arasında da çalışsın diye ada bakılır */
export const isNotFound = (e: unknown) => (e as Error | undefined)?.name === 'NotFoundError';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

async function req(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await accessToken();
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (r.status === 401 && retry) {
    await expireToken();
    return req(url, init, false);
  }
  if ((r.status === 429 || r.status >= 500) && retry) {
    await new Promise((res) => setTimeout(res, 1500));
    return req(url, init, false);
  }
  if (r.status === 404) throw new NotFoundError('Drive dosyası bulunamadı');
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status;
    if (reason === 'storageQuotaExceeded') throw new DriveFullError('Google Drive alanın dolu.');
    throw new Error(`Drive: ${body?.error?.message ?? r.status}`);
  }
  return r;
}

function multipart(meta: unknown, content: Blob | string, type: string) {
  const boundary = `thalamus${Math.random().toString(36).slice(2)}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ]);
  return { body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } };
}

const q = (s: string) => encodeURIComponent(s);

async function findFolder(kind: Kind, parent: string): Promise<string | null> {
  const query = `mimeType='${FOLDER}' and trashed=false and '${parent}' in parents and appProperties has { key='thalamus' and value='${kind}' }`;
  const r = await req(`${API}/files?q=${q(query)}&fields=files(id)&spaces=drive`);
  const { files } = (await r.json()) as { files: DFile[] };
  return files[0]?.id ?? null;
}

async function createFolder(name: string, kind: Kind, parent: string): Promise<string> {
  const r = await req(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent], appProperties: { thalamus: kind } }),
  });
  return ((await r.json()) as DFile).id;
}

export const drive: DriveApi = {
  async ensureFolders() {
    const root = (await findFolder('root', 'root')) ?? (await createFolder('Thalamus', 'root', 'root'));
    const notes = (await findFolder('notes', root)) ?? (await createFolder('notes', 'notes', root));
    const files = (await findFolder('files', root)) ?? (await createFolder('files', 'files', root));
    return { root, notes, files };
  },

  async list(parent) {
    const out: DFile[] = [];
    let page = '';
    do {
      const r = await req(`${API}/files?q=${q(`'${parent}' in parents and trashed=false`)}&pageSize=1000&fields=nextPageToken,files(id,appProperties)&spaces=drive${page ? `&pageToken=${page}` : ''}`);
      const d = (await r.json()) as { files: DFile[]; nextPageToken?: string };
      out.push(...d.files);
      page = d.nextPageToken ?? '';
    } while (page);
    return out;
  },

  async startPageToken() {
    const r = await req(`${API}/changes/startPageToken`);
    return ((await r.json()) as { startPageToken: string }).startPageToken;
  },

  async changes(token) {
    const files: DFile[] = [];
    const removed: string[] = [];
    let page = token;
    for (;;) {
      const r = await req(`${API}/changes?pageToken=${q(page)}&pageSize=1000&spaces=drive&fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(id,trashed,appProperties))`);
      const d = (await r.json()) as { changes: { fileId: string; removed?: boolean; file?: DFile }[]; nextPageToken?: string; newStartPageToken?: string };
      for (const c of d.changes) {
        if (c.removed || c.file?.trashed) removed.push(c.fileId);
        else if (c.file) files.push(c.file);
      }
      if (d.newStartPageToken) return { files, removed, next: d.newStartPageToken };
      page = d.nextPageToken!;
    }
  },

  async readJson<T>(id: string) {
    const r = await req(`${API}/files/${id}?alt=media`);
    return (await r.json()) as T;
  },

  async createJson(parent, name, data, props) {
    const m = multipart({ name, parents: [parent], mimeType: 'application/json', appProperties: props }, JSON.stringify(data), 'application/json');
    const r = await req(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', ...m });
    return ((await r.json()) as DFile).id;
  },

  async updateJson(id, data, props) {
    const m = multipart({ appProperties: props }, JSON.stringify(data), 'application/json');
    await req(`${UPLOAD}/files/${id}?uploadType=multipart&fields=id`, { method: 'PATCH', ...m });
  },

  async uploadBlob(parent, name, blob) {
    const m = multipart({ name, parents: [parent], appProperties: { thalamus: 'file' } }, blob, blob.type || 'application/octet-stream');
    const r = await req(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: 'POST', ...m });
    return ((await r.json()) as DFile).id;
  },

  async readBlob(id) {
    const r = await req(`${API}/files/${id}?alt=media`);
    return r.blob();
  },

  async remove(id) {
    await req(`${API}/files/${id}`, { method: 'DELETE' });
  },
};
