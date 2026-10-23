import { t } from '../i18n';
import { useRef, useState } from 'react';
import { bibFile, citeOf, parseBibtex } from '../lib/bibtex';
import { createPaperFromMeta, importPaper } from '../lib/paperImport';
import { useStore } from '../lib/store';
import type { Note } from '../lib/types';
import { openPeek } from './Peek';
import { promptText } from './Prompt';

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/x-bibtex' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Makale koleksiyonu: DOI/arXiv ile ekle, BibTeX indir (görünümdeki kayıtlar), .bib içe aktar (Zotero, Mendeley, Scholar) */
export default function PaperImportButton({ extraProps, rows }: { extraProps?: () => Record<string, unknown>; rows?: Note[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const run = async () => {
    const v = await promptText(t('dialogs.paper.promptTitle'), '', {
      hint: t('dialogs.paper.promptHint'),
    });
    if (!v?.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await importPaper(v, extraProps?.() ?? {});
      if (r.existed) setMsg(t('dialogs.paper.existed'));
      openPeek(r.note.id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const exportBib = () => {
    const notes = useStore.getState().notes;
    const list = (rows ?? []).filter((n) => n.type === 'paper');
    if (!list.length) return setMsg(t('dialogs.paper.noneInView'));
    download('thalamus.bib', bibFile(list.map((n) => citeOf(n, notes))));
    setMsg(t('dialogs.paper.exported', { count: list.length }));
  };
  const importBib = async (f: File | undefined) => {
    if (!f) return;
    const metas = parseBibtex(await f.text());
    let added = 0;
    for (const m of metas) if (!createPaperFromMeta(m, extraProps?.() ?? {}).existed) added++;
    setMsg(t(metas.length - added ? 'dialogs.paper.importedSkipped' : 'dialogs.paper.imported', { count: metas.length, added, skipped: metas.length - added }));
    if (file.current) file.current.value = '';
  };
  return (
    <>
      <button className="btn" onClick={() => void run()} disabled={busy} title={t('dialogs.paper.doiTitle')}>{busy ? t('dialogs.paper.searching') : '🔎 DOI / arXiv'}</button>
      <button className="btn" onClick={exportBib} title={t('dialogs.paper.exportTitle')}>⬇ .bib</button>
      <button className="btn" onClick={() => file.current?.click()} title={t('dialogs.paper.importTitle')}>⬆ .bib</button>
      <input ref={file} type="file" accept=".bib,.bibtex,.txt" hidden onChange={(e) => void importBib(e.target.files?.[0])} />
      {msg && <span className="muted small paper-msg">{msg}</span>}
    </>
  );
}
