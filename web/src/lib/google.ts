// Google ile giriş (Identity Services popup kod akışı) ve erişim token'ı yönetimi.
// Kod, "account" edge function'ında token'a çevrilir; yenileme token'ı yalnızca bu cihazda saklanır.

import { getMeta, setMeta } from './db';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPE = `openid email profile ${DRIVE_SCOPE}`;

export const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
const fnUrl = `${(import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''}/functions/v1/account`;
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
  refresh_token: string;
  access_token: string;
  /** ms */
  expires_at: number;
  announcements: boolean;
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

function requestCode(prompt: string, hint?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = window.google!.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: SCOPE,
      ux_mode: 'popup',
      prompt,
      hint,
      callback: (r) => {
        if (r.error || !r.code) reject(new Error(r.error_description ?? r.error ?? 'no_code'));
        else if (!(r.scope ?? '').includes(DRIVE_SCOPE)) reject(new Error('drive_scope_missing'));
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
  access_token: string;
  expires_in: number;
  refresh_token: string | null;
  profile: Profile;
  announcements: boolean;
}

const ERRORS: Record<string, string> = {
  popup_closed: 'Google penceresi kapatıldı.',
  drive_scope_missing: 'Notlarını saklayabilmek için Google Drive iznini de onaylaman gerekiyor.',
  access_denied: 'Google izni verilmedi.',
};
export const authErrorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return ERRORS[m] ?? m;
};

/**
 * Google ile giriş. Google kalıcı oturum (yenileme) token'ını yalnızca onay ekranı gösterildiğinde verdiği için
 * hesap seçimi ve onay tek pencerede istenir (art arda ikinci pencere tarayıcıda engellenebilir).
 */
export async function signInWithGoogle(announcements: boolean): Promise<AuthState> {
  await loadGis();
  const r = await callFn<ExchangeResp>({ action: 'exchange', code: await requestCode('select_account consent'), announcements });
  if (!r.refresh_token) throw new Error('Google kalıcı oturum izni vermedi, lütfen tekrar dene.');
  const state: AuthState = {
    profile: r.profile,
    refresh_token: r.refresh_token,
    access_token: r.access_token,
    expires_at: Date.now() + r.expires_in * 1000,
    announcements: r.announcements,
  };
  await setMeta('auth', state);
  return state;
}

export const loadAuth = () => getMeta<AuthState>('auth');

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
      const r = await callFn<{ access_token: string; expires_in: number }>({ action: 'refresh', refresh_token: a.refresh_token });
      await setMeta('auth', { ...a, access_token: r.access_token, expires_at: Date.now() + r.expires_in * 1000 });
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
