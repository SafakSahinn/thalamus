import { useMemo, useState } from 'react';
import { displayTitle, noteIcon } from '../lib/format';
import type { Route } from '../lib/router';
import { useIndex, useStore, type SyncStatus } from '../lib/store';
import { relationIds, TYPES, type Note } from '../lib/types';
import { createCollection } from '../lib/schema';
import { go } from '../lib/router';
import { openPalette } from './CommandPalette';
import { openShortcuts } from './Shortcuts';
import { newCollectionFlow } from './TypeEditor';

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'Yalnızca bu cihazda',
  idle: 'Eşitlendi',
  syncing: 'Eşitleniyor…',
  offline: 'Çevrimdışı',
  error: 'Eşitleme hatası',
};

export function SyncBadge() {
  const sync = useStore((s) => s.sync);
  const label = sync.pending && sync.status !== 'syncing' ? `${sync.pending} değişiklik bekliyor` : SYNC_LABEL[sync.status];
  return (
    <a href="#/settings" className={`sync ${sync.status} ${sync.pending ? 'pending' : ''}`} title={sync.error ?? label}>
      <i /> {label}
    </a>
  );
}

const OPEN_KEY = 'treeOpen';
const loadOpen = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
};

/** Notion tarzı sayfa ağacı: üst sayfalar ve açılıp kapanan alt sayfaları */
function PageTree({ active }: { active: (href: string) => string }) {
  const { alive } = useIndex();
  const [open, setOpen] = useState(loadOpen);
  const [all, setAll] = useState(false);
  const { roots, kids } = useMemo(() => {
    const kids = new Map<string, Note[]>();
    const ids = new Set(alive.map((n) => n.id));
    for (const n of alive) {
      const par = relationIds(n.props.parent).find((x) => ids.has(x));
      if (par) kids.set(par, [...(kids.get(par) ?? []), n]);
    }
    const roots = alive.filter((n) => n.type === 'note' && !relationIds(n.props.parent).some((x) => ids.has(x)));
    const byTitle = (a: Note, b: Note) => a.title.localeCompare(b.title, 'tr');
    roots.sort(byTitle);
    kids.forEach((v) => v.sort(byTitle));
    return { roots, kids };
  }, [alive]);
  const toggle = (id: string) => {
    const s = new Set(open);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setOpen(s);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...s]));
    } catch {
      /* yok say */
    }
  };
  const row = (n: Note, depth: number, seen: Set<string>): React.ReactNode => {
    const ch = (kids.get(n.id) ?? []).filter((c) => !seen.has(c.id));
    const isOpen = open.has(n.id);
    return (
      <div key={n.id}>
        <div className="tree-row">
          <button type="button" className={`tree-toggle ${ch.length ? '' : 'empty'}`} onClick={() => toggle(n.id)} aria-label="Alt sayfaları aç/kapat">{isOpen ? '▾' : '▸'}</button>
          <a href={`#/n/${n.id}`} className={active(`#/n/${n.id}`)}>{noteIcon(n)} {displayTitle(n)}</a>
        </div>
        {isOpen && ch.length > 0 && depth < 8 && (
          <div className="tree-kids">{ch.map((c) => row(c, depth + 1, new Set([...seen, c.id])))}</div>
        )}
      </div>
    );
  };
  if (!roots.length) return null;
  const shown = all ? roots : roots.slice(0, 12);
  return (
    <>
      <div className="side-h">Sayfalar</div>
      {shown.map((n) => row(n, 0, new Set([n.id])))}
      {roots.length > 12 && (
        <button type="button" className="searchbtn" onClick={() => setAll(!all)}>{all ? 'Daha az göster' : `+ ${roots.length - 12} sayfa daha`}</button>
      )}
    </>
  );
}

const collHref = (id: string) => (id === 'word' ? '#/dictionary' : id === 'daily' ? '#/daily' : `#/c/${id}`);

export default function Sidebar({ route, onNav }: { route: Route; onNav: () => void }) {
  const { alive } = useIndex();
  const pinned = useMemo(() => alive.filter((n) => n.pinned).sort((a, b) => a.title.localeCompare(b.title, 'tr')), [alive]);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of alive) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [alive]);
  const active = (href: string) => {
    const h = location.hash || '#/';
    return h === href || (href !== '#/' && h.startsWith(href + '/')) ? 'active' : '';
  };
  void route;

  return (
    <nav className="sidebar" onClick={(e) => (e.target as HTMLElement).closest('a') && onNav()}>
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
        <span>Thalamus</span>
      </div>
      <button className="searchbtn" onClick={() => { onNav(); openPalette(); }}>
        🔍 Ara / oluştur <kbd>Ctrl K</kbd>
      </button>
      <a href="#/" className={active('#/')}>🏠 Ana sayfa</a>
      <a href="#/daily" className={active('#/daily')}>📅 Günlük</a>
      <a href="#/graph" className={active('#/graph')}>🕸 Bağlantı haritası</a>

      {pinned.length > 0 && (
        <>
          <div className="side-h">Sabitlenenler</div>
          {pinned.map((n) => (
            <a key={n.id} href={`#/n/${n.id}`} className={active(`#/n/${n.id}`)}>
              {noteIcon(n)} {displayTitle(n)}
            </a>
          ))}
        </>
      )}

      <PageTree active={active} />

      <div className="side-h">Koleksiyonlar</div>
      {TYPES.filter((t) => t.id !== 'daily').map((t) => (
        <a key={t.id} href={collHref(t.id)} className={active(collHref(t.id))}>
          {t.icon} {t.plural}
          <span className="cnt">{counts.get(t.id) ?? ''}</span>
        </a>
      ))}
      <button type="button" className="searchbtn" onClick={async () => {
        const id = await newCollectionFlow((label) => createCollection(label));
        if (id) { onNav(); go(`/c/${id}/edit`); }
      }}>＋ Yeni koleksiyon</button>

      <div className="side-foot">
        <a href="#/import" className={active('#/import')}>⬇ Notion’dan aktar</a>
        <a href="#/trash" className={active('#/trash')}>🗑 Çöp kutusu</a>
        <a href="#/settings" className={active('#/settings')}>⚙ Ayarlar</a>
        <button type="button" className="searchbtn" onClick={() => { onNav(); openShortcuts(); }}>⌨ Kısayollar <kbd>Ctrl /</kbd></button>
        <SyncBadge />
      </div>
    </nav>
  );
}
