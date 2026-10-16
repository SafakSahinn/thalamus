import { useState } from 'react';
import { siteRoot, supabase } from '../lib/supabase';

export function NewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setMsg(error.message);
    else onDone();
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={save}>
        <h1>Yeni şifre</h1>
        <input type="password" value={pw} minLength={8} placeholder="En az 8 karakter" onChange={(e) => setPw(e.target.value)} autoFocus />
        <button className="btn primary" disabled={pw.length < 8}>Kaydet</button>
        {msg && <p className="err">{msg}</p>}
      </form>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: siteRoot } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Onay e-postası gönderildi. E-postadaki bağlantıya tıkladıktan sonra giriş yapabilirsin.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteRoot });
        if (error) throw error;
        setMsg({ ok: true, text: 'Şifre sıfırlama bağlantısı e-postana gönderildi.' });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setMsg({ ok: false, text: m === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : m });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} />
        <h1>Zihin Atlası</h1>
        <p className="muted">Notların, kitapların, makalelerin ve sözlüğün tek yerde ve birbirine bağlı.</p>
        <input type="email" required value={email} placeholder="E-posta" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'reset' && (
          <div className="pwrow">
            <input type={show ? 'text' : 'password'} required minLength={mode === 'up' ? 8 : undefined} value={pw} placeholder="Şifre" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="iconbtn" onClick={() => setShow(!show)} title="Şifreyi göster/gizle">{show ? '🙈' : '👁'}</button>
          </div>
        )}
        <button className="btn primary" disabled={busy}>
          {mode === 'in' ? 'Giriş yap' : mode === 'up' ? 'Hesap oluştur' : 'Sıfırlama bağlantısı gönder'}
        </button>
        {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
        <div className="login-links">
          {mode !== 'in' && <button type="button" className="linkbtn" onClick={() => setMode('in')}>Giriş yap</button>}
          {mode !== 'up' && <button type="button" className="linkbtn" onClick={() => setMode('up')}>Hesap oluştur</button>}
          {mode !== 'reset' && <button type="button" className="linkbtn" onClick={() => setMode('reset')}>Şifremi unuttum</button>}
        </div>
      </form>
    </div>
  );
}
