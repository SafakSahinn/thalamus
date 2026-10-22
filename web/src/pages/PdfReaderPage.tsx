import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useMemo, useRef, useState } from 'react';
import { promptText } from '../components/Prompt';
import { displayTitle, fmtNum } from '../lib/format';
import { addHighlight, HL_COLORS, loadPdfBytes, pdfSources, removeHighlight, type Highlight, type HlColor } from '../lib/highlights';
import { fillFromPdf } from '../lib/paperImport';
import { go } from '../lib/router';
import { createNote, setProp, uploadFile, useStore } from '../lib/store';
import { relationIds } from '../lib/types';
import '../pdf-text.css';

GlobalWorkerOptions.workerSrc = workerUrl;

// PDF okuyucu: makalenin PDF'ini Thalamus içinde aç, metni seçip vurgula, not ekle, kelimeyi sözlüğe at.
// Vurgular notun gizli alanında durur ve notun içine alıntı olarak da eklenir (bkz. highlights.ts).

/** PDF baytları: Drive/cihaz dosyası, doğrudan adres, olmazsa açık arşivler için sunucu aracısı */
interface Sel {
  page: number;
  rects: [number, number, number, number][];
  text: string;
  x: number;
  y: number;
}

function PdfPage({ pdf, num, scale, highlights, onSelect, focusId }: {
  pdf: PDFDocumentProxy;
  num: number;
  scale: number;
  highlights: Highlight[];
  onSelect: (s: Sel | null) => void;
  focusId: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(num <= 2);

  // Yalnızca ekrana yaklaşan sayfaları çiz
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void pdf.getPage(num).then((page) => {
      const vp = page.getViewport({ scale });
      if (cancelled) return;
      setSize({ w: vp.width, h: vp.height });
      if (!visible || !canvas.current || !text.current) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.current.width = Math.floor(vp.width * dpr);
      canvas.current.height = Math.floor(vp.height * dpr);
      const task = page.render({ canvas: canvas.current, viewport: page.getViewport({ scale: scale * dpr }) });
      text.current.replaceChildren();
      text.current.style.setProperty('--scale-factor', String(scale));
      text.current.style.setProperty('--total-scale-factor', String(scale));
      const tl = new TextLayer({ textContentSource: page.streamTextContent(), container: text.current, viewport: vp });
      void tl.render().catch(() => undefined);
      return () => task.cancel();
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, num, scale, visible]);

  useEffect(() => {
    if (focusId && highlights.some((h) => h.id === focusId)) box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, highlights]);

  const onUp = () => {
    const s = window.getSelection();
    const t = s?.toString().trim() ?? '';
    if (!s || !t || !box.current || !s.rangeCount) return onSelect(null);
    const range = s.getRangeAt(0);
    if (!box.current.contains(range.commonAncestorContainer)) return;
    const b = box.current.getBoundingClientRect();
    const rects = [...range.getClientRects()]
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => [(r.left - b.left) / b.width, (r.top - b.top) / b.height, r.width / b.width, r.height / b.height] as [number, number, number, number]);
    const last = range.getBoundingClientRect();
    onSelect({ page: num, rects, text: t.replace(/\s+/g, ' '), x: last.left + last.width / 2, y: last.bottom });
  };

  return (
    <div ref={box} className="pdf-page" data-page={num} style={size ? { width: size.w, height: size.h } : { width: 612 * scale, height: 792 * scale }} onMouseUp={onUp} onTouchEnd={() => setTimeout(onUp, 50)}>
      <canvas ref={canvas} style={size ? { width: size.w, height: size.h } : undefined} />
      {highlights.map((h) => h.rects.map((r, i) => (
        <div
          key={`${h.id}.${i}`}
          className={`pdf-hl ${focusId === h.id ? 'focus' : ''}`}
          style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%`, background: HL_COLORS.find((c) => c.id === h.color)?.css }}
          title={h.comment || h.text}
        />
      )))}
      <div ref={text} className="textLayer" />
      <span className="pdf-num">{num}</span>
    </div>
  );
}

export default function PdfReaderPage({ id }: { id: string }) {
  const note = useStore((s) => s.notes[id]);
  const sources = useMemo(() => (note ? pdfSources(note) : []), [note]);
  const [src, setSrc] = useState<string | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [err, setErr] = useState('');
  const [scale, setScale] = useState(() => Math.min(1.6, Math.max(0.8, (window.innerWidth - 380) / 620)));
  const [sel, setSel] = useState<Sel | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const active = src ?? sources[0]?.src ?? null;
  const highlights = (Array.isArray(note?.props.__highlights) ? (note!.props.__highlights as Highlight[]) : []).filter((h) => h.src === active);

  useEffect(() => {
    if (!active) return;
    let gone = false;
    setPdf(null);
    setErr('');
    void loadPdfBytes(active)
      .then((buf) => getDocument({ data: new Uint8Array(buf) }).promise)
      .then((d) => !gone && setPdf(d))
      .catch((e: Error) => !gone && setErr(e.message));
    return () => {
      gone = true;
    };
  }, [active]);

  if (!note) return <div className="page"><p className="muted">Not bulunamadı.</p></div>;

  const mark = async (color: HlColor, withComment = false) => {
    if (!sel) return;
    const comment = withComment ? await promptText('Vurguya not', '', { multiline: true, hint: `“${sel.text.slice(0, 80)}${sel.text.length > 80 ? '…' : ''}”` }) : undefined;
    if (withComment && comment === null) return;
    addHighlight(note.id, { src: active!, page: sel.page, rects: sel.rects, text: sel.text, color, comment: comment?.trim() || undefined });
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };
  const addWord = () => {
    if (!sel) return;
    const w = createNote('word', sel.text.slice(0, 80));
    setProp(note.id, 'words', [...relationIds(note.props.words), w.id]);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };
  const onUpload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const s = await uploadFile(f, f.name);
      if (note.type === 'paper' || !note.props.pdf) setProp(note.id, 'pdf', s);
      setSrc(s);
      // makale notunda boş alanlar ve (içerik boşsa) özet + bölüm başlıkları PDF'ten dolsun
      if (note.type === 'paper') void fillFromPdf(note.id, await f.arrayBuffer()).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pdf-reader" onMouseDown={(e) => !(e.target as HTMLElement).closest('.pdf-tools') && setSel(null)}>
      <div className="pdf-bar">
        <button className="btn small" onClick={() => go(`/n/${note.id}`)}>← Not</button>
        <b className="pdf-title">{displayTitle(note)}</b>
        {sources.length > 1 && (
          <select value={active ?? ''} onChange={(e) => setSrc(e.target.value)}>
            {sources.map((s) => <option key={s.src} value={s.src}>{s.label}</option>)}
          </select>
        )}
        <span className="spacer" />
        {pdf && <span className="muted small">{fmtNum(pdf.numPages)} sayfa</span>}
        <button className="cal-nav" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))} aria-label="Uzaklaştır">−</button>
        <span className="muted small">%{Math.round(scale * 100)}</span>
        <button className="cal-nav" onClick={() => setScale((s) => Math.min(3, s + 0.15))} aria-label="Yakınlaştır">+</button>
        <button className="btn small" disabled={busy} onClick={() => upload.current?.click()}>{busy ? 'Yükleniyor…' : '⬆ PDF yükle'}</button>
        <input ref={upload} type="file" accept="application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
      </div>
      <div className="pdf-main">
        <div className="pdf-scroll">
          {!active && <p className="muted pdf-empty">Bu notta PDF yok. “⬆ PDF yükle” ile bir PDF ekle.</p>}
          {err && <p className="err pdf-empty">{err}</p>}
          {active && !pdf && !err && <p className="muted pdf-empty">PDF yükleniyor…</p>}
          {pdf && Array.from({ length: pdf.numPages }, (_, i) => (
            <PdfPage key={`${active}-${i}`} pdf={pdf} num={i + 1} scale={scale} highlights={highlights.filter((h) => h.page === i + 1)} onSelect={setSel} focusId={focus} />
          ))}
        </div>
        <aside className="pdf-side">
          <b>🖍 Vurgular ({highlights.length})</b>
          {highlights.length === 0 && <p className="muted small">Metni seçip bir renk seçince vurgu buraya ve notun içine eklenir.</p>}
          {highlights.map((h) => (
            <div key={h.id} className={`pdf-hl-item ${focus === h.id ? 'focus' : ''}`} style={{ borderLeftColor: HL_COLORS.find((c) => c.id === h.color)?.css }}>
              <button type="button" className="pdf-hl-text" onClick={() => setFocus(h.id)}>“{h.text.length > 160 ? `${h.text.slice(0, 159)}…` : h.text}”</button>
              {h.comment && <div className="small">{h.comment}</div>}
              <div className="pdf-hl-meta">
                <span className="muted small">s. {h.page}</span>
                <button type="button" className="linkbtn small danger-link" onClick={() => removeHighlight(note.id, h.id)}>Sil</button>
              </div>
            </div>
          ))}
        </aside>
      </div>
      {sel && (
        <div className="pdf-tools" style={{ left: Math.min(window.innerWidth - 300, Math.max(8, sel.x - 140)), top: sel.y + 8 }}>
          {HL_COLORS.map((c) => <button key={c.id} type="button" className="pdf-sw" style={{ background: c.css }} title={`${c.label} vurgula`} onClick={() => void mark(c.id)} />)}
          <button type="button" className="btn small" onClick={() => void mark('yellow', true)}>💬 Not</button>
          <button type="button" className="btn small" onClick={addWord} title="Seçili kelimeyi sözlüğe ekle ve bu nota bağla">🔤 Kelime</button>
        </div>
      )}
    </div>
  );
}
