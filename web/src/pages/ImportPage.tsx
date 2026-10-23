import { t } from '../i18n';
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
    setBusy(t('importer.notion.reading'));
    try {
      const p = await readNotionZip(f);
      if (!p.pages.length && !p.databases.length) throw new Error(t('importer.notion.empty'));
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
    setBusy(t('importer.notion.preparing'));
    setErr(null);
    try {
      // "Yeni alan" seçilen sütunlar için koleksiyona alan ekle (tür değerlerden tahmin edilir)
      const mappings: Record<string, DbMapping> = structuredClone(maps);
      for (const db of parsed.databases) {
        const m = mappings[db.key];
        for (const [col, target] of Object.entries(m.columns)) {
          if (target !== 'new') continue;
          setBusy(t('importer.notion.creatingField', { col }));
          m.columns[col] = await addProp(m.type, { label: col, table: true, ...inferKind(db.rows.map((r) => r[col] ?? '')) });
        }
      }
      const res = await buildNotes(parsed, {
        mappings,
        pageType,
        existing: alive,
        upload: uploadFile,
        onProgress: (done, total) => setBusy(t('importer.notion.converting', { done, total })),
      });
      insertNotes(res.notes);
      if (res.routines.length) {
        const s = useStore.getState().settings;
        const have = new Set(s.routines.map((r) => r.id));
        const add = res.routines.filter((r) => !have.has(`notion:${norm(r)}`)).map((r) => ({ id: `notion:${norm(r)}`, label: r, icon: '✅' }));
        if (add.length) await saveSettings({ ...s, routines: [...s.routines, ...add] });
      }
      void syncNow();
      setResult(t(res.skipped ? 'importer.notion.doneSkipped' : 'importer.notion.done', { count: res.notes.length, skipped: res.skipped }));
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
      <h1>{t('importer.notion.title')}</h1>
      <h2 className="import-h">Notion</h2>
      {!parsed && (
        <>
          <ol className="steps">
            <li>{t.rich('importer.notion.step1', { settings: <b>Settings</b>, workspace: <b>Workspace</b>, exportAll: <b>Export all workspace content</b>, export: <b>Export</b> })}</li>
            <li>{t.rich('importer.notion.step2', { format: <b>Markdown &amp; CSV</b>, everything: <b>Everything</b>, subpages: <b>Include subpages</b>, folders: <b>Create folders for subpages</b> })}</li>
            <li>{t.rich('importer.notion.step3', { zip: <b>.zip</b> })}</li>
          </ol>
          <label className="dropzone">
            <input type="file" accept=".zip,application/zip" onChange={(e) => void pick(e.target.files?.[0])} hidden />
            {busy ?? t('importer.notion.pick')}
          </label>
          <p className="muted small">{t('importer.notion.hint')}</p>
        </>
      )}
      {result && <div className="banner ok">{result} <a href="#/graph">{t('importer.notion.seeMap')}</a></div>}
      {err && <div className="banner warn">{err}</div>}

      {parsed && (
        <>
          <p>{t.rich('importer.notion.found', { dbs: <b>{parsed.databases.length}</b>, pages: <b>{parsed.pages.length}</b>, files: <b>{parsed.assets.size}</b> })}</p>
          {parsed.databases.map((db) => {
            const m = maps[db.key];
            const props = TYPE_MAP[m.type].props.filter((p) => !p.back);
            return (
              <section key={db.key} className="dbmap">
                <div className="row">
                  <h3>🗂 {db.name} <span className="count">{db.rows.length}</span></h3>
                  <span className="spacer" />
                  <span className="muted small">{t('importer.notion.targetType')}</span>
                  <select value={m.type} onChange={(e) => setType(db.key, e.target.value as TypeId)}>
                    {TYPES.map((ty) => <option key={ty.id} value={ty.id}>{ty.icon} {ty.label}</option>)}
                  </select>
                </div>
                <table className="maptable">
                  <thead><tr><th>{t('importer.notion.colNotion')}</th><th>{t('importer.notion.colExample')}</th><th>{t('importer.notion.colField')}</th></tr></thead>
                  <tbody>
                    <tr><td>{db.titleColumn}</td><td className="muted clip">{db.rows[0]?.[db.titleColumn]}</td><td><b>{t('importer.notion.titleField')}</b></td></tr>
                    {Object.entries(m.columns).map(([col, target]) => (
                      <tr key={col}>
                        <td>{col}</td>
                        <td className="muted clip">{db.rows.find((r) => r[col])?.[col] ?? ''}</td>
                        <td>
                          <select value={target} onChange={(e) => setMaps({ ...maps, [db.key]: { ...m, columns: { ...m.columns, [col]: e.target.value } } })}>
                            {props.map((p) => <option key={p.key} value={p.key}>{p.label}{p.kind === 'relation' ? t('importer.notion.relation') : ''}</option>)}
                            {m.type === 'daily' && <option value="routine">{t('importer.notion.routine')}</option>}
                            <option value="new">{t('importer.notion.newField')}</option>
                            <option value="extra">{t('importer.notion.extra')}</option>
                            <option value="skip">{t('importer.notion.skip')}</option>
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
                <h3>{t('importer.notion.standalone')} <span className="count">{standalone}</span></h3>
                <span className="spacer" />
                <select value={pageType} onChange={(e) => setPageType(e.target.value as TypeId)}>
                  {TYPES.map((ty) => <option key={ty.id} value={ty.id}>{ty.icon} {ty.label}</option>)}
                </select>
              </div>
            </section>
          )}
          <p className="muted small">{t.rich('importer.notion.relHint', { code: <code>[[ ]]</code> })}</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setParsed(null)} disabled={Boolean(busy)}>{t('common.cancel')}</button>
            <button className="btn primary" onClick={() => void run()} disabled={Boolean(busy)}>{busy ?? t('importer.notion.import')}</button>
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
