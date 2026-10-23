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

/** Notion tarzı sayfa üst kısmı: kapak görseli + büyük simge + "Simge ekle / Kapak ekle" */
export default function PageDecor({ note }: { note: Note }) {
  const [iconPick, setIconPick] = useState(false);
  const [bannerPick, setBannerPick] = useState(false);
  const banner = note.props.banner as string | undefined;
  const icon = note.props.icon as string | undefined;
  const style = useBannerStyle(banner);

  return (
    <div className={`page-decor ${banner ? 'has-banner' : ''}`}>
      {style && (
        <div className="page-banner" style={style}>
          <button type="button" className="btn small banner-change" onClick={() => setBannerPick(true)}>{t('reading.decor.change')}</button>
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
