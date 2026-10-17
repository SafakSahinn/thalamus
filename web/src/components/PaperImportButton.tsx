import { useState } from 'react';
import { importPaper } from '../lib/paperImport';
import { openPeek } from './Peek';
import { promptText } from './Prompt';

/** Makale koleksiyonu: DOI ya da arXiv bağlantısıyla makale ekle */
export default function PaperImportButton({ extraProps }: { extraProps?: () => Record<string, unknown> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const run = async () => {
    const v = await promptText('DOI ya da arXiv ile makale ekle', '', {
      hint: 'DOI (10.1109/…), doi.org ya da arxiv.org bağlantısı yapıştır. Başlık, yazarlar, yıl, dergi/konferans, özet ve PDF bağlantısı kendiliğinden dolar.',
    });
    if (!v?.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await importPaper(v, extraProps?.() ?? {});
      if (r.existed) setMsg('Bu makale zaten kayıtlı, onu açtım.');
      openPeek(r.note.id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="btn" onClick={() => void run()} disabled={busy} title="DOI ya da arXiv bağlantısıyla makale ekle">{busy ? 'Aranıyor…' : '🔎 DOI / arXiv'}</button>
      {msg && <span className="muted small paper-msg">{msg}</span>}
    </>
  );
}
