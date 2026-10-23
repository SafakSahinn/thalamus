// Koleksiyon ve alan düzenleme: ayarlardaki TypeSettings üzerinde değişiklik yapar
// (ayarlar Drive ile eşitlendiği için bütün cihazlara yayılır).

import { t as tr, tSource, type MsgKey } from '../i18n';
import { assignUids, saveSettings, uid, updateNote, useStore } from './store';
import {
  EMPTY_TYPE_SETTINGS, isBuiltinType, typeOf, type PropDef, type PropOverride, type TypeDef, type TypeSettings,
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
  if (!t) throw new Error(tr('schema.errors.notFound'));
  return t.props;
}

export async function createCollection(label: string, icon = '🗂️', color = '#6b7280'): Promise<string> {
  const ts = current();
  const id = `c_${short()}`;
  const t: TypeDef = {
    id, label, plural: label, icon, color,
    props: [{ key: 'tags', label: tr('schema.defaults.tags'), kind: 'multiselect', options: [], table: true, custom: true }],
  };
  ts.custom.push(t);
  await commit(ts);
  return id;
}

export async function updateCollection(id: string, patch: Partial<Pick<TypeDef, 'label' | 'plural' | 'icon' | 'color' | 'cover' | 'subItems' | 'blockedBy'>>) {
  const ts = current();
  if (isBuiltinType(id)) {
    ts.overrides[id] = { ...(ts.overrides[id] ?? {}), ...patch };
  } else {
    const t = ts.custom.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  }
  await commit(ts);
}

/**
 * Alt öğeler (Notion'daki gibi): koleksiyona kendine bağlanan bir "Üst öğe" alanı eklenir, tersi "Alt öğeler" olur.
 * Kapatınca alan ve veriler kalır, yalnızca iç içe gösterim kapanır.
 */
export async function setSubItems(typeId: string, on: boolean) {
  if (!on) return updateCollection(typeId, { subItems: undefined });
  const t = typeOf(typeId);
  const existing = t.props.find((p) => p.kind === 'relation' && !p.back && anyLang('schema.defaults.children', p.backLabel) && p.target?.[0] === typeId);
  const key = existing?.key ?? (await addProp(typeId, { label: tr('schema.defaults.parent'), kind: 'relation', target: [typeId], backLabel: tr('schema.defaults.children') }));
  await updateCollection(typeId, { subItems: key });
}

/** Bağımlılıklar: "Bekledikleri" (bunlar bitmeden başlayamaz) alanı; tersi "Engelledikleri". Zaman çizelgesinde ok olarak çizilir. */
export async function setDependencies(typeId: string, on: boolean) {
  if (!on) return updateCollection(typeId, { blockedBy: undefined });
  const t = typeOf(typeId);
  const existing = t.props.find((p) => p.kind === 'relation' && !p.back && anyLang('schema.defaults.blocks', p.backLabel) && p.target?.[0] === typeId);
  const key = existing?.key ?? (await addProp(typeId, { label: tr('schema.defaults.waitsFor'), kind: 'relation', target: [typeId], backLabel: tr('schema.defaults.blocks') }));
  await updateCollection(typeId, { blockedBy: key });
}

/** Kullanıcı koleksiyonunu siler; içindeki notlar "Notlar"a taşınır (silinmez). */
export async function deleteCollection(id: string) {
  if (isBuiltinType(id)) throw new Error(tr('schema.errors.builtin'));
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
  if (def.kind === 'uid') assignUids(typeId, key);
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
    if ('single' in patch) po.single = patch.single;
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
  // Durum alanında seçeneğin grubu da yeni ada taşınır
  const statusGroups = def.statusGroups ? Object.fromEntries(Object.entries(def.statusGroups).map(([k, g]) => [k === from ? to : k, g])) : undefined;
  await updateProp(typeId, def.key, statusGroups ? { options, statusGroups } : { options });
  for (const n of Object.values(useStore.getState().notes)) {
    if (n.type !== typeId) continue;
    const v = n.props[def.key];
    if (v === from) updateNote(n.id, { props: { ...n.props, [def.key]: to } });
    else if (Array.isArray(v) && v.includes(from)) updateNote(n.id, { props: { ...n.props, [def.key]: v.map((x) => (x === from ? to : x)) } });
  }
}

/** Bu metin etkin dilde ya da kaynak dilde bu anahtarın karşılığı mı (dil değiştirilmiş hesaplarda eski adlar için) */
const anyLang = (key: MsgKey, s: string | undefined) => s !== undefined && (s === tr(key) || s === tSource(key));

type KindId = PropDef['kind'] | 'status';
const kind = (id: KindId, icon: string) => ({ id, icon, get label() { return tr(`schema.kinds.${id}`); } });
export const PROP_KINDS: { id: KindId; readonly label: string; icon: string }[] = [
  kind('text', 'Aa'),
  kind('longtext', '¶'),
  kind('number', '#'),
  kind('status', '◐'),
  kind('select', '◉'),
  kind('multiselect', '☰'),
  kind('date', '📅'),
  kind('checkbox', '☑'),
  kind('rating', '★'),
  kind('url', '🔗'),
  kind('email', '✉'),
  kind('phone', '📞'),
  kind('relation', '↗'),
  kind('files', '📎'),
  kind('uid', '№'),
  kind('button', '▶'),
  kind('formula', 'Σ'),
  kind('rollup', '∑'),
  kind('created', '🕓'),
  kind('updated', '✎'),
];
