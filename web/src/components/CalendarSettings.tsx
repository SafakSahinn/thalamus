import { useEffect, useState } from 'react';
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
    setMsg(`Takvim eşitlendi: ${r.created} yeni, ${r.updated} güncellenen, ${r.deleted} silinen etkinlik.`);
  };

  const connect = () => run('Bağlanıyor…', async () => {
    await grantCalendar();
    setGranted(true);
    await save({ enabled: true });
    await syncNowMsg();
  });

  const toggleField = (id: string) => {
    const set = new Set(cs.fields);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    void save({ fields: [...set] }).then(() => cs.enabled && void syncCalendar());
  };
  const toggleReminder = (d: number) => {
    const set = new Set(cs.reminders);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    void save({ reminders: [...set].sort((a, b) => a - b) }).then(() => cs.enabled && void syncCalendar(true));
  };

  return (
    <section>
      <h3>Google Takvim eşitlemesi</h3>
      <p className="muted small">
        Seçtiğin tarih alanları Google Takvim’inde <b>“Thalamus”</b> adlı ayrı bir takvimde etkinlik olur. Tarihi değiştirince etkinlik
        güncellenir, notu ya da tarihi silince etkinlik de silinir. Thalamus yalnızca bu takvime erişebilir, diğer takvimlerini göremez.
      </p>
      {!granted || !cs.enabled ? (
        <div className="row">
          <button className="btn primary" disabled={Boolean(busy)} onClick={() => (granted ? void run('Açılıyor…', async () => { await save({ enabled: true }); await syncNowMsg(); }) : void connect())}>
            {busy ?? (granted ? 'Eşitlemeyi aç' : '📅 Google Takvim’i bağla')}
          </button>
          {!granted && <span className="muted small">Google senden yalnızca bu uygulamanın oluşturduğu takvimi yönetme izni ister.</span>}
        </div>
      ) : (
        <>
          <div className="row">
            <span className="ok small">● Açık</span>
            {last && <span className="muted small">son eşitleme {relTime(last)}</span>}
            <button className="btn small" disabled={Boolean(busy)} onClick={() => void run('Eşitleniyor…', syncNowMsg)}>{busy ?? 'Şimdi eşitle'}</button>
          </div>
          <div className="bm-h">Hangi tarihler takvime gitsin?</div>
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
          <div className="bm-h">Hatırlatma (sabah 09:00)</div>
          <div className="row">
            {REMINDER_OPTS.map((d) => (
              <label key={d} className="small"><input type="checkbox" checked={cs.reminders.includes(d)} onChange={() => toggleReminder(d)} /> <span>{d === 0 ? 'O gün' : d === 7 ? '1 hafta önce' : d === 14 ? '2 hafta önce' : `${d} gün önce`}</span></label>
            ))}
          </div>
          <div className="row">
            <button className="btn ghost small" disabled={Boolean(busy)} onClick={() => void run('…', () => disconnectCalendar(false))}>Eşitlemeyi durdur</button>
            <button className="btn ghost small danger" disabled={Boolean(busy)} onClick={() => {
              if (confirm('Google Takvim’deki “Thalamus” takvimi ve içindeki bütün etkinlikler silinsin mi? Notların etkilenmez.')) void run('Siliniyor…', () => disconnectCalendar(true));
            }}>Thalamus takvimini sil</button>
          </div>
        </>
      )}
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
