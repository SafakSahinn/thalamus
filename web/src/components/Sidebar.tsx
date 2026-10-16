import { useMemo } from 'react';
import { displayTitle } from '../lib/format';
import type { Route } from '../lib/router';
import { useIndex, useStore, type SyncStatus } from '../lib/store';
import { TYPES, typeOf } from '../lib/types';
import { openPalette } from './CommandPalette';

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
              {typeOf(n.type).icon} {displayTitle(n)}
            </a>
          ))}
        </>
      )}

      <div className="side-h">Koleksiyonlar</div>
      {TYPES.filter((t) => t.id !== 'daily').map((t) => (
        <a key={t.id} href={collHref(t.id)} className={active(collHref(t.id))}>
          {t.icon} {t.plural}
          <span className="cnt">{counts.get(t.id) ?? ''}</span>
        </a>
      ))}

      <div className="side-foot">
        <a href="#/import" className={active('#/import')}>⬇ Notion’dan aktar</a>
        <a href="#/trash" className={active('#/trash')}>🗑 Çöp kutusu</a>
        <a href="#/settings" className={active('#/settings')}>⚙ Ayarlar</a>
        <SyncBadge />
      </div>
    </nav>
  );
}
