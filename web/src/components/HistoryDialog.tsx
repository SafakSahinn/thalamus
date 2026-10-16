import { generateHTML, type JSONContent } from '@tiptap/core';
import katex from 'katex';
import { useEffect, useMemo, useRef, useState } from 'react';
import { schemaExtensions } from '../editor/extensions';
import type { Version } from '../lib/history';
import { noteVersions, restoreVersion, useStore } from '../lib/store';
import type { Note } from '../lib/types';

const fmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Preview({ content }: { content: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    if (!content) return '<p class="muted">Bu sürümde içerik yok.</p>';
    try {
      return generateHTML(content as JSONContent, schemaExtensions());
    } catch {
      return '<p class="muted">Önizleme oluşturulamadı.</p>';
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
      <div className="modal history" role="dialog" aria-label="Sayfa geçmişi">
        <div className="row"><h3>🕓 Sayfa geçmişi</h3><span className="spacer" /><button className="iconbtn" onClick={onClose}>×</button></div>
        <div className="history-body">
          <div className="history-list">
            {list === null && <p className="muted small">Yükleniyor…</p>}
            {list?.length === 0 && <p className="muted small">Henüz kayıtlı sürüm yok. Notu düzenledikçe en fazla 10 dakikada bir sürüm saklanır.</p>}
            {list?.map((v) => (
              <button key={v.key} type="button" className={`hist-item ${sel?.key === v.key ? 'on' : ''}`} onClick={() => setSel(v)}>
                <span>{fmt.format(new Date(v.at))}</span>
                <span className="muted small">{v.source === 'drive' ? '☁ Drive' : '💻 Bu cihaz'}{v.at === current?.updated_at ? ' · şu anki' : ''}</span>
              </button>
            ))}
          </div>
          <div className="history-view">
            {err && <p className="err small">{err}</p>}
            {sel && !loaded && !err && <p className="muted small">Sürüm yükleniyor…</p>}
            {loaded && (
              <>
                <h2 className="history-title">{loaded.title || 'Adsız'}</h2>
                <Preview content={loaded.content} />
              </>
            )}
          </div>
        </div>
        <div className="row end">
          <span className="muted small grow">Geri yükleme yapınca şu anki hal de geçmişe kaydedilir; yani geri alınabilir.</span>
          <button className="btn ghost" onClick={onClose}>Kapat</button>
          <button className="btn primary" disabled={!loaded || busy} onClick={() => void restore()}>Bu sürümü geri yükle</button>
        </div>
      </div>
    </div>
  );
}
