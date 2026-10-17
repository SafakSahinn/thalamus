// Görünüm mantığı: filtre, sıralama, gruplama (arayüzden bağımsız, test edilebilir).

import { propValue, showValue } from './compute';
import { displayTitle } from './format';
import { toDate, toNum } from './formula';
import { norm } from './links';
import { relationIds, typeOf, type Note, type PropDef, type SavedView, type TypeDef, type ViewFilter, type ViewKind } from './types';

export interface OpDef {
  id: string;
  label: string;
  /** Değer girişi gerekmiyor */
  noValue?: boolean;
}

const EMPTY_OPS: OpDef[] = [
  { id: 'empty', label: 'boş', noValue: true },
  { id: 'not_empty', label: 'boş değil', noValue: true },
];

export function opsFor(def: PropDef | 'title'): OpDef[] {
  const kind = def === 'title' ? 'text' : def.kind;
  if (def !== 'title' && def.statusGroups) {
    return [
      { id: 'is', label: 'şu olan' }, { id: 'is_not', label: 'şu olmayan' },
      { id: 'not_done', label: 'bitmemiş', noValue: true }, { id: 'done', label: 'bitmiş', noValue: true }, ...EMPTY_OPS,
    ];
  }
  switch (kind) {
    case 'files':
      return EMPTY_OPS;
    case 'number':
    case 'rating':
    case 'uid':
      return [
        { id: 'eq', label: '=' }, { id: 'neq', label: '≠' }, { id: 'gt', label: '>' }, { id: 'lt', label: '<' },
        { id: 'gte', label: '≥' }, { id: 'lte', label: '≤' }, ...EMPTY_OPS,
      ];
    case 'select':
      return [{ id: 'is', label: 'şu olan' }, { id: 'is_not', label: 'şu olmayan' }, ...EMPTY_OPS];
    case 'multiselect':
      return [{ id: 'has', label: 'içeren' }, { id: 'not_has', label: 'içermeyen' }, ...EMPTY_OPS];
    case 'date':
    case 'created':
    case 'updated':
      return [
        { id: 'on', label: 'şu gün' }, { id: 'before', label: 'öncesi' }, { id: 'after', label: 'sonrası' },
        { id: 'past_week', label: 'son 7 gün', noValue: true }, { id: 'next_week', label: 'gelecek 7 gün', noValue: true },
        { id: 'this_month', label: 'bu ay', noValue: true }, ...EMPTY_OPS,
      ];
    case 'checkbox':
      return [{ id: 'checked', label: 'işaretli', noValue: true }, { id: 'unchecked', label: 'işaretsiz', noValue: true }];
    case 'relation':
      return [{ id: 'has', label: 'şunu içeren' }, ...EMPTY_OPS];
    default:
      return [
        { id: 'contains', label: 'içeren' }, { id: 'not_contains', label: 'içermeyen' }, { id: 'is', label: 'tam olarak' }, ...EMPTY_OPS,
      ];
  }
}

const day = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

function isEmpty(v: unknown) {
  return v == null || v === '' || v === false || (Array.isArray(v) && !v.length);
}

/** Notun bir alana göre değeri ("title" özel anahtar) */
export function valueOf(n: Note, key: string, notes: Record<string, Note>): unknown {
  if (key === 'title') return displayTitle(n);
  if (key === '__updated') return n.updated_at;
  if (key === '__created') return n.created_at;
  const def = typeOf(n.type).props.find((p) => p.key === key);
  return def ? propValue(n, def, notes) : n.props[key];
}

export function matches(n: Note, f: ViewFilter, t: TypeDef, notes: Record<string, Note>, now = new Date()): boolean {
  const def = f.key === 'title' ? 'title' : t.props.find((p) => p.key === f.key);
  if (!def) return true;
  const v = valueOf(n, f.key, notes);
  const val = f.value;
  switch (f.op) {
    case 'empty': return isEmpty(v);
    case 'not_empty': return !isEmpty(v);
    case 'checked': return Boolean(v);
    case 'unchecked': return !v;
    case 'contains': return norm(showValue(v)).includes(norm(String(val ?? '')));
    case 'not_contains': return !norm(showValue(v)).includes(norm(String(val ?? '')));
    case 'is': return norm(showValue(v)) === norm(String(val ?? ''));
    case 'is_not': return norm(showValue(v)) !== norm(String(val ?? ''));
    case 'has': {
      if (def !== 'title' && def.kind === 'relation') return relationIds(v).includes(String(val));
      return Array.isArray(v) && v.map(String).includes(String(val));
    }
    case 'done':
    case 'not_done': {
      const g = def !== 'title' && def.statusGroups && typeof v === 'string' ? def.statusGroups[v] : undefined;
      return f.op === 'done' ? g === 'done' : g !== 'done';
    }
    case 'not_has': return !(Array.isArray(v) && v.map(String).includes(String(val)));
    case 'eq': return !isEmpty(v) && toNum(v) === toNum(val);
    case 'neq': return toNum(v) !== toNum(val);
    case 'gt': return !isEmpty(v) && toNum(v) > toNum(val);
    case 'lt': return !isEmpty(v) && toNum(v) < toNum(val);
    case 'gte': return !isEmpty(v) && toNum(v) >= toNum(val);
    case 'lte': return !isEmpty(v) && toNum(v) <= toNum(val);
    case 'on':
    case 'before':
    case 'after': {
      const a = toDate(v), b = toDate(val);
      if (!a || !b) return false;
      return f.op === 'on' ? day(a) === day(b) : f.op === 'before' ? day(a) < day(b) : day(a) > day(b);
    }
    case 'past_week':
    case 'next_week': {
      const a = toDate(v);
      if (!a) return false;
      const diff = (day(a) - day(now)) / 864e5;
      return f.op === 'past_week' ? diff <= 0 && diff >= -7 : diff >= 0 && diff <= 7;
    }
    case 'this_month': {
      const a = toDate(v);
      return Boolean(a && a.getFullYear() === now.getFullYear() && a.getMonth() === now.getMonth());
    }
  }
  return true;
}

function cmpValues(a: unknown, b: unknown): number {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1; // boşlar her zaman sonda
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const da = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) ? toDate(a) : null;
  const db = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b) ? toDate(b) : null;
  if (da && db) return da.getTime() - db.getTime();
  const na = Number(showValue(a)), nb = Number(showValue(b));
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return showValue(a).localeCompare(showValue(b), 'tr', { numeric: true });
}

export function applyView(list: Note[], view: SavedView, t: TypeDef, notes: Record<string, Note>, search = ''): Note[] {
  const q = norm(search);
  const test = (n: Note) => (f: ViewFilter) => matches(n, f, t, notes);
  let rows = list.filter((n) => (!view.filters.length ? true : view.filterMode === 'or' ? view.filters.some(test(n)) : view.filters.every(test(n))));
  if (q) rows = rows.filter((n) => norm(displayTitle(n)).includes(q) || norm(n.text).includes(q));
  const sort = view.sort.length ? view.sort : [{ key: '__updated', dir: 'desc' as const }];
  // Seçim alanında seçenek sırasına göre sırala (Notion gibi)
  const optIndex = (key: string, v: unknown) => {
    const def = t.props.find((p) => p.key === key);
    if (def?.kind !== 'select' || typeof v !== 'string') return null;
    const i = def.options?.indexOf(v) ?? -1;
    return i < 0 ? 999 : i;
  };
  return [...rows].sort((a, b) => {
    for (const s of sort) {
      const va = valueOf(a, s.key, notes), vb = valueOf(b, s.key, notes);
      const oa = optIndex(s.key, va), ob = optIndex(s.key, vb);
      let c = oa !== null && ob !== null ? oa - ob : cmpValues(va, vb);
      if (s.dir === 'desc' && !(isEmpty(va) !== isEmpty(vb))) c = -c;
      if (c) return c;
    }
    return 0;
  });
}

export interface Group {
  key: string;
  label: string;
  notes: Note[];
}

/** Seçim / çoklu seçim / onay kutusu / bağlantı alanına göre gruplar (seçenek sırasıyla, sonda "Boş") */
export function groupNotes(rows: Note[], def: PropDef, notes: Record<string, Note>): Group[] {
  const order: string[] = def.kind === 'select' || def.kind === 'multiselect' ? [...(def.options ?? [])] : def.kind === 'checkbox' ? ['true', 'false'] : [];
  const map = new Map<string, Note[]>(order.map((o) => [o, []]));
  const push = (k: string, n: Note) => {
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(n);
  };
  for (const n of rows) {
    const v = def.back ? propValue(n, def, notes) : n.props[def.key];
    if (def.kind === 'checkbox') push(v ? 'true' : 'false', n);
    else if (def.kind === 'relation' || def.kind === 'multiselect') {
      const ids = def.kind === 'relation' ? relationIds(v) : Array.isArray(v) ? (v as string[]) : [];
      if (!ids.length) push('', n);
      else ids.forEach((id) => push(id, n));
    } else push(typeof v === 'string' ? v : v == null ? '' : String(v), n);
  }
  const label = (k: string) => {
    if (k === '') return 'Boş';
    if (def.kind === 'checkbox') return k === 'true' ? '✓ İşaretli' : 'İşaretsiz';
    if (def.kind === 'relation') return notes[k] ? displayTitle(notes[k]) : '?';
    return k;
  };
  const out = [...map].filter(([k]) => k !== '').map(([k, list]) => ({ key: k, label: label(k), notes: list }));
  const blank = map.get('');
  if (blank?.length || def.kind === 'select') out.push({ key: '', label: 'Boş', notes: blank ?? [] });
  return out;
}

const vid = () => Math.random().toString(36).slice(2, 10);

/** Koleksiyon için varsayılan görünümler (kayıtlı görünüm yoksa) */
export function defaultViews(t: TypeDef): SavedView[] {
  const views: SavedView[] = [];
  const firstSelect = t.props.find((p) => p.kind === 'select');
  const firstDate = t.props.find((p) => p.kind === 'date');
  const base = { filters: [], sort: t.sort ? [{ key: t.sort, dir: 'desc' as const }] : [] };
  if (t.cover) views.push({ id: vid(), name: 'Galeri', kind: 'cards', ...base });
  views.push({ id: vid(), name: 'Tablo', kind: 'table', ...base });
  if (firstSelect) views.push({ id: vid(), name: 'Pano', kind: 'board', groupBy: firstSelect.key, ...base });
  if (firstDate) views.push({ id: vid(), name: 'Takvim', kind: 'calendar', dateKey: firstDate.key, ...base });
  return views;
}

export const VIEW_KINDS: { id: ViewKind; label: string; icon: string }[] = [
  { id: 'table', label: 'Tablo', icon: '☰' },
  { id: 'cards', label: 'Galeri', icon: '▦' },
  { id: 'board', label: 'Pano (kanban)', icon: '▥' },
  { id: 'calendar', label: 'Takvim', icon: '📅' },
  { id: 'list', label: 'Liste', icon: '≡' },
  { id: 'timeline', label: 'Zaman çizelgesi', icon: '▤' },
  { id: 'chart', label: 'Grafik', icon: '📊' },
];

export const newViewId = vid;
