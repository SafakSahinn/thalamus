// Thalamus hesap işlevi. Notlara hiç dokunmaz (onlar kullanıcının Drive'ında);
// yalnızca Google token değişimini yapar ve hesap kaydını tutar.
//
// POST { action: "exchange", code, announcements? }  → token + profil (ilk girişte kayıt oluşturur)
// POST { action: "refresh", refresh_token }           → yeni erişim token'ı (son aktif zamanını günceller)
// POST { action: "settings", access_token, announcements }
// POST { action: "feedback", access_token, message }
// POST { action: "delete", access_token }             → hesap kaydını siler ve Google iznini geri alır
// GET  ?unsubscribe=<token>                           → duyuru aboneliğinden çıkar
//
// Yenileme token'ı AES-GCM ile şifrelenip saklanır; böylece yeni cihazda Google izin ekranı tekrar çıkmaz.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} tanımlı değil`);
  return v;
};

const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

interface IdClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  aud?: string;
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

/** Erişim token'ını Google'a sorarak doğrular; başka bir uygulamaya ait token'ları reddeder. */
async function verifyAccess(token: unknown): Promise<{ sub: string; email: string } | null> {
  if (typeof token !== 'string' || !token) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
  if (!r.ok) return null;
  const info = await r.json();
  if (info.aud !== env('GOOGLE_CLIENT_ID') || !info.sub) return null;
  return { sub: info.sub, email: info.email ?? '' };
}

async function tokenRequest(params: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  });
  return { ok: r.ok, body: await r.json().catch(() => ({})) };
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// ---------- yenileme token'ı şifreleme (AES-GCM, anahtar TOKEN_ENC_KEY) ----------
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let keyP: Promise<CryptoKey> | null = null;
const encKey = () => (keyP ??= crypto.subtle.importKey('raw', unb64(env('TOKEN_ENC_KEY')), 'AES-GCM', false, ['encrypt', 'decrypt']));

async function seal(text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encKey(), new TextEncoder().encode(text)));
  return `${b64(iv)}.${b64(ct)}`;
}

async function open(sealed: string) {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await encKey(), unb64(ct));
  return new TextDecoder().decode(pt);
}

// Kapak/afiş görselini indirme aracısı: tarayıcı Google Books görsellerini (CORS izni yok) doğrudan
// indiremediği için. Açık vekil olmasın diye yalnızca kapak servislerine izin verilir.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = admin();

  if (req.method === 'GET' && new URL(req.url).searchParams.has('image')) return proxyImage(new URL(req.url).searchParams.get('image')!);

  if (req.method === 'GET') {
    const t = new URL(req.url).searchParams.get('unsubscribe');
    if (t && /^[0-9a-f-]{36}$/i.test(t)) await db.from('users').update({ announcements: false }).eq('unsubscribe_token', t);
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
        const now = new Date().toISOString();
        const { data: existing } = await db.from('users').select('announcements, refresh_token_enc').eq('google_sub', id.sub).maybeSingle();
        // Google yeni yenileme token'ı verdiyse sakla; vermediyse (izin ekranı atlandıysa) saklı olanı kullan
        let refresh: string | null = t.body.refresh_token ?? null;
        const sealed = refresh ? await seal(refresh) : null;
        if (!refresh && existing?.refresh_token_enc) {
          try {
            refresh = await open(existing.refresh_token_enc);
          } catch {
            refresh = null;
          }
        }
        if (!refresh) return json({ error: 'need_consent' }, 409);
        if (existing) {
          await db.from('users').update({ email: id.email, name: id.name ?? null, last_active_at: now, ...(sealed ? { refresh_token_enc: sealed } : {}) }).eq('google_sub', id.sub);
        } else {
          await db.from('users').insert({ google_sub: id.sub, email: id.email, name: id.name ?? null, announcements: body.announcements === true, refresh_token_enc: sealed });
        }
        return json({
          access_token: t.body.access_token,
          expires_in: t.body.expires_in,
          refresh_token: refresh,
          scope: t.body.scope ?? '',
          profile: { sub: id.sub, email: id.email, name: id.name ?? null, picture: id.picture ?? null },
          announcements: existing ? existing.announcements : body.announcements === true,
          is_new: !existing,
        });
      }
      case 'refresh': {
        if (typeof body.refresh_token !== 'string') return json({ error: 'refresh_token' }, 400);
        const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: body.refresh_token });
        if (!t.ok) {
          if (t.body.error === 'invalid_grant') {
            // Google izni geri alınmış: saklı token'ı da temizle
            const id0 = decodeIdToken(t.body.id_token);
            if (id0?.sub) await db.from('users').update({ refresh_token_enc: null }).eq('google_sub', id0.sub);
          }
          return json({ error: t.body.error === 'invalid_grant' ? 'revoked' : 'refresh_failed' }, t.body.error === 'invalid_grant' ? 401 : 400);
        }
        const id = decodeIdToken(t.body.id_token);
        if (id?.sub) await db.from('users').update({ last_active_at: new Date().toISOString() }).eq('google_sub', id.sub);
        return json({ access_token: t.body.access_token, expires_in: t.body.expires_in });
      }
      case 'settings': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        await db.from('users').update({ announcements: body.announcements === true }).eq('google_sub', who.sub);
        return json({ ok: true });
      }
      case 'feedback': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        const message = String(body.message ?? '').trim().slice(0, 5000);
        if (!message) return json({ error: 'empty' }, 400);
        const since = new Date(Date.now() - 86_400_000).toISOString();
        const { count } = await db.from('feedback').select('id', { count: 'exact', head: true }).eq('google_sub', who.sub).gte('created_at', since);
        if ((count ?? 0) >= 10) return json({ error: 'rate_limited' }, 429);
        const { error } = await db.from('feedback').insert({ google_sub: who.sub, email: who.email, message });
        if (error) throw error;
        return json({ ok: true });
      }
      case 'share': {
        // Notun herkese açık kopyasını yayınla / güncelle
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        const noteId = String(body.note_id ?? '');
        if (!noteId) return json({ error: 'note_id' }, 400);
        const content = body.content ?? null;
        if (JSON.stringify(content).length > 1_500_000) return json({ error: 'too_large' }, 413);
        const { data: existing } = await db.from('shares').select('id').eq('owner_sub', who.sub).eq('note_id', noteId).maybeSingle();
        const id = existing?.id ?? crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const { error } = await db.from('shares').upsert({
          id, owner_sub: who.sub, note_id: noteId,
          title: String(body.title ?? '').slice(0, 500), icon: body.icon ? String(body.icon).slice(0, 16) : null,
          props: Array.isArray(body.props) ? body.props.slice(0, 50) : [], content, updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return json({ id });
      }
      case 'unshare': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        await db.from('shares').delete().eq('owner_sub', who.sub).eq('note_id', String(body.note_id ?? ''));
        return json({ ok: true });
      }
      case 'delete': {
        const who = await verifyAccess(body.access_token);
        if (!who) return json({ error: 'unauthorized' }, 401);
        await db.from('users').delete().eq('google_sub', who.sub);
        // Uygulamanın Google iznini geri al (bütün cihazlarda oturum kapanır)
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(body.access_token)}`, { method: 'POST' });
        return json({ ok: true });
      }
      default:
        return json({ error: 'action' }, 400);
    }
  } catch (e) {
    return json({ error: 'server', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
