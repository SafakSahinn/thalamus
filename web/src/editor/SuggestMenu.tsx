import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface MenuItem {
  key: string;
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
}

export interface SuggestMenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

/** [[ ve / menüleri için ortak açılır liste */
export const SuggestMenu = forwardRef<SuggestMenuHandle, { items: MenuItem[]; empty?: string }>(
  function SuggestMenu({ items, empty }, ref) {
    const [sel, setSel] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => setSel(0), [items]);
    useEffect(() => {
      listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    }, [sel]);

    useImperativeHandle(ref, () => ({
      onKeyDown(e) {
        if (!items.length) return false;
        if (e.key === 'ArrowDown') {
          setSel((s) => (s + 1) % items.length);
          return true;
        }
        if (e.key === 'ArrowUp') {
          setSel((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          items[sel]?.run();
          return true;
        }
        return false;
      },
    }), [items, sel]);

    // Eşleşme yoksa ve özel bir mesaj verilmemişse menüyü gösterme
    if (!items.length && !empty) return <div ref={listRef} hidden />;
    return (
      <div className="suggest" ref={listRef}>
        {items.length === 0 && <div className="suggest-empty">{empty ?? 'Sonuç yok'}</div>}
        {items.map((it, i) => (
          <button
            key={it.key}
            className={i === sel ? 'sel' : ''}
            onMouseEnter={() => setSel(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              it.run();
            }}
          >
            <span className="ic">{it.icon}</span>
            <span className="lb">{it.label}</span>
            {it.hint && <span className="hint">{it.hint}</span>}
          </button>
        ))}
      </div>
    );
  },
);
