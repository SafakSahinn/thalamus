import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { calSettings } from '../lib/gcal';
import { listCalendars, type ExtCal } from '../lib/gcalFull';
import { authErrorText, grantFullCalendar, loadAuth } from '../lib/google';
import { saveSettings, useStore } from '../lib/store';

/** Ayarlar: diğer Google takvimlerini (ana takvim, CFP Calendar…) Thalamus Takvim sayfasına bağla */
export default function ExternalCalendars() {
  const settings = useStore((s) => s.settings);
  const selected = calSettings(settings).external ?? [];
  const [full, setFull] = useState<boolean | null>(null);
  const [cals, setCals] = useState<ExtCal[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setCals(await listCalendars());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void loadAuth().then((a) => {
      setFull(Boolean(a?.fullCalendar));
      if (a?.fullCalendar) void load();
    });
  }, []);

  const save = (external: string[]) => saveSettings({ ...useStore.getState().settings, calendar: { ...calSettings(), external } });

  const connect = async () => {
    setBusy(true);
    setMsg('');
    try {
      await grantFullCalendar();
      setFull(true);
      const list = await listCalendars();
      setCals(list);
      // İlk bağlanışta ana takvim seçili gelsin
      if (!selected.length) await save(list.filter((c) => c.primary).map((c) => c.id));
    } catch (e) {
      setMsg(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => void save(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="ext-cals">
      <div className="bm-h">{t('panels.extCals.title')}</div>
      {!full ? (
        <>
          <p className="muted small">{t.rich('panels.extCals.intro', { page: <b>{t('panels.extCals.page')}</b> })}</p>
          <button className="btn primary" disabled={busy} onClick={() => void connect()}>{busy ? t('panels.extCals.connecting') : t('panels.extCals.connect')}</button>
        </>
      ) : (
        <>
          <p className="muted small">{t('panels.extCals.shown')}</p>
          {!cals && !msg && <p className="muted small">{t('common.loading')}</p>}
          <div className="ext-cal-list">
            {cals?.map((c) => (
              <label key={c.id} className="small">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="ext-dot" style={{ background: c.color }} />
                <span>{c.summary}{c.primary ? t('panels.extCals.primary') : ''}{!c.writable ? t('panels.extCals.readOnly') : ''}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {msg && <p className="err small">{msg}</p>}
    </div>
  );
}
