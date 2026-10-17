import { useState } from 'react';
import { go } from '../lib/router';
import { createNote, useStore } from '../lib/store';
import { TYPES, typeOf } from '../lib/types';

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
  if (!open || !shared || !ready) return null;

  const close = () => {
    clear();
    setOpen(false);
  };
  const save = () => {
    const t = typeOf(type);
    const urlKey = t.props.find((p) => p.kind === 'url' && (p.key === 'url' || p.key === 'doi'))?.key;
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
      <div className="modal capture" role="dialog" aria-label="Thalamus’a kaydet">
        <h3>📥 Thalamus’a kaydet</h3>
        {shared.url && <div className="capture-url muted small">🔗 {shared.url}</div>}
        <label className="capture-field">
          <span>Başlık</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık" autoFocus />
        </label>
        <label className="capture-field">
          <span>Koleksiyon</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.filter((t) => !['daily', 'word'].includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
        </label>
        <label className="capture-field">
          <span>Not</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İstersen bir not ekle…" />
        </label>
        <div className="capture-actions">
          <button type="button" className="btn" onClick={close}>Vazgeç</button>
          <button type="button" className="btn primary" onClick={save}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}
