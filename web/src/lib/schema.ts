// Koleksiyon ve alan düzenleme: ayarlardaki TypeSettings üzerinde değişiklik yapar
// (ayarlar Drive ile eşitlendiği için bütün cihazlara yayılır).

import { saveSettings, uid, updateNote, useStore } from './store';
import {
  EMPTY_TYPE_SETTINGS, isBuiltinType, type PropDef, type PropOverride, type TypeDef, type TypeSettings,
} from './types';

const short = () => uid().replace(/-/g, '').slice(0, 8);

function current(): TypeSettings {
  const ts = useStore.getState().settings.types ?? EMPTY_TYPE_SETTINGS;
  return structuredClone({ ...EMPTY_TYPE_SETTINGS, ...ts });
}

async function commit(ts: TypeSettings) {
  const s = useStore.getState().settings;
  await saveSettings({ ...s, types: ts });
}

const isCustomProp = (ts: TypeSettings, typeId: string, key: string) =>
  !isBuiltinType(typeId) || (ts.extra[typeId] ?? []).some((p) => p.key === key);

function propList(ts: TypeSettings, typeId: string): PropDef[] {
  if (isBuiltinType(typeId)) return (ts.extra[typeId] ??= []);
  const t = ts.custom.find((x) => x.id === typeId);
  if (!t) throw new Error('Koleksiyon bulunamadı');
  return t.props;
}

export async function createCollection(label: string, icon = '🗂️', color = '#6b7280'): Promise<string> {
  const ts = current();
  const id = `c_${short()}`;
  const t: TypeDef = {
    id, label, plural: label, icon, color,
    props: [{ key: 'tags', label: 'Etiketler', kind: 'multiselect', options: [], table: true, custom: true }],
  };
  ts.custom.push(t);
  await commit(ts);
  return id;
}

export async function updateCollection(id: string, patch: Partial<Pick<TypeDef, 'label' | 'plural' | 'icon' | 'color' | 'cover'>>) {
  const ts = current();
  if (isBuiltinType(id)) {
    ts.overrides[id] = { ...(ts.overrides[id] ?? {}), ...patch };
  } else {
    const t = ts.custom.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  }
  await commit(ts);
}

/** Kullanıcı koleksiyonunu siler; içindeki notlar "Notlar"a taşınır (silinmez). */
export async function deleteCollection(id: string) {
  if (isBuiltinType(id)) throw new Error('Hazır koleksiyonlar silinemez');
  for (const n of Object.values(useStore.getState().notes)) {
    if (n.type === id) updateNote(n.id, { type: 'note' });
  }
  const ts = current();
  ts.custom = ts.custom.filter((t) => t.id !== id);
  delete ts.overrides[id];
  await commit(ts);
}

export async function addProp(typeId: string, def: Omit<PropDef, 'key' | 'custom'>): Promise<string> {
  const ts = current();
  const key = `p_${short()}`;
  propList(ts, typeId).push({ ...def, key, custom: true });
  await commit(ts);
  return key;
}

export async function updateProp(typeId: string, key: string, patch: Partial<PropDef>) {
  const ts = current();
  if (isCustomProp(ts, typeId, key)) {
    const p = propList(ts, typeId).find((x) => x.key === key);
    if (p) Object.assign(p, patch);
  } else {
    const o = (ts.overrides[typeId] ??= {});
    const po: PropOverride = { ...(o.props?.[key] ?? {}) };
    if (patch.label !== undefined) po.label = patch.label;
    if (patch.options !== undefined) po.options = patch.options;
    if (patch.table !== undefined) po.table = patch.table;
    o.props = { ...(o.props ?? {}), [key]: po };
  }
  await commit(ts);
}

/** Kullanıcı alanı silinir; hazır alan yalnızca gizlenir (veriler notlarda kalır). */
export async function removeProp(typeId: string, key: string) {
  const ts = current();
  if (isCustomProp(ts, typeId, key)) {
    const list = propList(ts, typeId);
    list.splice(list.findIndex((p) => p.key === key), 1);
  } else {
    const o = (ts.overrides[typeId] ??= {});
    o.props = { ...(o.props ?? {}), [key]: { ...(o.props?.[key] ?? {}), hidden: true } };
  }
  await commit(ts);
}

export async function restoreProp(typeId: string, key: string) {
  const ts = current();
  const o = ts.overrides[typeId];
  if (o?.props?.[key]) {
    o.props[key] = { ...o.props[key], hidden: false };
    await commit(ts);
  }
}

export async function reorderProps(typeId: string, keys: string[]) {
  const ts = current();
  ts.overrides[typeId] = { ...(ts.overrides[typeId] ?? {}), order: keys };
  await commit(ts);
}

/** Seçenek adını değiştirir ve o seçeneği kullanan notları da günceller. */
export async function renameOption(typeId: string, def: PropDef, from: string, to: string) {
  const options = (def.options ?? []).map((o) => (o === from ? to : o));
  await updateProp(typeId, def.key, { options });
  for (const n of Object.values(useStore.getState().notes)) {
    if (n.type !== typeId) continue;
    const v = n.props[def.key];
    if (v === from) updateNote(n.id, { props: { ...n.props, [def.key]: to } });
    else if (Array.isArray(v) && v.includes(from)) updateNote(n.id, { props: { ...n.props, [def.key]: v.map((x) => (x === from ? to : x)) } });
  }
}

export const PROP_KINDS: { id: PropDef['kind']; label: string; icon: string }[] = [
  { id: 'text', label: 'Metin', icon: 'Aa' },
  { id: 'longtext', label: 'Uzun metin', icon: '¶' },
  { id: 'number', label: 'Sayı', icon: '#' },
  { id: 'select', label: 'Seçim', icon: '◉' },
  { id: 'multiselect', label: 'Çoklu seçim', icon: '☰' },
  { id: 'date', label: 'Tarih', icon: '📅' },
  { id: 'checkbox', label: 'Onay kutusu', icon: '☑' },
  { id: 'rating', label: 'Puan (yıldız)', icon: '★' },
  { id: 'url', label: 'Bağlantı / dosya', icon: '🔗' },
  { id: 'email', label: 'E-posta', icon: '✉' },
  { id: 'phone', label: 'Telefon', icon: '📞' },
  { id: 'relation', label: 'Bağlantı (başka notlar)', icon: '↗' },
  { id: 'formula', label: 'Formül', icon: 'Σ' },
  { id: 'rollup', label: 'Toplama (rollup)', icon: '∑' },
  { id: 'created', label: 'Oluşturulma zamanı', icon: '🕓' },
  { id: 'updated', label: 'Son düzenlenme', icon: '✎' },
];
