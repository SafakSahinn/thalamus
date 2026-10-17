// Google ile giriş (Identity Services popup kod akışı) ve erişim token'ı yönetimi.
// Kod, durumsuz "account" işlevinde token'a çevrilir. Google'ın kalıcı anahtarı yalnızca o işlevin açabileceği
// şifreli haliyle ("session") tutulur: bu cihazda ve kullanıcının Drive'ındaki Thalamus/session.json'da.
// Yeni cihazda izin ekranı yerine bu dosya okunur; sunucuda hiçbir şey saklanmaz.

import { getMeta, setMeta } from './db';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
/** Yalnızca uygulamanın oluşturduğu "Thalamus" takvimi ve içindeki etkinlikler */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const SCOPE = `openid email profile ${DRIVE_SCOPE}`;

export const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
export const fnUrl = `${(import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''}/functions/v1/account`;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

/** Google girişi ayarlı değilse uygulama yalnızca bu cihazda (yerel modda) çalışır. */
export const cloud = Boolean(clientId && import.meta.env.VITE_SUPABASE_URL && anonKey);

export interface Profile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthState {
  profile: Profile;
  /** Kalıcı anahtarın şifreli hali (yalnızca account işlevi açabilir) */
  session?: string;
  /** Eski sürümlerden kalan düz kalıcı anahtar; ilk yenilemede session'a çevrilir */
  refresh_token?: string;
  access_token: string;
  /** ms */
  expires_at: number;
  /** Duyuru e-postası almak istiyor */
  announcements?: boolean;
  /** Bu girişte hesap ilk kez oluşturuldu (hoş geldin penceresi için) */
  is_new?: boolean;
  /** Google Takvim izni verildi */
  calendar?: boolean;
}

interface CodeResponse {
  code?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup';
            prompt?: string;
            hint?: string;
            include_granted_scopes?: boolean;
            callback: (r: CodeResponse) => void;
            error_callback?: (e: { type: string; message?: string }) => void;
          }): { requestCode(): void };
        };
      };
    };
  }
}

let loading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Google bağlantısı yüklenemedi. İnternet bağlantını kontrol et.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Sayfa açılır açılmaz yüklemeye başla: düğmeye basınca popup engellenmesin. */
export const preloadGoogle = () => void loadGis().catch(() => undefined);

function requestCode(prompt: string, hint?: string, extra = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = window.google!.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: extra ? `${SCOPE} ${extra}` : SCOPE,
      ux_mode: 'popup',
      prompt,
      hint,
      include_granted_scopes: true,
      callback: (r) => {
        if (r.error || !r.code) reject(new Error(r.error_description ?? r.error ?? 'no_code'));
        else if (!(r.scope ?? '').includes(DRIVE_SCOPE)) reject(new Error('drive_scope_missing'));
        else if (extra && !(r.scope ?? '').includes(extra)) reject(new Error('calendar_scope_missing'));
        else resolve(r.code);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'popup_closed' : e.message ?? e.type)),
    });
    c.requestCode();
  });
}

export async function callFn<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error ?? `HTTP ${r.status}`) as Error & { code?: string };
    err.code = data.error;
    throw err;
  }
  return data as T;
}

interface ExchangeResp {
  scope?: string;
  access_token: string;
  expires_in: number;
  session: string | null;
  profile: Profile;
  announcements: boolean;
  /** Kullanıcı listesinde ilk kez görüldü */
  is_new?: boolean;
}

// ---------- Drive'daki oturum dosyası (giriş sırasında, verilen erişim anahtarıyla) ----------

const DAPI = 'https://www.googleapis.com/drive/v3';
const DUP = 'https://www.googleapis.com/upload/drive/v3';
const SESSION_NOTE = 'Thalamus oturum anahtarı (şifreli). Silersen yeni cihazlarda Google izni yeniden sorulur.';

async function dfetch(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive: ${r.status}`);
  return r;
}

/** Uygulamanın oluşturduğu, appProperties.thalamus = kind olan ilk dosya */
async function findApp(token: string, kind: string, extra = ''): Promise<string | null> {
  const query = `trashed=false and appProperties has { key='thalamus' and value='${kind}' }${extra}`;
  const r = await dfetch(token, `${DAPI}/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`);
  return ((await r.json()) as { files: { id: string }[] }).files[0]?.id ?? null;
}

async function readSessionFile(token: string, id: string): Promise<string | null> {
  const r = await dfetch(token, `${DAPI}/files/${id}?alt=media`);
  const d = (await r.json().catch(() => ({}))) as { session?: string };
  return typeof d.session === 'string' ? d.session : null;
}

async function writeSessionFile(token: string, session: string): Promise<void> {
  const data = JSON.stringify({ session });
  const existing = await findApp(token, 'session');
  if (existing) {
    await dfetch(token, `${DUP}/files/${existing}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: data });
    return;
  }
  let root = await findApp(token, 'root', ` and mimeType='application/vnd.google-apps.folder' and 'root' in parents`);
  if (!root) {
    const r = await dfetch(token, `${DAPI}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Thalamus', mimeType: 'application/vnd.google-apps.folder', parents: ['root'], appProperties: { thalamus: 'root' } }),
    });
    root = ((await r.json()) as { id: string }).id;
  }
  const boundary = `thalamus${Math.random().toString(36).slice(2)}`;
  const meta = { name: 'session.json', parents: [root], mimeType: 'application/json', description: SESSION_NOTE, appProperties: { thalamus: 'session' } };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
  await dfetch(token, `${DUP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
}

/** Hesap silinirken: Drive'daki oturum dosyasını kaldır */
export async function removeSessionFile(token: string): Promise<void> {
  const id = await findApp(token, 'session');
  if (id) await dfetch(token, `${DAPI}/files/${id}`, { method: 'DELETE' }).catch(() => undefined);
}

const ERRORS: Record<string, string> = {
  popup_closed: 'Google penceresi kapatıldı.',
  drive_scope_missing: 'Notlarını saklayabilmek için Google Drive iznini de onaylaman gerekiyor.',
  calendar_scope_missing: 'Takvim eşitlemesi için Google Takvim iznini onaylaman gerekiyor.',
  need_consent: 'Bu cihazda devam etmek için Google iznini bir kez onaylaman gerekiyor.',
  access_denied: 'Google izni verilmedi.',
};
export const authErrorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return ERRORS[m] ?? m;
};

/**
 * Google ile giriş. Google kalıcı anahtarı yalnızca izin ekranı gösterildiğinde verir. İlk girişte izin istenir ve
 * anahtarın şifreli hali Drive'a yazılır; sonraki cihazlarda Google yalnızca hesap seçtirir, anahtar Drive'dan okunur.
 */
export async function signInWithGoogle(consent = false): Promise<AuthState> {
  await loadGis();
  const r = await callFn<ExchangeResp>({ action: 'exchange', code: await requestCode(consent ? 'select_account consent' : 'select_account') });
  // Thalamus klasörü yoksa bu hesap ilk kez geliyor (hoş geldin penceresi)
  const isNew = !(await findApp(r.access_token, 'root'));
  let session = r.session;
  if (session) await writeSessionFile(r.access_token, session);
  else {
    const file = await findApp(r.access_token, 'session');
    session = file ? await readSessionFile(r.access_token, file) : null;
    if (!session) throw new Error('need_consent');
  }
  const state: AuthState = {
    profile: r.profile,
    session,
    access_token: r.access_token,
    expires_at: Date.now() + r.expires_in * 1000,
    is_new: r.is_new ?? isNew,
    announcements: r.announcements,
    calendar: (r.scope ?? '').includes(CALENDAR_SCOPE),
  };
  await setMeta('auth', state);
  return state;
}

export const loadAuth = () => getMeta<AuthState>('auth');

/** Google Takvim iznini sonradan iste (yalnızca takvim eşitlemesini açan kullanıcıdan) */
export async function grantCalendar(): Promise<void> {
  await loadGis();
  const a = await loadAuth();
  const r = await callFn<ExchangeResp>({ action: 'exchange', code: await requestCode('consent', a?.profile.email, CALENDAR_SCOPE) });
  if (!r.session) throw new Error('Google kalıcı izin vermedi, lütfen tekrar dene.');
  await writeSessionFile(r.access_token, r.session);
  const cur = a ?? ({ profile: r.profile } as AuthState);
  await setMeta('auth', { ...cur, session: r.session, refresh_token: undefined, access_token: r.access_token, expires_at: Date.now() + r.expires_in * 1000, calendar: true });
}

let refreshing: Promise<string> | null = null;

export class AuthRevokedError extends Error {
  name = 'AuthRevokedError';
}

/** Geçerli erişim token'ı; süresi dolmak üzereyse yeniler. */
export async function accessToken(): Promise<string> {
  const a = await loadAuth();
  if (!a) throw new AuthRevokedError('Oturum yok');
  if (a.expires_at - 60_000 > Date.now()) return a.access_token;
  refreshing ??= (async () => {
    try {
      const r = await callFn<{ access_token: string; expires_in: number; session?: string }>(
        a.session ? { action: 'refresh', session: a.session } : { action: 'refresh', refresh_token: a.refresh_token },
      );
      const next: AuthState = { ...a, access_token: r.access_token, expires_at: Date.now() + r.expires_in * 1000 };
      if (r.session) {
        // Eski düz anahtar şifreli hale çevrildi: Drive'a da yaz ki yeni cihazlar izin sormadan girsin
        next.session = r.session;
        delete next.refresh_token;
        await writeSessionFile(r.access_token, r.session).catch(() => undefined);
      }
      await setMeta('auth', next);
      return r.access_token;
    } catch (e) {
      if ((e as { code?: string }).code === 'revoked') throw new AuthRevokedError('Google izni geri alınmış');
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Sonraki istekte yenilensin (401 alındığında) */
export async function expireToken() {
  const a = await loadAuth();
  if (a) await setMeta('auth', { ...a, expires_at: 0 });
}
