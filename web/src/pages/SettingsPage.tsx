import { useState } from 'react';
import CalendarSettings from '../components/CalendarSettings';
import { startTour } from '../components/Tour';
import { calSettings, disconnectCalendar } from '../lib/gcal';
import { SyncBadge } from '../components/Sidebar';
import { relTime } from '../lib/format';
import { cloud } from '../lib/google';
import {
  deleteAccount, getAttachMode, insertNotes, saveSettings, setAnnouncements, signOut, syncNow, uid, useStore,
  type AttachMode,
} from '../lib/store';
import { getCoverMode, type CoverMode } from '../lib/covers';
import { exportAllZip } from '../lib/exporter';
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

function Feedback() {
  return (
    <section>
      <h3>Geri bildirim</h3>
      <p className="muted small">Bir hata mı buldun, bir özellik mi istiyorsun? E-postayla yazabilir ya da GitHub’da kayıt açabilirsin.</p>
      <div className="row">
        <a className="btn" href="mailto:getthalamus@gmail.com?subject=Thalamus%20geri%20bildirim">✉ E-posta gönder</a>
        <a className="btn" href="https://github.com/SafakSahinn/thalamus/issues" target="_blank" rel="noopener noreferrer">GitHub’da kayıt aç ↗</a>
      </div>
    </section>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [drive, setDrive] = useState(false);
  const [cal, setCal] = useState(false);
  const hasCal = Boolean(calSettings(useStore((s) => s.settings)).calendarId);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      // Takvim, Google izni geri alınmadan önce silinmeli
      if (cal && hasCal) await disconnectCalendar(true);
      await deleteAccount(drive);
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
          <p>Kullanıcı kaydın (e-posta, ad, giriş zamanları) silinir, uygulamanın Google iznini geri alırız ve bütün cihazlarda oturumun kapanır.</p>
          <label className="small">
            <input type="checkbox" checked={drive} onChange={(e) => setDrive(e.target.checked)} />
            <span>Google Drive’ımdaki <b>Thalamus</b> klasörünü (bütün notlarım ve dosyalarım) de <b>kalıcı olarak</b> sil</span>
          </label>
          {hasCal && (
            <label className="small">
              <input type="checkbox" checked={cal} onChange={(e) => setCal(e.target.checked)} />
              <span>Google Takvim’imdeki <b>“Thalamus”</b> takvimini ve içindeki bütün etkinlikleri de sil</span>
            </label>
          )}
          {hasCal && !cal && <p className="muted small">Takvimdeki etkinlikler kalır; notun içeriği açıklamalarında okunmaya devam eder.</p>}
          {!drive && <p className="muted small">Notların Drive’ında kalır; istediğin zaman tekrar giriş yapıp kaldığın yerden devam edebilirsin.</p>}
          <p className="small">Onaylamak için e-posta adresini yaz: <b>{email}</b></p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
          <div className="row">
            <button className="btn" onClick={() => { setOpen(false); setTyped(""); }} disabled={busy}>Vazgeç</button>
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
  const account = useStore((s) => s.account);
  const announcements = useStore((s) => s.announcements);
  const [annErr, setAnnErr] = useState('');
  const [attach, setAttach] = useState<AttachMode>(getAttachMode());
  const [coverMode, setCoverMode] = useState<CoverMode>(getCoverMode());
  const sync = useStore((s) => s.sync);
  const notes = useStore((s) => s.notes);
  const settings = useStore((s) => s.settings);
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [msg, setMsg] = useState('');
  const [zipBusy, setZipBusy] = useState<string | null>(null);
  const exportZip = async () => {
    setZipBusy('Hazırlanıyor…');
    try {
      const r = await exportAllZip((d, t) => setZipBusy(`Hazırlanıyor… ${d}/${t}`));
      setMsg(`${r.notes} not ve ${r.assets} ek indirildi${r.missing ? ` (${r.missing} ek alınamadı)` : ''}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(null);
    }
  };

  const exportJson = () => {
    const data = { app: 'thalamus', version: 1, exported_at: new Date().toISOString(), settings, notes: Object.values(notes) };
    download(`thalamus-yedek-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
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
        if (!['thalamus', 'mind-atlas'].includes(data.app ?? '') || !Array.isArray(data.notes)) throw new Error('Bu dosya bir Thalamus yedeği değil.');
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
            <div className="account">
              {account?.picture && <img src={account.picture} alt="" width={36} height={36} referrerPolicy="no-referrer" />}
              <div>
                <div>{account?.name}</div>
                <div className="muted small">{account?.email}</div>
              </div>
            </div>
            <div className="row">
              <SyncBadge />
              {sync.last && <span className="muted small">son eşitleme {relTime(sync.last)}</span>}
              <button className="btn small" onClick={() => void syncNow()}>Şimdi eşitle</button>
            </div>
            {sync.error && <p className="err small">{sync.error}</p>}
            <p className="muted small">Notlar önce bu cihaza kaydedilir, internet varken birkaç saniye içinde Google Drive’ındaki <b>Thalamus</b> klasörüne gider. Diğer cihazların uygulamayı açtığında ya da yarım dakika içinde güncellenir. Çevrimdışıyken de yazabilirsin.</p>
            <div className="row">
              <button className="btn signout" onClick={() => void signOut()}>
                <span aria-hidden="true">⎋</span> Bu cihazda çıkış yap
              </button>
              <span className="muted small">Notların Drive’ında kalır; tekrar giriş yapınca geri gelir.</span>
            </div>
          </>
        ) : (
          <p className="muted">Bulut ayarlanmadı: notlar yalnızca bu tarayıcıda tutuluyor. Düzenli olarak yedek almayı unutma.</p>
        )}
      </section>

      {cloud && account && (
        <section>
          <h3>E-posta bildirimleri</h3>
          <label className="small">
            <input type="checkbox" checked={announcements} onChange={(e) => { setAnnErr(''); setAnnouncements(e.target.checked).catch((x: unknown) => setAnnErr(String(x))); }} />
            <span>Yenilikler hakkında ara sıra e-posta al</span>
          </label>
          <p className="muted small">{announcements ? 'Açık: yeni özellikler duyurulduğunda e-posta alırsın. Her e-postada abonelikten çıkma bağlantısı da olur.' : 'Kapalı: Thalamus sana duyuru e-postası göndermez.'}</p>
          {annErr && <p className="err small">{annErr}</p>}
        </section>
      )}

      {cloud && account && <CalendarSettings />}

      {cloud && (
        <section>
          <h3>Görsel ve PDF ekleri</h3>
          <div className="seg">
            {(['drive', 'local'] as AttachMode[]).map((m) => (
              <button key={m} className={attach === m ? 'on' : ''} onClick={() => { localStorage.setItem('attachMode', m); setAttach(m); }}>
                {m === 'drive' ? 'Drive’a yükle' : 'Sadece bu cihazda tut'}
              </button>
            ))}
          </div>
          <p className="muted small">
            {attach === 'drive'
              ? 'Ekler Drive’ına yüklenir ve bütün cihazlarında görünür.'
              : 'Ekler yalnızca bu cihazda saklanır: Drive’ında yer kaplamaz ama diğer cihazlarında görünmez ve bu tarayıcının verileri silinirse kaybolur.'}
            {' '}Bu ayar bu cihaza özeldir.
          </p>
        </section>
      )}

      <section>
        <h3>Kitap kapakları ve film afişleri</h3>
        <div className="seg">
          {(['save', 'link'] as CoverMode[]).map((m) => (
            <button key={m} className={coverMode === m ? 'on' : ''} onClick={() => { localStorage.setItem('coverMode', m); setCoverMode(m); }}>
              {m === 'save' ? 'Görseli kaydet' : 'Bağlantı olarak bırak'}
            </button>
          ))}
        </div>
        <p className="muted small">
          {coverMode === 'save'
            ? 'Kapak bulucuda seçtiğin görsel indirilir ve eklerinle aynı yere (Drive’ına ya da bu cihaza) kaydedilir; kaynak site kaldırsa bile kapak kaybolmaz.'
            : 'Seçtiğin görselin yalnızca bağlantısı saklanır: yer kaplamaz ama kaynak site görseli kaldırırsa kapak görünmez.'}
        </p>
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
        <p className="muted small">
          <b>Markdown (.zip):</b> her koleksiyon bir klasör, her not bir .md dosyası, ekler “ekler” klasöründe. Obsidian ya da başka bir uygulamada doğrudan açılabilir.
          <br /><b>Yedek (.json):</b> Thalamus’a geri yüklemek için tek dosya.
        </p>
        <div className="row">
          <button className="btn" onClick={() => void exportZip()} disabled={Boolean(zipBusy)}>{zipBusy ?? 'Markdown olarak indir (.zip)'}</button>
          <button className="btn" onClick={exportJson}>Yedeği indir (.json)</button>
          <button className="btn" onClick={importJson}>Yedekten geri yükle</button>
          <a className="btn" href="#/import">Notion’dan aktar</a>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>

      <section>
        <h3>Tanıtım turu</h3>
        <p className="muted small">Uygulamanın düğmelerini adım adım birlikte deneyen kısa tur.</p>
        <button className="btn" onClick={() => { location.hash = '#/'; startTour(); }}>▶ Turu başlat</button>
      </section>

      <Feedback />

      {cloud && account && <DeleteAccount email={account.email} />}

      <p className="muted small"><a href="privacy.html">Gizlilik ve KVKK</a> · <a href="terms.html">Kullanım Koşulları</a></p>

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
