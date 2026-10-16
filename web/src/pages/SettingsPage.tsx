import { useState } from 'react';
import { SyncBadge } from '../components/Sidebar';
import { relTime } from '../lib/format';
import { deleteAccount, insertNotes, saveSettings, signOut, syncNow, uid, useStore } from '../lib/store';
import { cloud } from '../lib/supabase';
import { applyTheme, getTheme, type Theme } from '../lib/theme';
import type { Note, Routine } from '../lib/types';

function Routines() {
  const settings = useStore((s) => s.settings);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('✅');
  const save = (routines: Routine[]) => void saveSettings({ ...settings, routines });
  const list = settings.routines;
  const move = (i: number, d: number) => {
    const r = [...list];
    const [x] = r.splice(i, 1);
    r.splice(i + d, 0, x);
    save(r);
  };
  return (
    <div className="routine-edit">
      {list.map((r, i) => (
        <div key={r.id} className="row">
          <input className="emoji" defaultValue={r.icon} onBlur={(e) => save(list.map((x) => (x.id === r.id ? { ...x, icon: e.target.value } : x)))} />
          <input className="grow" defaultValue={r.label} onBlur={(e) => save(list.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))} />
          <button className="iconbtn" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
          <button className="iconbtn" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
          <button className="iconbtn" title="Sil (geçmiş işaretler günlüklerde kalır)" onClick={() => save(list.filter((x) => x.id !== r.id))}>×</button>
        </div>
      ))}
      <div className="row">
        <input className="emoji" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <input className="grow" value={label} placeholder="Yeni rutin (ör. 30 dk İngilizce)" onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && label.trim() && (save([...list, { id: uid(), label: label.trim(), icon }]), setLabel(''))} />
        <button className="btn small" disabled={!label.trim()} onClick={() => { save([...list, { id: uid(), label: label.trim(), icon }]); setLabel(''); }}>Ekle</button>
      </div>
    </div>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      await deleteAccount();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <section>
      <h3>Hesabı sil</h3>
      {!open ? (
        <button className="btn danger" onClick={() => setOpen(true)}>Hesabımı sil…</button>
      ) : (
        <div className="danger-box">
          <p>Hesabın, bütün notların, yüklediğin dosyalar ve ayarların <b>kalıcı olarak</b> silinir. Bu geri alınamaz. İstersen önce yukarıdan yedeğini indir.</p>
          <p className="small">Onaylamak için e-posta adresini yaz: <b>{email}</b></p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
          <div className="row">
            <button className="btn ghost" onClick={() => { setOpen(false); setTyped(''); }} disabled={busy}>Vazgeç</button>
            <button className="btn danger" disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()} onClick={() => void run()}>
              {busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}
            </button>
          </div>
          {err && <p className="err small">{err}</p>}
        </div>
      )}
    </section>
  );
}

function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function SettingsPage() {
  const session = useStore((s) => s.session);
  const sync = useStore((s) => s.sync);
  const notes = useStore((s) => s.notes);
  const settings = useStore((s) => s.settings);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [msg, setMsg] = useState('');

  const exportJson = () => {
    const data = { app: 'mind-atlas', version: 1, exported_at: new Date().toISOString(), settings, notes: Object.values(notes) };
    download(`zihin-atlasi-yedek-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
  };

  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text()) as { app?: string; notes?: Note[] };
        if (data.app !== 'mind-atlas' || !Array.isArray(data.notes)) throw new Error('Bu dosya bir Zihin Atlası yedeği değil.');
        const cur = useStore.getState().notes;
        const fresh = data.notes.filter((n) => !cur[n.id] || cur[n.id].updated_at < n.updated_at);
        insertNotes(fresh);
        setMsg(`${fresh.length} not geri yüklendi (${data.notes.length - fresh.length} tanesi zaten güncel).`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    };
    input.click();
  };

  return (
    <div className="page settings">
      <h1>⚙ Ayarlar</h1>

      <section>
        <h3>Hesap ve eşitleme</h3>
        {cloud ? (
          <>
            <p>{session?.user.email}</p>
            <div className="row">
              <SyncBadge />
              {sync.last && <span className="muted small">son eşitleme {relTime(sync.last)}</span>}
              <button className="btn small" onClick={() => void syncNow()}>Şimdi eşitle</button>
            </div>
            {sync.error && <p className="err small">{sync.error}</p>}
            <p className="muted small">Notlar önce bu cihaza kaydedilir, internet varken birkaç saniye içinde buluta ve diğer cihazlarına gider. Çevrimdışıyken de yazabilirsin.</p>
            <button className="btn ghost" onClick={() => void signOut()}>Çıkış yap</button>
          </>
        ) : (
          <p className="muted">Bulut ayarlanmadı: notlar yalnızca bu tarayıcıda tutuluyor. Düzenli olarak yedek almayı unutma.</p>
        )}
      </section>

      <section>
        <h3>Günlük rutinler</h3>
        <p className="muted small">Her gün Günlük sayfasında ve ana sayfada işaretleyeceğin alışkanlıklar.</p>
        <Routines />
      </section>

      <section>
        <h3>Görünüm</h3>
        <div className="seg">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => { applyTheme(t); setTheme(t); }}>
              {t === 'system' ? 'Sistem' : t === 'light' ? 'Açık' : 'Koyu'}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Yedek</h3>
        <p className="muted small">Tüm notların tek bir JSON dosyası olarak. Bulut eşitlemesine ek güvence.</p>
        <div className="row">
          <button className="btn" onClick={exportJson}>Yedeği indir</button>
          <button className="btn ghost" onClick={importJson}>Yedekten geri yükle</button>
          <a className="btn ghost" href="#/import">Notion’dan aktar</a>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>

      {cloud && session && <DeleteAccount email={session.user.email ?? ''} />}

      <p className="muted small"><a href="#/gizlilik">Gizlilik ve KVKK</a> · <a href="#/kosullar">Kullanım Koşulları</a></p>

      <section>
        <h3>Uygulama olarak yükle</h3>
        <ul className="muted small">
          <li><b>iPhone / iPad:</b> Safari’de aç → Paylaş → “Ana Ekrana Ekle”.</li>
          <li><b>Android:</b> Chrome menüsü → “Uygulamayı yükle”.</li>
          <li><b>Bilgisayar:</b> Chrome/Edge adres çubuğundaki yükle simgesi (⊕).</li>
        </ul>
      </section>
    </div>
  );
}
