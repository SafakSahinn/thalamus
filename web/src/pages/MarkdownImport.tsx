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
    setBusy('Dosyalar okunuyor…');
    try {
      const files = await collectFiles(list);
      if (!files.some((f) => /\.md$/i.test(f.path))) throw new Error('Seçilenler arasında .md dosyası bulunamadı.');
      const r = await buildMdNotes(files, alive, (b, name) => uploadFile(b, name), (d, t) => setBusy(`${d}/${t} not hazırlanıyor…`));
      insertNotes(r.notes);
      void syncNow();
      const notes = r.notes.length - r.folders;
      setMsg(`${notes} not${r.folders ? `, ${r.folders} klasör sayfası` : ''}${r.images ? ` ve ${r.images} görsel` : ''} aktarıldı. Notlar “Notlar” koleksiyonunda; klasörler kenar çubuğundaki sayfa ağacında.`);
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
        Obsidian kasanı ya da Markdown notlarını aktar. <code>[[bağlantılar]]</code> not bağlantısına, <code>![[görsel.png]]</code> görsele dönüşür;
        YAML başlığındaki <code>title</code> notun adı olur, diğer alanlar ek bilgi olarak saklanır; klasörler üst sayfa olur.
      </p>
      <div className="row">
        <label className="btn">
          📁 Klasör seç
          <input type="file" hidden multiple {...({ webkitdirectory: '' } as object)} onChange={(e) => void run(e.target.files)} />
        </label>
        <label className="btn">
          📄 .md / .zip dosyaları seç
          <input type="file" hidden multiple accept=".md,.markdown,.zip,image/*" onChange={(e) => void run(e.target.files)} />
        </label>
        {busy && <span className="muted small">{busy}</span>}
      </div>
      {msg && <p className="ok small">{msg}</p>}
      {err && <p className="err small">{err}</p>}
    </section>
  );
}
