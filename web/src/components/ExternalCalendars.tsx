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
      <div className="bm-h">Diğer Google takvimlerim</div>
      {!full ? (
        <>
          <p className="muted small">
            Ana takvimin, CFP Calendar’ın eklediği konferanslar, ders programın… hepsi Thalamus’un <b>Takvim</b> sayfasında görünsün;
            oradan taşıyabil, düzenleyebil, silebil ve yeni etkinlik ekleyebil. Bunun için Google senden bütün takvimlerini görme ve
            düzenleme izni ister. Takvim verilerin sunucumuza gelmez; tarayıcın doğrudan Google’la konuşur.
          </p>
          <button className="btn" disabled={busy} onClick={() => void connect()}>{busy ? 'Bağlanıyor…' : '🗓 Bütün takvimlerimi bağla'}</button>
        </>
      ) : (
        <>
          <p className="muted small">Takvim sayfasında gösterilecek takvimler:</p>
          {!cals && !msg && <p className="muted small">Yükleniyor…</p>}
          <div className="ext-cal-list">
            {cals?.map((c) => (
              <label key={c.id} className="small">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="ext-dot" style={{ background: c.color }} />
                <span>{c.summary}{c.primary ? ' (ana takvim)' : ''}{!c.writable ? ' · salt okunur' : ''}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {msg && <p className="err small">{msg}</p>}
    </div>
  );
}
