import { t } from '../i18n';
import { useState } from 'react';
import { go } from '../lib/router';
import { createNote, useStore } from '../lib/store';
import { TYPES, typeOf } from '../lib/types';
import { importPaper } from '../lib/paperImport';
import { parseIdent } from '../lib/scholar';

// Telefonda "Paylaş → Thalamus": tarayıcıdan ya da başka bir uygulamadan paylaşılan bağlantı/metin buraya gelir
// (PWA share_target, adres ?title=…&text=…&url=…). Kullanıcı koleksiyonu ve başlığı seçip kaydeder.

const URL_RE = /https?:\/\/[^\s<>"]+/;

function readShared(): { title: string; text: string; url: string } | null {
  const q = new URLSearchParams(location.search);
  if (!q.has('share')) return null;
  let url = q.get('url') ?? '';
  let text = q.get('text') ?? '';
  // Android çoğu zaman bağlantıyı metnin içine koyar
  if (!url) {
    const m = text.match(URL_RE);
    if (m) {
      url = m[0];
      text = text.replace(m[0], '').trim();
    }
  }
  return { title: (q.get('title') ?? '').trim(), text: text.trim(), url: url.trim() };
}

const clear = () => history.replaceState(null, '', `${location.pathname}${location.hash || '#/'}`);

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

export default function QuickCapture() {
  const ready = useStore((s) => s.ready);
  const [shared] = useState(readShared);
  const [open, setOpen] = useState(Boolean(shared));
  const [title, setTitle] = useState(shared?.title || (shared?.url ? hostOf(shared.url) : '') || '');
  const [note, setNote] = useState(shared?.text ?? '');
  const [type, setType] = useState(shared?.url ? 'paper' : 'note');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ident = shared?.url ? parseIdent(shared.url) : null;
  if (!open || !shared || !ready) return null;

  const close = () => {
    clear();
    setOpen(false);
  };
  const save = async () => {
    // Makale bağlantısı (DOI/arXiv): başlık, yazarlar, yıl, özet kendiliğinden
    if (type === 'paper' && ident) {
      setBusy(true);
      try {
        const r = await importPaper(shared.url);
        clear();
        setOpen(false);
        go(`/n/${r.note.id}`);
        return;
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setBusy(false);
        return;
      }
    }
    const ty = typeOf(type);
    const urlKey = ty.props.find((p) => p.kind === 'url' && (p.key === 'url' || p.key === 'doi'))?.key;
    const content = [
      ...(note.trim() ? note.trim().split(/\n+/).map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) : []),
      ...(shared.url ? [{ type: 'bookmark', attrs: { url: shared.url, title: shared.title || '' } }] : []),
    ];
    const n = createNote(type, title.trim(), urlKey && shared.url ? { [urlKey]: shared.url } : {}, content.length ? { type: 'doc', content } : null);
    clear();
    setOpen(false);
    go(`/n/${n.id}`);
  };

  return (
    <div className="modal-back">
      <div className="modal capture" role="dialog" aria-label={t('capture.quick.aria')}>
        <h3>{t('capture.quick.title')}</h3>
        {shared.url && <div className="capture-url muted small">🔗 {shared.url}</div>}
        <label className="capture-field">
          <span>{t('capture.quick.titleField')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('capture.quick.titleField')} autoFocus />
        </label>
        <label className="capture-field">
          <span>{t('capture.quick.collection')}</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.filter((ty) => !['daily', 'word'].includes(ty.id)).map((ty) => <option key={ty.id} value={ty.id}>{ty.icon} {ty.label}</option>)}
          </select>
        </label>
        <label className="capture-field">
          <span>{t('capture.quick.note')}</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('capture.quick.notePlaceholder')} />
        </label>
        {type === 'paper' && ident && <p className="muted small">{t('capture.quick.ident', { kind: ident.kind === 'arxiv' ? 'arXiv' : 'DOI' })}</p>}
        {err && <p className="err small">{err}</p>}
        <div className="capture-actions">
          <button type="button" className="btn" onClick={close}>{t('common.cancel')}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? t('capture.quick.fetching') : t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}
