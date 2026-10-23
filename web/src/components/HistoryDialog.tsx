import { localeTag, t } from '../i18n';
import { generateHTML, type JSONContent } from '@tiptap/core';
import katex from 'katex';
import { useEffect, useMemo, useRef, useState } from 'react';
import { schemaExtensions } from '../editor/extensions';
import type { Version } from '../lib/history';
import { noteVersions, restoreVersion, useStore } from '../lib/store';
import type { Note } from '../lib/types';

const fmt = (d: Date) => d.toLocaleString(localeTag(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Preview({ content }: { content: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    if (!content) return `<p class="muted">${t('writing.history.noContent')}</p>`;
    try {
      return generateHTML(content as JSONContent, schemaExtensions());
    } catch {
      return `<p class="muted">${t('writing.history.noPreview')}</p>`;
    }
  }, [content]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Güvenlik: betik bağlantılarını etkisizleştir
    el.querySelectorAll('a[href^="javascript:"]').forEach((a) => a.removeAttribute('href'));
    el.querySelectorAll<HTMLElement>('[data-type="inline-math"], [data-type="block-math"]').forEach((m) => {
      try {
        katex.render(m.getAttribute('data-latex') ?? '', m, { throwOnError: false, displayMode: m.dataset.type === 'block-math' });
      } catch {
        /* formül çizilemedi */
      }
    });
  }, [html]);
  return <div ref={ref} className="prose history-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function HistoryDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const [list, setList] = useState<Version[] | null>(null);
  const [sel, setSel] = useState<Version | null>(null);
  const [loaded, setLoaded] = useState<{ title: string; props: Record<string, unknown>; content: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const current = useStore((s) => s.notes[note.id]);

  useEffect(() => {
    void noteVersions(note.id).then((v) => {
      setList(v);
      if (v[0]) setSel(v[0]);
    });
  }, [note.id]);

  useEffect(() => {
    setLoaded(null);
    setErr('');
    if (!sel) return;
    if (!sel.load) {
      setLoaded({ title: sel.title, props: sel.props, content: sel.content });
      return;
    }
    let alive = true;
    sel.load().then(
      (n) => alive && setLoaded({ title: n.title, props: n.props, content: n.content }),
      (e) => alive && setErr(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [sel]);

  const restore = async () => {
    if (!loaded) return;
    setBusy(true);
    await restoreVersion(note.id, loaded);
    setBusy(false);
    onClose();
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal history" role="dialog" aria-label={t('writing.history.aria')}>
        <div className="row"><h3>{t('writing.history.title')}</h3><span className="spacer" /><button className="iconbtn" onClick={onClose} aria-label={t('common.close')}>×</button></div>
        <div className="history-body">
          <div className="history-list">
            {list === null && <p className="muted small">{t('common.loading')}</p>}
            {list?.length === 0 && <p className="muted small">{t('writing.history.none')}</p>}
            {list?.map((v) => (
              <button key={v.key} type="button" className={`hist-item ${sel?.key === v.key ? 'on' : ''}`} onClick={() => setSel(v)}>
                <span>{fmt(new Date(v.at))}</span>
                <span className="muted small">{v.source === 'drive' ? '☁ Drive' : t('writing.history.device')}{v.at === current?.updated_at ? t('writing.history.current') : ''}</span>
              </button>
            ))}
          </div>
          <div className="history-view">
            {err && <p className="err small">{err}</p>}
            {sel && !loaded && !err && <p className="muted small">{t('writing.history.loading')}</p>}
            {loaded && (
              <>
                <h2 className="history-title">{loaded.title || t('common.untitled')}</h2>
                <Preview content={loaded.content} />
              </>
            )}
          </div>
        </div>
        <div className="row end">
          <span className="muted small grow">{t('writing.history.restoreHint')}</span>
          <button className="btn ghost" onClick={onClose}>{t('common.close')}</button>
          <button className="btn primary" disabled={!loaded || busy} onClick={() => void restore()}>{t('writing.history.restore')}</button>
        </div>
      </div>
    </div>
  );
}
