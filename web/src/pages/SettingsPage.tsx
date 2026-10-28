import { useState } from 'react';
import { detectLocale, getLocalePref, LOCALE_IDS, LOCALES, setLocalePref, t, type LocalePref } from '../i18n';
import CalendarSettings from '../components/CalendarSettings';
import { HomeSettings } from './Home';
import NotifySettings from '../components/NotifySettings';
import ClipperSettings from '../components/ClipperSettings';
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
import { useInstalled } from '../lib/plugins';
import MeterSettings from '../components/meter/MeterSettings';
import ClockSettings from '../components/clock/ClockSettings';
import WallpaperPicker from '../components/WallpaperPicker';
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
          <button className="iconbtn" title={t('settings.routines.deleteTitle')} onClick={() => save(list.filter((x) => x.id !== r.id))}>×</button>
        </div>
      ))}
      <div className="row">
        <input className="emoji" value={icon} onChange={(e) => setIcon(e.target.value)} />
        <input className="grow" value={label} placeholder={t('settings.routines.placeholder')} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && label.trim() && (save([...list, { id: uid(), label: label.trim(), icon }]), setLabel(''))} />
        <button className="btn small" disabled={!label.trim()} onClick={() => { save([...list, { id: uid(), label: label.trim(), icon }]); setLabel(''); }}>{t('common.add')}</button>
      </div>
    </div>
  );
}

function Feedback() {
  return (
    <section>
      <h3>{t('settings.feedback.title')}</h3>
      <p className="muted small">{t('settings.feedback.hint')}</p>
      <div className="row">
        <a className="btn" href={`mailto:getthalamus@gmail.com?subject=${encodeURIComponent(t('settings.feedback.mailSubject'))}`}>{t('settings.feedback.email')}</a>
        <a className="btn" href="https://github.com/SafakSahinn/thalamus/issues" target="_blank" rel="noopener noreferrer">{t('settings.feedback.github')}</a>
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
      <h3>{t('settings.deleteAccount.title')}</h3>
      {!open ? (
        <button className="btn danger" onClick={() => setOpen(true)}>{t('settings.deleteAccount.open')}</button>
      ) : (
        <div className="danger-box">
          <p>{t('settings.deleteAccount.intro')}</p>
          <label className="small">
            <input type="checkbox" checked={drive} onChange={(e) => setDrive(e.target.checked)} />
            <span>{t.rich('settings.deleteAccount.drive', { folder: <b>Thalamus</b>, perm: <b>{t('settings.deleteAccount.permanently')}</b> })}</span>
          </label>
          {hasCal && (
            <label className="small">
              <input type="checkbox" checked={cal} onChange={(e) => setCal(e.target.checked)} />
              <span>{t.rich('settings.deleteAccount.calendar', { cal: <b>“Thalamus”</b> })}</span>
            </label>
          )}
          {hasCal && !cal && <p className="muted small">{t('settings.deleteAccount.calKept')}</p>}
          {!drive && <p className="muted small">{t('settings.deleteAccount.driveKept')}</p>}
          <p className="small">{t.rich('settings.deleteAccount.confirm', { email: <b>{email}</b> })}</p>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
          <div className="row">
            <button className="btn" onClick={() => { setOpen(false); setTyped(""); }} disabled={busy}>{t('common.cancel')}</button>
            <button className="btn danger" disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()} onClick={() => void run()}>
              {busy ? t('settings.deleteAccount.deleting') : t('settings.deleteAccount.submit')}
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
  const [lang, setLang] = useState<LocalePref>(getLocalePref());
  const sticky = useInstalled('sticky');
  const meter = useInstalled('drivemeter');
  const clock = useInstalled('clock');
  const wallpaper = useInstalled('wallpaper');
  const [msg, setMsg] = useState('');
  const [zipBusy, setZipBusy] = useState<string | null>(null);
  const exportZip = async () => {
    setZipBusy(t('settings.zip.preparing'));
    try {
      const r = await exportAllZip((done, total) => setZipBusy(t('settings.zip.progress', { done, total })));
      setMsg(t(r.missing ? 'settings.zip.doneMissing' : 'settings.zip.done', { notes: r.notes, assets: r.assets, missing: r.missing }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(null);
    }
  };

  const exportJson = () => {
    const data = { app: 'thalamus', version: 1, exported_at: new Date().toISOString(), settings, notes: Object.values(notes) };
    download(t('settings.backupFile', { date: new Date().toISOString().slice(0, 10) }), JSON.stringify(data));
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
        if (!['thalamus', 'mind-atlas'].includes(data.app ?? '') || !Array.isArray(data.notes)) throw new Error(t('settings.notBackup'));
        const cur = useStore.getState().notes;
        const fresh = data.notes.filter((n) => !cur[n.id] || cur[n.id].updated_at < n.updated_at);
        insertNotes(fresh);
        setMsg(t('settings.restored', { count: fresh.length, skipped: data.notes.length - fresh.length }));
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      }
    };
    input.click();
  };

  return (
    <div className="page settings">
      <h1>{t('settings.title')}</h1>

      <section>
        <h3>{t('settings.account.title')}</h3>
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
              {sync.last && <span className="muted small">{t('settings.account.lastSync', { time: relTime(sync.last) })}</span>}
              <button className="btn small" onClick={() => void syncNow()}>{t('settings.account.syncNow')}</button>
            </div>
            {sync.error && <p className="err small">{sync.error}</p>}
            <p className="muted small">{t.rich('settings.account.info', { folder: <b>Thalamus</b> })}</p>
            <div className="row">
              <button className="btn signout" onClick={() => void signOut()}>
                <span aria-hidden="true">⎋</span> {t('settings.account.signOut')}
              </button>
              <span className="muted small">{t('settings.account.signOutHint')}</span>
            </div>
          </>
        ) : (
          <p className="muted">{t('settings.account.noCloud')}</p>
        )}
      </section>

      {cloud && account && (
        <section>
          <h3>{t('settings.emails.title')}</h3>
          <label className="small">
            <input type="checkbox" checked={announcements} onChange={(e) => { setAnnErr(''); setAnnouncements(e.target.checked).catch((x: unknown) => setAnnErr(String(x))); }} />
            <span>{t('settings.emails.label')}</span>
          </label>
          <p className="muted small">{announcements ? t('settings.emails.on') : t('settings.emails.off')}</p>
          {annErr && <p className="err small">{annErr}</p>}
        </section>
      )}

      {cloud && account && <CalendarSettings />}

      <NotifySettings />

      <ClipperSettings />

      {cloud && (
        <section>
          <h3>{t('settings.attach.title')}</h3>
          <div className="seg">
            {(['drive', 'local'] as AttachMode[]).map((m) => (
              <button key={m} className={attach === m ? 'on' : ''} onClick={() => { localStorage.setItem('attachMode', m); setAttach(m); }}>
                {m === 'drive' ? t('settings.attach.drive') : t('settings.attach.local')}
              </button>
            ))}
          </div>
          <p className="muted small">
            {attach === 'drive' ? t('settings.attach.driveHint') : t('settings.attach.localHint')}
            {' '}{t('settings.attach.deviceOnly')}
          </p>
        </section>
      )}

      <section>
        <h3>{t('settings.covers.title')}</h3>
        <div className="seg">
          {(['save', 'link'] as CoverMode[]).map((m) => (
            <button key={m} className={coverMode === m ? 'on' : ''} onClick={() => { localStorage.setItem('coverMode', m); setCoverMode(m); }}>
              {m === 'save' ? t('settings.covers.save') : t('settings.covers.link')}
            </button>
          ))}
        </div>
        <p className="muted small">{coverMode === 'save' ? t('settings.covers.saveHint') : t('settings.covers.linkHint')}</p>
      </section>

      <section>
        <h3>{t('settings.routines.title')}</h3>
        <p className="muted small">{t('settings.routines.hint')}</p>
        <Routines />
      </section>

      <section>
        <h3>{t('settings.home.title')}</h3>
        <p className="muted small">{t('settings.home.hint')}</p>
        <HomeSettings />
      </section>

      {sticky && <section>
        <h3>{t('settings.sticky.title')}</h3>
        <p className="muted small">{t('settings.sticky.hint')}</p>
        <div className="seg">
          {(['all', 'home'] as const).map((v) => (
            <button key={v} className={(settings.stickyScope ?? 'all') === v ? 'on' : ''}
              onClick={() => void saveSettings({ ...useStore.getState().settings, stickyScope: v })}>{t(`settings.sticky.${v}`)}</button>
          ))}
        </div>
        <p className="muted small">{t('settings.sticky.fixedHint')}</p>
        <div className="seg">
          {([true, false] as const).map((v) => (
            <button key={String(v)} className={(settings.stickyFixed ?? true) === v ? 'on' : ''}
              onClick={() => void saveSettings({ ...useStore.getState().settings, stickyFixed: v })}>{t(v ? 'settings.sticky.fixedOn' : 'settings.sticky.fixedOff')}</button>
          ))}
        </div>
      </section>}

      {meter && <section>
        <h3>{t('meter.title')}</h3>
        <p className="muted small">{t('meter.settings.hint')}</p>
        <MeterSettings />
      </section>}

      {clock && <section>
        <h3>{t('clock.title')}</h3>
        <p className="muted small">{t('clock.settings.hint')}</p>
        <ClockSettings />
      </section>}

      <section>
        <h3>{t('settings.appearance.title')}</h3>
        <div className="seg">
          {(['system', 'light', 'dark'] as Theme[]).map((th) => (
            <button key={th} className={theme === th ? 'on' : ''} onClick={() => { applyTheme(th); setTheme(th); }}>
              {t(`settings.appearance.${th}`)}
            </button>
          ))}
        </div>
        {wallpaper && <>
          <p className="muted small">{t('settings.wallpaper.hint')}</p>
          <WallpaperPicker />
        </>}
      </section>

      <section>
        <h3>{t('settings.language.title')}</h3>
        <div className="seg">
          {(['system', ...LOCALE_IDS] as LocalePref[]).map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => { setLang(l); void setLocalePref(l); }}>
              {l === 'system' ? t('settings.language.system', { lang: LOCALES[detectLocale()].name }) : LOCALES[l].name}
            </button>
          ))}
        </div>
        <p className="muted small">{t('settings.language.hint')}</p>
      </section>

      <section>
        <h3>{t('settings.backup.title')}</h3>
        <p className="muted small">
          <b>{t('settings.backup.zipLabel')}</b> {t('settings.backup.zipInfo')}
          <br /><b>{t('settings.backup.jsonLabel')}</b> {t('settings.backup.jsonInfo')}
        </p>
        <div className="row">
          <button className="btn" onClick={() => void exportZip()} disabled={Boolean(zipBusy)}>{zipBusy ?? t('settings.backup.zip')}</button>
          <button className="btn" onClick={exportJson}>{t('settings.backup.json')}</button>
          <button className="btn" onClick={importJson}>{t('settings.backup.restore')}</button>
          <a className="btn" href="#/import">{t('settings.backup.import')}</a>
        </div>
        {msg && <p className="small">{msg}</p>}
      </section>

      <section>
        <h3>{t('settings.tour.title')}</h3>
        <p className="muted small">{t('settings.tour.hint')}</p>
        <button className="btn" onClick={() => { location.hash = '#/'; startTour(); }}>{t('settings.tour.start')}</button>
      </section>

      <Feedback />

      {cloud && account && <DeleteAccount email={account.email} />}

      <p className="muted small"><a href="privacy.html">{t('settings.privacy')}</a> · <a href="terms.html">{t('settings.terms')}</a></p>

      <section>
        <h3>{t('settings.install.title')}</h3>
        <ul className="muted small">
          <li><b>{t('settings.install.iosLabel')}</b> {t('settings.install.ios')}</li>
          <li><b>{t('settings.install.androidLabel')}</b> {t('settings.install.android')}</li>
          <li><b>{t('settings.install.desktopLabel')}</b> {t('settings.install.desktop')}</li>
        </ul>
      </section>
    </div>
  );
}
