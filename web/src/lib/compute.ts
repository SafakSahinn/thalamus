// Alan değerleri: kayıtlı değer ya da hesaplanan (formül, toplama, oluşturulma/düzenlenme zamanı).

import { t } from '../i18n';
import { evaluate, FormulaError, toDate, toNum, toStr } from './formula';
import { norm } from './links';
import { builtinSourceLabel, relationIds, typeOf, type Note, type PropDef } from './types';

const MAX_DEPTH = 4;

// Ters ilişki dizini: notlar değişmedikçe yeniden kurulmaz
const backCache = new WeakMap<Record<string, Note>, Map<string, Map<string, string[]>>>();

/** "type" tipindeki notlardan "key" alanında bu nota bağlananlar */
export function backIds(note: Note, back: { type: string; key: string }, notes: Record<string, Note>): string[] {
  let byKey = backCache.get(notes);
  if (!byKey) backCache.set(notes, (byKey = new Map()));
  const k = `${back.type}.${back.key}`;
  let idx = byKey.get(k);
  if (!idx) {
    idx = new Map();
    for (const n of Object.values(notes)) {
      if (n.type !== back.type || n.deleted_at) continue;
      for (const id of relationIds(n.props[back.key])) idx.set(id, [...(idx.get(id) ?? []), n.id]);
    }
    byKey.set(k, idx);
  }
  return idx.get(note.id) ?? [];
}

function findProp(note: Note, name: string): PropDef | undefined {
  const props = typeOf(note.type).props;
  const n = norm(name);
  return props.find((p) => p.key === name) ?? props.find((p) => norm(p.label) === n)
    ?? props.find((p) => norm(builtinSourceLabel(note.type, p.key) ?? '') === n);
}

/** Bir notun alan değeri (hesaplananlar dahil). Formül hatasında { error } döner. */
export function propValue(note: Note, def: PropDef, notes: Record<string, Note>, depth = 0): unknown {
  if (def.back) return backIds(note, def.back, notes);
  switch (def.kind) {
    case 'created':
      return note.created_at;
    case 'updated':
      return note.updated_at;
    case 'formula': {
      if (!def.formula?.trim()) return '';
      if (depth > MAX_DEPTH) return { error: t('schema.formula.deep') };
      try {
        return evaluate(def.formula, {
          prop: (name) => {
            if (norm(name) === 'ad' || norm(name) === 'baslik' || name === 'title' || norm(name) === norm(t('schema.editor.nameField'))) return note.title;
            const p = findProp(note, name);
            if (!p) throw new FormulaError(t('schema.formula.noField', { name }));
            const v = propValue(note, p, notes, depth + 1);
            if (p.kind === 'relation') return relationIds(v).map((id) => notes[id]?.title ?? '').filter(Boolean);
            if (v && typeof v === 'object' && 'error' in (v as object)) throw new FormulaError((v as { error: string }).error);
            return v ?? '';
          },
        });
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) };
      }
    }
    case 'rollup': {
      const r = def.rollup;
      if (!r) return '';
      const rel = typeOf(note.type).props.find((p) => p.key === r.relation);
      if (!rel) return { error: t('fmt.relationMissing') };
      const targets = relationIds(propValue(note, rel, notes, depth + 1)).map((id) => notes[id]).filter((n) => n && !n.deleted_at);
      const values = targets.map((t) => {
        if (r.prop === '__title') return t.title;
        const p = typeOf(t.type).props.find((x) => x.key === r.prop);
        return p ? propValue(t, p, notes, depth + 1) : undefined;
      });
      return rollup(values, r.fn);
    }
    default:
      return note.props[def.key];
  }
}

function rollup(values: unknown[], fn: string): unknown {
  const present = values.filter((v) => !(v == null || v === '' || (Array.isArray(v) && !v.length)));
  const nums = present.map(toNum);
  switch (fn) {
    case 'count': return values.length;
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : '';
    case 'min': return nums.length ? Math.min(...nums) : '';
    case 'max': return nums.length ? Math.max(...nums) : '';
    case 'checked': return values.filter(Boolean).length;
    case 'percent_checked': return values.length ? `${Math.round((values.filter(Boolean).length / values.length) * 100)}%` : '';
    case 'earliest':
    case 'latest': {
      const ds = present.map(toDate).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime());
      if (!ds.length) return '';
      return toStr(fn === 'earliest' ? ds[0] : ds[ds.length - 1]);
    }
    default:
      return present.map(toStr).join(', ');
  }
}

const ROLLUP_IDS = ['list', 'count', 'sum', 'avg', 'min', 'max', 'checked', 'percent_checked', 'earliest', 'latest'] as const;
export const ROLLUP_FNS: { id: string; readonly label: string }[] = ROLLUP_IDS.map((id) => ({ id, get label() { return t(`schema.rollup.${id}`); } }));

/** Görüntülemek için metne çevir */
export function showValue(v: unknown): string {
  if (v && typeof v === 'object' && 'error' in (v as object)) return `⚠ ${(v as { error: string }).error}`;
  // Dosyalar alanı: dosya adları
  if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && 'src' in x)) return v.map((x) => (x as { name: string }).name).join(', ');
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  return toStr(v);
}

export const isComputed = (def: PropDef) => ['formula', 'rollup', 'created', 'updated'].includes(def.kind);
