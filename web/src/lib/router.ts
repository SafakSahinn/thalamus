import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'note'; id: string }
  | { name: 'collection'; type: string; edit?: boolean }
  | { name: 'graph' }
  | { name: 'calendar' }
  | { name: 'pdf'; id: string }
  | { name: 'daily'; date?: string }
  | { name: 'dictionary' }
  | { name: 'settings' }
  | { name: 'import' }
  | { name: 'trash' }
  | { name: 'legal'; kind: 'privacy' | 'terms' }
  | { name: 'shared'; id: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'n': return parts[1] ? { name: 'note', id: parts[1] } : { name: 'home' };
    case 'c': return parts[1] ? { name: 'collection', type: parts[1], edit: parts[2] === 'edit' } : { name: 'home' };
    case 'graph': return { name: 'graph' };
    case 'takvim': return { name: 'calendar' };
    case 'oku': return parts[1] ? { name: 'pdf', id: parts[1] } : { name: 'home' };
    case 'daily': return { name: 'daily', date: parts[1] };
    case 'dictionary': return { name: 'dictionary' };
    case 'settings': return { name: 'settings' };
    case 'import': return { name: 'import' };
    case 'trash': return { name: 'trash' };
    case 'p': return parts[1] ? { name: 'shared', id: parts[1] } : { name: 'home' };
    case 'gizlilik': return { name: 'legal', kind: 'privacy' };
    case 'kosullar': return { name: 'legal', kind: 'terms' };
    default: return { name: 'home' };
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);

export const go = (path: string) => {
  location.hash = path.startsWith('#') ? path : `#${path}`;
};

export const noteHref = (id: string) => `#/n/${id}`;
