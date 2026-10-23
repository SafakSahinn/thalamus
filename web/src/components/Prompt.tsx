import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

// Tarayıcının window.prompt'u yerine uygulama içi küçük giriş penceresi.

interface PromptReq {
  title: string;
  value: string;
  multiline?: boolean;
  hint?: string;
  resolve: (v: string | null) => void;
}

const usePrompt = create<{ req: PromptReq | null }>(() => ({ req: null }));

export function promptText(title: string, value = '', opts: { multiline?: boolean; hint?: string } = {}) {
  return new Promise<string | null>((resolve) => {
    usePrompt.setState({ req: { title, value, ...opts, resolve } });
  });
}

export function PromptHost() {
  const req = usePrompt((s) => s.req);
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => {
    if (req) {
      setVal(req.value);
      setTimeout(() => ref.current?.select(), 0);
    }
  }, [req]);

  if (!req) return null;
  const close = (v: string | null) => {
    usePrompt.setState({ req: null });
    req.resolve(v);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close(null);
    if (e.key === 'Enter' && (!req.multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      close(val);
    }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <div className="modal prompt" role="dialog" aria-label={req.title}>
        <h3>{req.title}</h3>
        {req.multiline ? (
          <textarea ref={ref} value={val} rows={4} onChange={(e) => setVal(e.target.value)} onKeyDown={onKey} />
        ) : (
          <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={onKey} />
        )}
        {req.hint && <p className="muted small">{req.hint}</p>}
        <div className="row end">
          <button className="btn ghost" onClick={() => close(null)}>{t('common.cancel')}</button>
          <button className="btn primary" onClick={() => close(val)}>{t('common.ok')}</button>
        </div>
      </div>
    </div>
  );
}
