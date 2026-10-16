import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { displayTitle } from '../lib/format';
import { go } from '../lib/router';
import { searchNotes } from '../lib/search';
import { createNote, useIndex } from '../lib/store';
import { TYPES, typeOf } from '../lib/types';

export const usePalette = create<{ open: boolean }>(() => ({ open: false }));
export const openPalette = () => usePalette.setState({ open: true });

interface Item {
  key: string;
  icon: string;
  label: string;
  hint?: string;
  snippet?: string;
  run: () => void;
}

export default function CommandPalette() {
  const open = usePalette((s) => s.open);
  const { alive } = useIndex();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        usePalette.setState({ open: !usePalette.getState().open });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const close = () => usePalette.setState({ open: false });

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const found = searchNotes(alive, q, { text: true, limit: q ? 30 : 12 });
    const out: Item[] = found.map((n) => {
      let snippet: string | undefined;
      if (q) {
        const i = n.text.toLocaleLowerCase('tr').indexOf(q.toLocaleLowerCase('tr'));
        if (i >= 0) snippet = (i > 30 ? '…' : '') + n.text.slice(Math.max(0, i - 30), i + 60).replace(/\s+/g, ' ');
      }
      return { key: n.id, icon: typeOf(n.type).icon, label: displayTitle(n), hint: typeOf(n.type).label, snippet, run: () => go(`/n/${n.id}`) };
    });
    if (q.trim()) {
      for (const t of TYPES.filter((x) => x.id !== 'daily')) {
        out.push({ key: `new-${t.id}`, icon: '＋', label: `Yeni ${t.label.toLocaleLowerCase('tr')}: “${q.trim()}”`, run: () => go(`/n/${createNote(t.id, q.trim()).id}`) });
      }
    } else {
      out.push(
        { key: 'go-daily', icon: '📅', label: 'Bugünün günlüğü', run: () => go('/daily') },
        { key: 'go-graph', icon: '🕸', label: 'Bağlantı haritası', run: () => go('/graph') },
        { key: 'go-dict', icon: '🔤', label: 'Sözlük', run: () => go('/dictionary') },
      );
    }
    return out;
  }, [open, q, alive]);

  useEffect(() => {
    listRef.current?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;
  const run = (it: Item) => {
    close();
    it.run();
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal palette">
        <input
          ref={inputRef}
          value={q}
          placeholder="Not ara veya yeni oluştur…"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === 'Enter' && items[sel]) { e.preventDefault(); run(items[sel]); }
          }}
        />
        <div className="palette-list" ref={listRef}>
          {items.map((it, i) => (
            <button key={it.key} className={i === sel ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="ic">{it.icon}</span>
              <span className="lb">
                {it.label}
                {it.snippet && <span className="snip">{it.snippet}</span>}
              </span>
              {it.hint && <span className="hint">{it.hint}</span>}
            </button>
          ))}
        </div>
        <div className="palette-foot muted small">↑↓ seç · Enter aç · Esc kapat · Ctrl+K her yerden açar</div>
      </div>
    </div>
  );
}
