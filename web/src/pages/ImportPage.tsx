import { useState } from 'react';
import { norm } from '../lib/links';
import { buildNotes, guessColumn, guessType, inferKind, readNotionZip, type DbMapping, type Parsed } from '../lib/notionImport';
import { addProp } from '../lib/schema';
import { insertNotes, saveSettings, syncNow, uploadFile, useIndex, useStore } from '../lib/store';
import { TYPES, TYPE_MAP, type TypeId } from '../lib/types';
import MarkdownImport from './MarkdownImport';

export default function ImportPage() {
  const { alive } = useIndex();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [maps, setMaps] = useState<Record<string, DbMapping>>({});
  const [pageType, setPageType] = useState<TypeId>('note');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    setResult(null);
    setBusy('Zip dosyası okunuyor…');
    try {
      const p = await readNotionZip(f);
      if (!p.pages.length && !p.databases.length) throw new Error('Zip içinde Notion sayfası (.md) veya veritabanı (.csv) bulunamadı. Dışa aktarma biçiminin “Markdown & CSV” olduğundan emin ol.');
      const m: Record<string, DbMapping> = {};
      for (const db of p.databases) {
        const type = guessType(db.name);
        m[db.key] = { type, columns: guessColumns(db.columns.filter((c) => c !== db.titleColumn), type, db.rows) };
      }
      setParsed(p);
      setMaps(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const setType = (key: string, type: TypeId) => {
    const db = parsed!.databases.find((d) => d.key === key)!;
    setMaps({ ...maps, [key]: { type, columns: guessColumns(db.columns.filter((c) => c !== db.titleColumn), type, db.rows) } });
  };

  const run = async () => {
    if (!parsed) return;
    setBusy('Hazırlanıyor…');
    setErr(null);
    try {
      // "Yeni alan" seçilen sütunlar için koleksiyona alan ekle (tür değerlerden tahmin edilir)
      const mappings: Record<string, DbMapping> = structuredClone(maps);
      for (const db of parsed.databases) {
        const m = mappings[db.key];
        for (const [col, target] of Object.entries(m.columns)) {
          if (target !== 'new') continue;
          setBusy(`"${col}" alanı oluşturuluyor…`);
          m.columns[col] = await addProp(m.type, { label: col, table: true, ...inferKind(db.rows.map((r) => r[col] ?? '')) });
        }
      }
      const res = await buildNotes(parsed, {
        mappings,
        pageType,
        existing: alive,
        upload: uploadFile,
        onProgress: (d, t) => setBusy(`Dönüştürülüyor… ${d}/${t}`),
      });
      insertNotes(res.notes);
      if (res.routines.length) {
        const s = useStore.getState().settings;
        const have = new Set(s.routines.map((r) => r.id));
        const add = res.routines.filter((r) => !have.has(`notion:${norm(r)}`)).map((r) => ({ id: `notion:${norm(r)}`, label: r, icon: '✅' }));
        if (add.length) await saveSettings({ ...s, routines: [...s.routines, ...add] });
      }
      void syncNow();
      setResult(`${res.notes.length} not aktarıldı${res.skipped ? `, daha önce aktarılmış ${res.skipped} sayfa atlandı` : ''}.`);
      setParsed(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const standalone = parsed?.pages.filter((p) => !p.dbKey).length ?? 0;

  return (
    <div className="page wide import">
      <h1>⬇ İçe aktar</h1>
      <h2 className="import-h">Notion</h2>
      {!parsed && (
        <>
          <ol className="steps">
            <li>Notion’da sol menüden <b>Settings</b> → <b>Workspace</b> → <b>Export all workspace content</b> (veya tek bir sayfada ⋯ → <b>Export</b>).</li>
            <li>Export format: <b>Markdown &amp; CSV</b> · Include content: <b>Everything</b> · <b>Include subpages</b> açık · <b>Create folders for subpages</b> açık.</li>
            <li>İnen <b>.zip</b> dosyasını (açmadan) aşağıdan seç.</li>
          </ol>
          <label className="dropzone">
            <input type="file" accept=".zip,application/zip" onChange={(e) => void pick(e.target.files?.[0])} hidden />
            {busy ?? 'Notion .zip dosyasını seç'}
          </label>
          <p className="muted small">Aynı dışa aktarımı tekrar yüklersen daha önce aktarılan sayfalar atlanır. Görseller ayarlarındaki ek seçeneğine göre Drive’ına ya da yalnızca bu cihaza kaydedilir.</p>
        </>
      )}
      {result && <div className="banner ok">{result} <a href="#/graph">Haritada gör →</a></div>}
      {err && <div className="banner warn">{err}</div>}

      {parsed && (
        <>
          <p>Bulunan: <b>{parsed.databases.length}</b> veritabanı, <b>{parsed.pages.length}</b> sayfa, <b>{parsed.assets.size}</b> dosya.</p>
          {parsed.databases.map((db) => {
            const m = maps[db.key];
            const props = TYPE_MAP[m.type].props.filter((p) => !p.back);
            return (
              <section key={db.key} className="dbmap">
                <div className="row">
                  <h3>🗂 {db.name} <span className="count">{db.rows.length}</span></h3>
                  <span className="spacer" />
                  <span className="muted small">aktarılacağı tip:</span>
                  <select value={m.type} onChange={(e) => setType(db.key, e.target.value as TypeId)}>
                    {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <table className="maptable">
                  <thead><tr><th>Notion sütunu</th><th>Örnek</th><th>Thalamus alanı</th></tr></thead>
                  <tbody>
                    <tr><td>{db.titleColumn}</td><td className="muted clip">{db.rows[0]?.[db.titleColumn]}</td><td><b>Başlık</b></td></tr>
                    {Object.entries(m.columns).map(([col, target]) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td className="muted clip">{db.rows.find((r) => r[col])?.[col] ?? ''}</td>
                        <td>
                          <select value={target} onChange={(e) => setMaps({ ...maps, [db.key]: { ...m, columns: { ...m.columns, [col]: e.target.value } } })}>
                            {props.map((p) => <option key={p.key} value={p.key}>{p.label}{p.kind === 'relation' ? ' (bağlantı)' : ''}</option>)}
                            {m.type === 'daily' && <option value="routine">Rutin (işaret kutusu)</option>}
                            <option value="new">＋ Yeni alan olarak ekle</option>
                            <option value="extra">Ek bilgi olarak sakla</option>
                            <option value="skip">Aktarma</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
          {standalone > 0 && (
            <section className="dbmap">
              <div className="row">
                <h3>📄 Veritabanı dışındaki sayfalar <span className="count">{standalone}</span></h3>
                <span className="spacer" />
                <select value={pageType} onChange={(e) => setPageType(e.target.value as TypeId)}>
                  {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                </select>
              </div>
            </section>
          )}
          <p className="muted small">Bağlantı alanlarına (ör. Yazar, Konular) eşlenen sütunlardaki adlar ayrı notlar olarak oluşturulur ve haritada birbirine bağlanır. Sayfalar arasındaki Notion bağlantıları <code>[[ ]]</code> bağlantısına çevrilir.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setParsed(null)} disabled={Boolean(busy)}>Vazgeç</button>
            <button className="btn primary" onClick={() => void run()} disabled={Boolean(busy)}>{busy ?? 'İçe aktar'}</button>
          </div>
        </>
      )}

      <MarkdownImport />
    </div>
  );
}

function guessColumns(cols: string[], type: TypeId, rows: Record<string, string>[]) {
  const used = new Set<string>();
  const out: Record<string, string> = {};
  for (const c of cols) {
    let g = guessColumn(c, type, rows.map((r) => r[c] ?? '').slice(0, 30));
    if (g !== 'extra' && g !== 'new' && g !== 'routine' && used.has(g)) g = 'new';
    used.add(g);
    out[c] = g;
  }
  return out;
}
