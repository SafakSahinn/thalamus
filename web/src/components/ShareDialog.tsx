import { useState } from 'react';
import { cloud } from '../lib/google';
import { publishShare, shareUrl, unpublishShare } from '../lib/share';
import { useStore } from '../lib/store';
import type { Note } from '../lib/types';

export default function ShareDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const account = useStore((s) => s.account);
  const live = useStore((s) => s.notes[note.id]) ?? note;
  const id = live.props.__share as string | undefined;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl(id!));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal prompt share-dialog" role="dialog" aria-label="Paylaş">
        <div className="row"><h3>🌐 Herkese açık paylaş</h3><span className="spacer" /><button className="iconbtn" onClick={onClose}>×</button></div>
        {!cloud || !account ? (
          <p className="muted">Paylaşmak için Google ile giriş yapmış olman gerekiyor.</p>
        ) : id ? (
          <>
            <p>Bu not bağlantıya sahip olan herkese açık. Bağlantıyı açan kişi giriş yapmadan notu (salt okunur) görebilir.</p>
            <div className="row">
              <input className="grow share-link" readOnly value={shareUrl(id)} onFocus={(e) => e.target.select()} />
              <button className="btn" onClick={() => void copy()}>{copied ? 'Kopyalandı ✓' : 'Kopyala'}</button>
            </div>
            <p className="muted small">Notu düzenledikçe paylaşılan sayfa birkaç saniye içinde güncellenir (not bu cihazda açıkken). Bağlantı verdiğin diğer notlar paylaşılmaz; yalnızca adları görünür.</p>
            <div className="row end">
              <a className="btn ghost" href={shareUrl(id)} target="_blank" rel="noopener noreferrer">Sayfayı aç ↗</a>
              <button className="btn danger" disabled={busy} onClick={() => void run(() => unpublishShare(live))}>{busy ? '…' : 'Paylaşımı kaldır'}</button>
            </div>
          </>
        ) : (
          <>
            <p>Notun bir kopyası herkese açık bir bağlantıyla yayınlanır. Bağlantıyı bilen herkes notu görebilir, düzenleyemez.</p>
            <ul className="muted small">
              <li>Yayınlanan kopya Thalamus sunucusunda tutulur; paylaşımı kaldırınca silinir.</li>
              <li>Nottaki Drive görselleri ve dosyaları “bağlantıya sahip olan görebilir” yapılır.</li>
              <li>Yalnızca bu cihazda saklanan dosyalar paylaşılmaz. Bağlantı verdiğin diğer notlar paylaşılmaz.</li>
            </ul>
            <div className="row end">
              <button className="btn ghost" onClick={onClose}>Vazgeç</button>
              <button className="btn primary" disabled={busy} onClick={() => void run(() => publishShare(live))}>{busy ? 'Yayınlanıyor…' : 'Bağlantıyla paylaş'}</button>
            </div>
          </>
        )}
        {err && <p className="err small">{err}</p>}
      </div>
    </div>
  );
}
