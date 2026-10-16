import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { clearFind, findState, replaceAll, replaceCurrent, setQuery, step } from './FindReplace';

/** Ctrl+F ile açılan not içi bul / değiştir çubuğu */
export default function FindBar({ editor, onClose, initial }: { editor: Editor; onClose: () => void; initial: string }) {
  const [q, setQ] = useState(initial);
  const [rep, setRep] = useState('');
  const [cs, setCs] = useState(false);
  const [showRep, setShowRep] = useState(false);
  const [msg, setMsg] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const { count, current } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = findState(e);
      return { count: s?.matches.length ?? 0, current: s?.current ?? 0 };
    },
  });

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    if (initial) setQuery(editor, initial, cs);
    return () => clearFind(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (v: string, c = cs) => {
    setQ(v);
    setMsg('');
    setQuery(editor, v, c);
  };
  const close = () => {
    onClose();
    editor.commands.focus();
  };

  return (
    <div className="findbar" role="search">
      <div className="findrow">
        <button className="iconbtn" title="Değiştir" onClick={() => setShowRep(!showRep)}>{showRep ? '▾' : '▸'}</button>
        <input
          ref={ref}
          value={q}
          placeholder="Bu notta bul…"
          onChange={(e) => update(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); step(editor, e.shiftKey ? -1 : 1); }
            if (e.key === 'Escape') close();
          }}
        />
        <span className="muted small count">{q ? (count ? `${current + 1}/${count}` : 'yok') : ''}</span>
        <button className={`iconbtn ${cs ? 'on' : ''}`} title="Büyük/küçük harf duyarlı" onClick={() => { setCs(!cs); update(q, !cs); }}>Aa</button>
        <button className="iconbtn" title="Önceki (Shift+Enter)" disabled={!count} onClick={() => step(editor, -1)}>↑</button>
        <button className="iconbtn" title="Sonraki (Enter)" disabled={!count} onClick={() => step(editor, 1)}>↓</button>
        <button className="iconbtn" title="Kapat (Esc)" onClick={close}>×</button>
      </div>
      {showRep && (
        <div className="findrow">
          <span className="iconbtn" />
          <input
            value={rep}
            placeholder="Şununla değiştir…"
            onChange={(e) => setRep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); replaceCurrent(editor, rep); }
              if (e.key === 'Escape') close();
            }}
          />
          <button className="btn small" disabled={!count} onClick={() => replaceCurrent(editor, rep)}>Değiştir</button>
          <button className="btn small" disabled={!count} onClick={() => setMsg(`${replaceAll(editor, rep)} yer değiştirildi`)}>Tümü</button>
        </div>
      )}
      {msg && <div className="muted small">{msg}</div>}
    </div>
  );
}
