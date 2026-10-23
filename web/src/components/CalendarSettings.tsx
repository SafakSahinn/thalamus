import { t } from '../i18n';
import { useEffect, useState } from 'react';
import ExternalCalendars from './ExternalCalendars';
import { getMeta } from '../lib/db';
import { relTime } from '../lib/format';
import { calSettings, dateFields, disconnectCalendar, syncCalendar } from '../lib/gcal';
import { authErrorText, grantCalendar, loadAuth } from '../lib/google';
import { saveSettings, useStore } from '../lib/store';

const REMINDER_OPTS = [0, 1, 3, 7, 14];

export default function CalendarSettings() {
  const settings = useStore((s) => s.settings);
  const cs = calSettings(settings);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [last, setLast] = useState<string | undefined>();

  useEffect(() => {
    void loadAuth().then((a) => setGranted(Boolean(a?.calendar)));
    void getMeta<string>('gcalLast').then(setLast);
  }, []);

  const save = (patch: Partial<typeof cs>) => saveSettings({ ...useStore.getState().settings, calendar: { ...calSettings(), ...patch } });
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg(authErrorText(e));
    } finally {
      setBusy(null);
      setLast(await getMeta<string>('gcalLast'));
    }
  };
  const syncNowMsg = async () => {
    const r = await syncCalendar();
    setMsg(t(r.pulled ? 'calendar.sync.donePulled' : 'calendar.sync.done', { created: r.created, updated: r.updated, deleted: r.deleted, pulled: r.pulled }));
  };

  const connect = () => run(t('calendar.sync.connecting'), async () => {
    await grantCalendar();
    setGranted(true);
    await save({ enabled: true });
    await syncNowMsg();
  });

  const toggleField = (id: string) => {
    const set = new Set(cs.fields);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    void save({ fields: [...set], ...(id === 'event.date' ? { eventOff: !set.has(id) } : {}) }).then(() => cs.enabled && void syncCalendar());
  };
  const toggleReminder = (d: number) => {
    const set = new Set(cs.reminders);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    void save({ reminders: [...set].sort((a, b) => a - b) }).then(() => cs.enabled && void syncCalendar(true));
  };

  return (
    <section data-tour="gcal">
      <h3>{t('calendar.sync.title')}</h3>
      <p className="muted small">{t.rich('calendar.sync.intro', { cal: <b>“Thalamus”</b> })}</p>
      {!granted || !cs.enabled ? (
        <div className="row">
          <button className="btn primary" disabled={Boolean(busy)} onClick={() => (granted ? void run(t('calendar.sync.opening'), async () => { await save({ enabled: true }); await syncNowMsg(); }) : void connect())}>
            {busy ?? (granted ? t('calendar.sync.enable') : t('calendar.sync.connect'))}
          </button>
          {!granted && <span className="muted small">{t('calendar.sync.permission')}</span>}
        </div>
      ) : (
        <>
          <div className="row">
            <span className="ok small">{t('calendar.sync.on')}</span>
            {last && <span className="muted small">{t('calendar.sync.lastSync', { time: relTime(last) })}</span>}
            <button className="btn small" disabled={Boolean(busy)} onClick={() => void run(t('calendar.sync.syncing'), syncNowMsg)}>{busy ?? t('calendar.sync.syncNow')}</button>
          </div>
          <div className="bm-h">{t('calendar.sync.which')}</div>
          <div className="cal-fields">
            {dateFields().map(({ type, fields }) => (
              <div key={type.id} className="cal-field-group">
                <b className="small">{type.icon} {type.plural}</b>
                {fields.map((f) => {
                  const id = `${type.id}.${f.key}`;
                  return (
                    <label key={id} className="small"><input type="checkbox" checked={cs.fields.includes(id)} onChange={() => toggleField(id)} /> <span>{f.label}</span></label>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="bm-h">{t('calendar.sync.reminder')}</div>
          <div className="row">
            {REMINDER_OPTS.map((d) => (
              <label key={d} className="small"><input type="checkbox" checked={cs.reminders.includes(d)} onChange={() => toggleReminder(d)} /> <span>{d === 0 ? t('calendar.sync.sameDay') : d === 7 ? t('calendar.sync.oneWeek') : d === 14 ? t('calendar.sync.twoWeeks') : t('calendar.sync.daysBefore', { count: d })}</span></label>
            ))}
          </div>
          <div className="row">
            <button className="btn small" disabled={Boolean(busy)} onClick={() => void run("…", () => disconnectCalendar(false))}>{t('calendar.sync.stop')}</button>
            <button className="btn small danger" disabled={Boolean(busy)} onClick={() => {
              if (confirm(t('calendar.sync.confirmDelete'))) void run(t('calendar.sync.deleting'), () => disconnectCalendar(true));
            }}>{t('calendar.sync.delete')}</button>
          </div>
        </>
      )}
      {msg && <p className="small">{msg}</p>}
      <ExternalCalendars />
    </section>
  );
}
