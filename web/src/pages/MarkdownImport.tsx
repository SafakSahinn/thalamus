import { t } from '../i18n';
import { useState } from 'react';
import { buildMdNotes, collectFiles } from '../lib/mdImport';
import { insertNotes, syncNow, uploadFile, useIndex } from '../lib/store';

/** Markdown / Obsidian kasası: klasör, .zip ya da .md dosyaları */
export default function MarkdownImport() {
  const { alive } = useIndex();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr(null);
    setMsg(null);
    setBusy(t('panels.mdImport.reading'));
    try {
      const files = await collectFiles(list);
      if (!files.some((f) => /\.md$/i.test(f.path))) throw new Error(t('panels.mdImport.noMd'));
      const r = await buildMdNotes(files, alive, (b, name) => uploadFile(b, name), (done, total) => setBusy(t('panels.mdImport.preparing', { done, total })));
      insertNotes(r.notes);
      void syncNow();
      const notes = r.notes.length - r.folders;
      setMsg(`${t(r.folders ? 'panels.mdImport.doneFolders' : 'panels.mdImport.done', { notes, folders: r.folders })}${r.images ? ` ${t('panels.mdImport.images', { count: r.images })}` : ''}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="md-import">
      <h2 className="import-h">Markdown / Obsidian</h2>
      <p className="muted small">
        {t.rich('panels.mdImport.intro', { links: <code>{t('panels.mdImport.linksExample')}</code>, img: <code>{t('panels.mdImport.imgExample')}</code>, title: <code>title</code> })}
      </p>
      <div className="row">
        <label className="btn">
          {t('panels.mdImport.folder')}
          <input type="file" hidden multiple {...({ webkitdirectory: '' } as object)} onChange={(e) => void run(e.target.files)} />
        </label>
        <label className="btn">
          {t('panels.mdImport.files')}
          <input type="file" hidden multiple accept=".md,.markdown,.zip,image/*" onChange={(e) => void run(e.target.files)} />
        </label>
        {busy && <span className="muted small">{busy}</span>}
      </div>
      {msg && <p className="ok small">{msg}</p>}
      {err && <p className="err small">{err}</p>}
    </section>
  );
}
