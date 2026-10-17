// Thalamus yardımcı işlevi. Notlar, oturum anahtarı ve paylaşımlar kullanıcının kendi Google Drive'ında durur.
// Sunucuda yalnızca kullanıcı listesi tutulur (users: e-posta, ad, ilk/son giriş, duyuru tercihi);
// burada ayrıca istemci sırrı (GOOGLE_CLIENT_SECRET) ve oturum şifreleme anahtarı (TOKEN_ENC_KEY) gerektiren işler yapılır.
//
// POST { action: "exchange", code }  → erişim anahtarı + profil; Google yeni kalıcı anahtar verdiyse onun
//                                       şifreli hali ("session"). İstemci bunu Drive'ındaki Thalamus/session.json'a yazar;
//                                       yeni cihazda oradan okuyup getirir, böylece izin ekranı bir daha çıkmaz.
// POST { action: "refresh", session } → yeni erişim anahtarı (eski istemciler için refresh_token da kabul edilir)
// POST { action: "settings", access_token, announcements } → duyuru e-postası tercihi
// POST { action: "revoke", session, access_token } → kullanıcı kaydını siler, uygulamanın Google iznini geri alır
// GET  ?unsubscribe=<token>           → duyuru aboneliğinden çıkar
// GET  ?image=<url>                   → kapak görseli aracısı (Google Books CORS izni vermiyor)
// GET  ?share=<drive dosya kimliği>   → herkese açık paylaşılmış notun içeriği (girişsiz okuyucular için)

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} tanımlı değil`);
  return v;
};

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** Erişim token'ını Google'a sorarak doğrular; başka bir uygulamaya ait token'ları reddeder. */
async function verifyAccess(token: unknown): Promise<{ sub: string; email: string } | null> {
  if (typeof token !== 'string' || !token) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!r.ok) return null;
  const info = await r.json();
  if (info.aud !== env('GOOGLE_CLIENT_ID') || !info.sub) return null;
  return { sub: info.sub, email: info.email ?? '' };
}

/** Google izin geri alma; başarılıysa ya da anahtar zaten geçersizse true */
async function revokeToken(token: string): Promise<boolean> {
  const r = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  });
  if (r.ok) return true;
  const b = await r.json().catch(() => ({}));
  return b.error === 'invalid_token';
}

interface IdClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Token uç noktasından doğrudan (TLS ile) gelen id_token'ın içeriği. */
function decodeIdToken(t?: string): IdClaims | null {
  if (!t) return null;
  try {
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

async function tokenRequest(params: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// ---------- kalıcı anahtar şifreleme (AES-GCM, anahtar TOKEN_ENC_KEY) ----------
// Şifreli hali yalnızca bu işlev açabilir; Drive'daki dosya tek başına bir işe yaramaz.
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let keyP: Promise<CryptoKey> | null = null;
const encKey = () => (keyP ??= crypto.subtle.importKey('raw', unb64(env('TOKEN_ENC_KEY')), 'AES-GCM', false, ['encrypt', 'decrypt']));

async function seal(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encKey(), new TextEncoder().encode(text)));
  return `${b64(iv)}.${b64(ct)}`;
}

async function unseal(sealed: unknown): Promise<string | null> {
  if (typeof sealed !== 'string' || !sealed.includes('.')) return null;
  try {
    const [iv, ct] = sealed.split('.');
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await encKey(), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ---------- kapak görseli aracısı ----------
// Açık vekil olmasın diye yalnızca kapak servislerine izin verilir.
const IMAGE_HOSTS = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'archive.org', 'upload.wikimedia.org'];
const MAX_IMAGE = 10 * 1024 * 1024;

async function proxyImage(raw: string): Promise<Response> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return json({ error: 'url' }, 400);
  }
  const allowed = (h: string) => IMAGE_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
  if (!/^https?:$/.test(url.protocol) || !allowed(url.hostname)) return json({ error: 'host' }, 400);
  url.protocol = 'https:';
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Thalamus/1.0 (kapak indirme)' } });
  if (!r.ok || !allowed(new URL(r.url).hostname)) return json({ error: 'fetch', status: r.status }, 502);
  const type = r.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return json({ error: 'type' }, 415);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE) return json({ error: 'size' }, 413);
  return new Response(buf, { headers: { ...cors, 'Content-Type': type, 'Cache-Control': 'public, max-age=86400' } });
}

// ---------- paylaşılan sayfa okuyucusu ----------
// Paylaşılan not, sahibinin Drive'ında "bağlantıya sahip olan görebilir" ayarlı bir JSON dosyasıdır.
// Tarayıcı Drive'ın indirme adresini CORS yüzünden okuyamadığı için buradan geçer; yalnızca Thalamus paylaşım dosyaları döner.
const MAX_SHARE = 2 * 1024 * 1024;

async function readShare(id: string): Promise<Response> {
  if (!/^[\w-]{20,100}$/.test(id)) return json({ error: 'not_found' }, 404);
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download`, { redirect: 'follow' });
  if (!r.ok) return json({ error: 'not_found' }, 404);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_SHARE) return json({ error: 'too_large' }, 413);
  let data: { thalamus_share?: number } | null = null;
  try {
    data = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    data = null;
  }
  if (!data || data.thalamus_share !== 1) return json({ error: 'not_found' }, 404);
  return json(data, 200, { 'Cache-Control': 'public, max-age=60' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    if (url.searchParams.has('image')) return proxyImage(url.searchParams.get('image')!);
    if (url.searchParams.has('share')) return readShare(url.searchParams.get('share')!);
    const t = url.searchParams.get('unsubscribe');
    if (t === null) return json({ error: 'method' }, 405);
    if (/^[0-9a-f-]{36}$/i.test(t)) await admin().from('users').update({ announcements: false }).eq('unsubscribe_token', t);
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Thalamus</title>' +
        '<body style="font-family:system-ui;padding:40px;text-align:center"><h2>Abonelikten çıktın</h2><p>Artık Thalamus duyuru e-postaları almayacaksın.</p></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case 'exchange': {
        if (typeof body.code !== 'string') return json({ error: 'code' }, 400);
        const t = await tokenRequest({ grant_type: 'authorization_code', code: body.code, redirect_uri: 'postmessage' });
        if (!t.ok) return json({ error: 'exchange_failed', detail: t.body.error_description ?? t.body.error }, 400);
        if (!String(t.body.scope ?? '').includes(DRIVE_SCOPE)) return json({ error: 'drive_scope_missing' }, 400);
        const id = decodeIdToken(t.body.id_token);
        if (!id?.sub || !id.email) return json({ error: 'no_identity' }, 400);
        const db = admin();
        const { data: existing } = await db.from('users').select('announcements').eq('google_sub', id.sub).maybeSingle();
        if (existing) await db.from('users').update({ email: id.email, name: id.name ?? null, last_active_at: new Date().toISOString() }).eq('google_sub', id.sub);
        else await db.from('users').insert({ google_sub: id.sub, email: id.email, name: id.name ?? null });
        return json({
          announcements: existing?.announcements ?? false,
          is_new: !existing,
          access_token: t.body.access_token,
          expires_in: t.body.expires_in,
          scope: t.body.scope ?? '',
          session: t.body.refresh_token ? await seal(t.body.refresh_token) : null,
          profile: { sub: id.sub, email: id.email, name: id.name ?? null, picture: id.picture ?? null },
        });
      }
      case 'refresh': {
        // Eski istemciler düz refresh_token gönderir: onlara şifreli halini de döndür ki Drive'a yazsınlar
        const legacy = typeof body.refresh_token === 'string' ? body.refresh_token : null;
        const rt = legacy ?? (await unseal(body.session));
        if (!rt) return json({ error: 'revoked' }, 401);
        const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: rt });
        if (!t.ok) return json({ error: t.body.error === 'invalid_grant' ? 'revoked' : 'refresh_failed' }, t.body.error === 'invalid_grant' ? 401 : 400);
        const id = decodeIdToken(t.body.id_token);
        if (id?.sub) await admin().from('users').update({ last_active_at: new Date().toISOString() }).eq('google_sub', id.sub);
        return json({
          access_token: t.body.access_token,
          expires_in: t.body.expires_in,
          scope: t.body.scope ?? '',
          ...(legacy ? { session: await seal(legacy) } : {}),
        });
      }
      case 'settings': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        await admin().from('users').update({ announcements: body.announcements === true }).eq('google_sub', who.sub);
        return json({ ok: true });
      }
      case 'revoke': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        await admin().from('users').delete().eq('google_sub', who.sub);
        // Kalıcı anahtar geri alınınca bütün cihazlardaki oturumlar kapanır
        const rt = (await unseal(body.session)) ?? (typeof body.refresh_token === 'string' ? body.refresh_token : null);
        const ok = (rt ? await revokeToken(rt) : false) || (await revokeToken(body.access_token));
        if (!ok) return json({ error: 'revoke_failed' }, 502);
        return json({ ok: true });
      }
      default:
        return json({ error: 'action' }, 400);
    }
  } catch (e) {
    return json({ error: 'server', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
