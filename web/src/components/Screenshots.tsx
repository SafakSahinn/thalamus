import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveFileUrl, setProp, uploadFile, useStore } from '../lib/store';
import { fileRefs, type FileRef, type Note } from '../lib/types';

/** Ekran görüntüleri galerisi gösterilen alanlar: tip → alan anahtarı */
export const GALLERY_PROPS: Record<string, string> = { game: 'screenshots' };
export const isGalleryProp = (type: string, key: string) => GALLERY_PROPS[type] === key;

/**
 * Büyük PNG/JPEG ekran görüntülerini aynı çözünürlükte WebP'ye çevirir (Drive'da yer kaplamasın).
 * Sonuç daha büyükse ya da tarayıcı çeviremezse dosya olduğu gibi kalır; GIF'e dokunulmaz.
 */
export async function shrinkImage(file: File): Promise<{ blob: Blob; name: string }> {
  if (!/^image\/(png|jpeg|bmp)$/.test(file.type) || file.size < 200_000) return { blob: file, name: file.name };
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0);
    bmp.close();
    const webp = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.9));
    if (!webp || webp.type !== 'image/webp' || webp.size >= file.size) return { blob: file, name: file.name };
    return { blob: webp, name: file.name.replace(/\.[^.]+$/, '') + '.webp' };
  } catch {
    return { blob: file, name: file.name };
  }
}

function useUrl(src: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setErr(false);
    resolveFileUrl(src).then((u) => live && setUrl(u), () => live && setErr(true));
    return () => { live = false; };
  }, [src]);
  return { url, err };
}

function Thumb({ file, onOpen, onRemove, locked }: { file: FileRef; onOpen: () => void; onRemove: () => void; locked: boolean }) {
  const { url, err } = useUrl(file.src);
  return (
    <div className="shot">
      <button type="button" className="shot-img" onClick={onOpen} title={file.name}>
        {url ? <img src={url} alt={file.name} loading="lazy" /> : <span className="muted small">{err ? '⚠' : '…'}</span>}
      </button>
      {!locked && <button type="button" className="x shot-x" title={t('common.remove')} onClick={onRemove}>×</button>}
    </div>
  );
}

function Lightbox({ files, index, onIndex, onClose, onRemove, locked }: {
  files: FileRef[]; index: number; onIndex: (i: number) => void; onClose: () => void; onRemove: (f: FileRef) => void; locked: boolean;
}) {
  const file = files[index];
  const { url, err } = useUrl(file.src);
  const n = files.length;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && n > 1) onIndex((index + 1) % n);
      else if (e.key === 'ArrowLeft' && n > 1) onIndex((index - 1 + n) % n);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [index, n, onClose, onIndex]);
  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-label={file.name}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox-count">{index + 1} / {n}</span>
        <span className="lightbox-name">{file.name}</span>
        {url && <a className="btn small" href={url} download={file.name}>{t('props.shots.download')}</a>}
        {!locked && <button type="button" className="btn small" onClick={() => onRemove(file)}>{t('common.remove')}</button>}
        <button type="button" className="btn small" onClick={onClose} title="Esc">✕</button>
      </div>
      {n > 1 && <button type="button" className="lightbox-nav prev" aria-label={t('props.shots.prev')} onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + n) % n); }}>‹</button>}
      {url ? <img className="lightbox-img" src={url} alt={file.name} onClick={(e) => e.stopPropagation()} /> : <span className="lightbox-wait">{err ? t('props.shots.loadError') : t('common.loading')}</span>}
      {n > 1 && <button type="button" className="lightbox-nav next" aria-label={t('props.shots.next')} onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % n); }}>›</button>}
    </div>,
    document.body,
  );
}

/** Not sayfasında ekran görüntüleri: sürükle-bırak, yapıştır (Ctrl+V) ya da seç; tıklayınca büyük görünüm */
export default function Screenshots({ note, locked }: { note: Note; locked: boolean }) {
  const key = GALLERY_PROPS[note.type];
  const files = key ? fileRefs(note.props[key]) : [];
  const [busy, setBusy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!key || (locked && !files.length)) return null;

  const current = () => fileRefs(useStore.getState().notes[note.id]?.props[key]);
  const add = async (list: File[]) => {
    const images = list.filter((f) => f.type.startsWith('image/'));
    if (!images.length) return;
    setBusy(images.length);
    try {
      for (const f of images) {
        const { blob, name } = await shrinkImage(f);
        const ref = { src: await uploadFile(blob, name), name };
        setProp(note.id, key, [...current(), ref]);
        setBusy((b) => b - 1);
      }
    } finally {
      setBusy(0);
      if (input.current) input.current.value = '';
    }
  };
  const remove = (f: FileRef) => {
    const next = current().filter((x) => x.src !== f.src);
    setProp(note.id, key, next.length ? next : undefined);
    setOpen((i) => (i === null || !next.length ? null : Math.min(i, next.length - 1)));
  };

  return (
    <section
      className={`shots ${drag ? 'drag' : ''}`}
      tabIndex={locked ? undefined : 0}
      onPaste={locked ? undefined : (e) => {
        const list = [...e.clipboardData.files];
        if (list.length) { e.preventDefault(); void add(list); }
      }}
      onDragOver={locked ? undefined : (e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={locked ? undefined : (e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDrag(false);
        void add([...e.dataTransfer.files]);
      }}
    >
      <h3 className="shots-head">
        {t('props.shots.title')}
        {files.length > 0 && <span className="muted small">{files.length}</span>}
      </h3>
      <div className="shots-grid">
        {files.map((f, i) => (
          <Thumb key={f.src} file={f} locked={locked} onOpen={() => setOpen(i)} onRemove={() => remove(f)} />
        ))}
        {!locked && (
          <button type="button" className="shot shot-add" disabled={busy > 0} onClick={() => input.current?.click()}>
            {busy > 0 ? <span>{t('props.shots.uploading', { count: busy })}</span> : (
              <>
                <span className="shot-plus">＋</span>
                <span>{t('props.shots.add')}</span>
                <span className="muted small">{t('props.shots.hint')}</span>
              </>
            )}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void add([...(e.target.files ?? [])])} />
      {open !== null && files[open] && (
        <Lightbox files={files} index={open} onIndex={setOpen} onClose={() => setOpen(null)} onRemove={remove} locked={locked} />
      )}
    </section>
  );
}
