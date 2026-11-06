import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { EmojiPicker } from '../editor/EmojiPicker';
import { resolveFileUrl, setProp, uploadFile } from '../lib/store';
import type { Note } from '../lib/types';
import { promptText } from './Prompt';

/** Hazır kapaklar (görsel yüklemeden) */
export const GRADIENTS = [
  'linear-gradient(120deg, #2b2f6b, #4a50a8 55%, #f2a03d)',
  'linear-gradient(120deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(120deg, #e0c3fc, #8ec5fc)',
  'linear-gradient(120deg, #f6d365, #fda085)',
  'linear-gradient(120deg, #84fab0, #8fd3f4)',
  'linear-gradient(120deg, #fbc2eb, #a6c1ee)',
  'linear-gradient(120deg, #434343, #000000)',
  'linear-gradient(120deg, #c79081, #dfa579)',
  'radial-gradient(circle at 30% 40%, #5ec4c4, #2b2f6b 70%)',
  'linear-gradient(120deg, #ff9a9e, #fecfef)',
];

export { noteIcon } from '../lib/format';

/** Kapak: "g:3" (hazır renk geçişi) ya da görsel adresi (https, gd://, local://) */
export function useBannerStyle(banner: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (banner && !banner.startsWith('g:')) resolveFileUrl(banner).then(setUrl, () => setUrl(null));
  }, [banner]);
  if (!banner) return null;
  if (banner.startsWith('g:')) return { background: GRADIENTS[Number(banner.slice(2)) % GRADIENTS.length] };
  return url ? { backgroundImage: `url("${url}")` } : { background: 'var(--panel)' };
}

function BannerPicker({ note, onClose }: { note: Note; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const out = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    setTimeout(() => document.addEventListener('mousedown', out), 0);
    return () => document.removeEventListener('mousedown', out);
  }, [onClose]);
  const set = (v: string | undefined) => {
    setProp(note.id, 'banner', v);
    onClose();
  };
  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      try {
        set(await uploadFile(f, f.name));
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };
  const link = async () => {
    const v = await promptText(t('reading.decor.urlPrompt'), 'https://');
    if (v?.trim().startsWith('http')) set(v.trim());
  };
  return (
    <div className="banner-picker" ref={ref}>
      <div className="bm-h">{t('reading.decor.presets')}</div>
      <div className="bp-grid">
        {GRADIENTS.map((g, i) => (
          <button key={i} type="button" style={{ background: g }} onClick={() => set(`g:${i}`)} aria-label={t('reading.decor.cover', { n: i + 1 })} />
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn small" onClick={upload} disabled={busy}>{busy ? t('common.loading') : t('reading.decor.upload')}</button>
        <button type="button" className="btn small ghost" onClick={() => void link()}>{t('reading.decor.link')}</button>
        {note.props.banner ? <button type="button" className="btn small ghost danger" onClick={() => set(undefined)}>{t('common.remove')}</button> : null}
      </div>
    </div>
  );
}

/** Kapak görselinin dikey konumu (props.__bannerY, %): Notion'daki "Konumu ayarla" gibi fareyle sürüklenir */
function useBannerDrag(note: Note, ref: React.RefObject<HTMLDivElement | null>, url: string | undefined) {
  const saved = typeof note.props.__bannerY === 'number' ? (note.props.__bannerY as number) : 50;
  const [y, setY] = useState<number | null>(null); // düzenlerken geçici değer
  const ratio = useRef(0); // görselin yükseklik / genişlik oranı
  useEffect(() => {
    setY(null);
    ratio.current = 0;
    if (!url) return;
    const img = new Image();
    img.onload = () => (ratio.current = img.naturalHeight / img.naturalWidth);
    img.src = url;
  }, [url, note.id]);
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (y === null || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const box = ref.current!.getBoundingClientRect();
    // "cover" ölçeğinde görselin kutudan taşan yüksekliği; konum yüzdesi bu taşmanın yüzdesidir
    const over = Math.max(box.width * ratio.current, box.height) - box.height;
    if (over <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = { py: e.clientY, y };
    const move = (ev: PointerEvent) => setY(Math.min(100, Math.max(0, start.y - ((ev.clientY - start.py) / over) * 100)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return {
    editing: y !== null,
    pos: y ?? saved,
    start: () => setY(saved),
    save: () => {
      if (y !== null) setProp(note.id, '__bannerY', Math.round(y * 10) / 10 === 50 ? undefined : Math.round(y * 10) / 10);
      setY(null);
    },
    cancel: () => setY(null),
    down,
  };
}

/** Notion tarzı sayfa üst kısmı: kapak görseli + büyük simge + "Simge ekle / Kapak ekle" */
export default function PageDecor({ note }: { note: Note }) {
  const [iconPick, setIconPick] = useState(false);
  const [bannerPick, setBannerPick] = useState(false);
  const banner = note.props.banner as string | undefined;
  const icon = note.props.icon as string | undefined;
  const style = useBannerStyle(banner);
  const bannerRef = useRef<HTMLDivElement>(null);
  const image = style && 'backgroundImage' in style ? style.backgroundImage?.slice(5, -2) : undefined;
  const drag = useBannerDrag(note, bannerRef, image);

  return (
    <div className={`page-decor ${banner ? 'has-banner' : ''}`}>
      {style && (
        <div
          ref={bannerRef}
          className={`page-banner ${drag.editing ? 'repositioning' : ''}`}
          style={image ? { ...style, backgroundPosition: `center ${drag.pos}%` } : style}
          onPointerDown={drag.down}
        >
          {drag.editing ? (
            <>
              <span className="banner-hint">{t('reading.decor.dragHint')}</span>
              <div className="banner-tools">
                <button type="button" className="btn small" onClick={drag.save}>{t('reading.decor.savePos')}</button>
                <button type="button" className="btn small ghost" onClick={drag.cancel}>{t('common.cancel')}</button>
              </div>
            </>
          ) : (
            <div className="banner-tools hover">
              {image && <button type="button" className="btn small" onClick={drag.start}>{t('reading.decor.reposition')}</button>}
              <button type="button" className="btn small" onClick={() => setBannerPick(true)}>{t('reading.decor.change')}</button>
            </div>
          )}
        </div>
      )}
      {icon && (
        <div className="page-icon-wrap">
          <button type="button" className="page-icon" onClick={() => setIconPick(!iconPick)} title={t('reading.decor.changeIcon')}>{icon}</button>
          {iconPick && <EmojiPicker allowRemove onClose={() => setIconPick(false)} onPick={(e) => { setProp(note.id, 'icon', e || undefined); setIconPick(false); }} />}
        </div>
      )}
      <div className="decor-actions">
        {!icon && (
          <span className="rel">
            <button type="button" className="linkbtn muted" onClick={() => setIconPick(!iconPick)}>{t('reading.decor.addIcon')}</button>
            {iconPick && <EmojiPicker onClose={() => setIconPick(false)} onPick={(e) => { setProp(note.id, 'icon', e || undefined); setIconPick(false); }} />}
          </span>
        )}
        {!banner && <button type="button" className="linkbtn muted" onClick={() => setBannerPick(true)}>{t('reading.decor.addCover')}</button>}
      </div>
      {bannerPick && <BannerPicker note={note} onClose={() => setBannerPick(false)} />}
    </div>
  );
}
