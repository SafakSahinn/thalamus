import { localeTag, t } from '../i18n';
import { useState } from 'react';
import { EmojiPicker } from '../editor/EmojiPicker';
import { ROLLUP_FNS } from '../lib/compute';
import { checkFormula, FUNCTION_NAMES } from '../lib/formula';
import { go } from '../lib/router';
import AutomationsEditor, { ButtonActionsEditor } from './AutomationsEditor';
import {
  addProp, deleteCollection, PROP_KINDS, removeProp, renameOption, reorderProps, restoreProp, updateCollection, updateProp, setDependencies, setSubItems,
} from '../lib/schema';
import { useStore } from '../lib/store';
import { editableType, isBuiltinProp, isBuiltinType, STATUS_GROUPS, TYPES, typeOf, type PropDef, type StatusGroup } from '../lib/types';
import { Chip } from './PropertyPanel';
import { promptText } from './Prompt';

const kindLabel = (k: string) => PROP_KINDS.find((x) => x.id === k);

function OptionsEditor({ typeId, def }: { typeId: string; def: PropDef }) {
  const [add, setAdd] = useState('');
  const opts = def.options ?? [];
  const groups = def.statusGroups;
  const save = (options: string[], g = groups) => {
    if (!g) return void updateProp(typeId, def.key, { options });
    // Durum alanı: yeni seçenek "Yapılacak" grubuna girer, kaldırılanın grubu silinir
    const next = Object.fromEntries(options.map((o) => [o, g[o] ?? 'todo'])) as typeof g;
    void updateProp(typeId, def.key, { options, statusGroups: next });
  };
  return (
    <div className="opt-editor">
      {opts.map((o, i) => (
        <span key={o} className="opt">
          <Chip text={o} def={def} />
          {groups && (
            <select className="status-group" value={groups[o] ?? 'todo'} title={t('schema.editor.group')} onChange={(e) => save(opts, { ...groups, [o]: e.target.value as StatusGroup })}>
              {STATUS_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          )}
          <button type="button" title={t('schema.editor.rename')} onClick={async () => {
            const v = await promptText(t('schema.editor.renamePrompt'), o, { hint: t('schema.editor.renameHint') });
            if (v?.trim() && v.trim() !== o) await renameOption(typeId, def, o, v.trim());
          }}>✎</button>
          <button type="button" title={t('schema.editor.up')} disabled={i === 0} onClick={() => { const x = [...opts]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; save(x); }}>↑</button>
          <button type="button" title={t('common.remove')} onClick={() => save(opts.filter((x) => x !== o))}>×</button>
        </span>
      ))}
      <input
        value={add}
        placeholder={t('schema.editor.newOption')}
        onChange={(e) => setAdd(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && add.trim() && !opts.includes(add.trim())) {
            save([...opts, add.trim()]);
            setAdd('');
          }
        }}
      />
    </div>
  );
}

function FormulaEditor({ typeId, def }: { typeId: string; def: PropDef }) {
  const [src, setSrc] = useState(def.formula ?? '');
  const err = src.trim() ? checkFormula(src) : null;
  const ty = typeOf(typeId);
  return (
    <div className="formula-editor">
      <textarea rows={2} value={src} spellCheck={false} placeholder={t('schema.editor.formulaPlaceholder')} onChange={(e) => setSrc(e.target.value)}
        onBlur={() => !err && src !== def.formula && void updateProp(typeId, def.key, { formula: src })} />
      {err ? <div className="err small">{err}</div> : <div className="ok small">{src.trim() ? t('schema.editor.formulaOk') : ''}</div>}
      <details className="small muted">
        <summary>{t('schema.editor.help')}</summary>
        <p>{t('schema.editor.fields')} {ty.props.filter((p) => p.key !== def.key).map((p) => <code key={p.key}>prop("{p.label}")</code>).reduce<React.ReactNode[]>((a, x) => [...a, x, ' '], [])} <code>prop("{t('schema.editor.nameField')}")</code></p>
        <p>{t('schema.editor.ops')} <code>+ - * / % ^</code> · <code>== != &gt; &lt; &gt;= &lt;=</code> · <code>and or not</code></p>
        <p>{t('schema.editor.fns')} {FUNCTION_NAMES.filter((f) => f !== 'prop').map((f) => <code key={f}>{f}()</code>).reduce<React.ReactNode[]>((a, x) => [...a, x, ' '], [])}</p>
        <p>{t('schema.editor.examples')} <code>prop("{t('schema.editor.exPages')}") / 30</code> {t('schema.editor.exDays')} · <code>dateBetween(prop("{t('schema.editor.exEnd')}"), prop("{t('schema.editor.exStart')}"), "days")</code> · <code>round(prop("{t('schema.editor.exRating')}") * 20) + "%"</code></p>
      </details>
    </div>
  );
}

function RollupEditor({ typeId, def }: { typeId: string; def: PropDef }) {
  const ty = typeOf(typeId);
  const rels = ty.props.filter((p) => p.kind === 'relation');
  const r = def.rollup ?? { relation: rels[0]?.key ?? '', prop: '__title', fn: 'count' as const };
  const rel = rels.find((p) => p.key === r.relation);
  const target = typeOf(rel?.target?.[0] ?? 'note');
  const set = (patch: Partial<typeof r>) => void updateProp(typeId, def.key, { rollup: { ...r, ...patch } });
  if (!rels.length) return <p className="muted small">{t('schema.editor.needRelation')}</p>;
  return (
    <div className="row rollup-editor">
      <label className="small muted">{t('schema.editor.relation')}</label>
      <select value={r.relation} onChange={(e) => set({ relation: e.target.value, prop: '__title' })}>
        {rels.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <label className="small muted">{t('schema.editor.field')}</label>
      <select value={r.prop} onChange={(e) => set({ prop: e.target.value })}>
        <option value="__title">{t('schema.editor.nameField')}</option>
        {target.props.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <label className="small muted">{t('schema.editor.calc')}</label>
      <select value={r.fn} onChange={(e) => set({ fn: e.target.value as typeof r.fn })}>
        {ROLLUP_FNS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
    </div>
  );
}

function PropRow({ typeId, def, hidden, index, keys }: { typeId: string; def: PropDef; hidden: boolean; index: number; keys: string[] }) {
  const [open, setOpen] = useState(false);
  const k = def.statusGroups ? kindLabel('status') : kindLabel(def.kind);
  const builtin = isBuiltinProp(typeId, def.key);
  const move = (d: number) => {
    const x = [...keys];
    const [m] = x.splice(index, 1);
    x.splice(index + d, 0, m);
    void reorderProps(typeId, x);
  };
  const hasDetails = ['select', 'multiselect', 'formula', 'rollup', 'relation', 'uid', 'button'].includes(def.kind);
  return (
    <div className={`prop-row ${hidden ? 'hidden-prop' : ''}`}>
      <div className="row">
        <span className="kind-ic" title={k?.label}>{k?.icon}</span>
        <input className="grow" defaultValue={def.label} disabled={hidden} onBlur={(e) => e.target.value.trim() && e.target.value !== def.label && void updateProp(typeId, def.key, { label: e.target.value.trim() })} />
        <span className="muted small kind-name">{k?.label}</span>
        <label className="small" title={t('schema.editor.tableTitle')}><input type="checkbox" checked={Boolean(def.table)} disabled={hidden} onChange={(e) => void updateProp(typeId, def.key, { table: e.target.checked })} /> {t('schema.editor.table')}</label>
        {hasDetails && !hidden && <button type="button" className="iconbtn" title={t('schema.editor.settings')} onClick={() => setOpen(!open)}>{open ? '▾' : '⚙'}</button>}
        <button type="button" className="iconbtn" disabled={index === 0} onClick={() => move(-1)}>↑</button>
        <button type="button" className="iconbtn" disabled={index === keys.length - 1} onClick={() => move(1)}>↓</button>
        {hidden ? (
          <button type="button" className="btn small" onClick={() => void restoreProp(typeId, def.key)}>{t('schema.editor.restore')}</button>
        ) : (
          <button type="button" className="iconbtn" title={builtin ? t('schema.editor.hide') : t('schema.editor.deleteField')} onClick={() => {
            if (builtin || confirm(t('schema.editor.confirmDeleteField', { label: def.label }))) void removeProp(typeId, def.key);
          }}>{builtin ? '🙈' : '🗑'}</button>
        )}
      </div>
      {open && !hidden && (
        <div className="prop-details">
          {(def.kind === 'select' || def.kind === 'multiselect') && <OptionsEditor typeId={typeId} def={def} />}
          {def.kind === 'formula' && <FormulaEditor typeId={typeId} def={def} />}
          {def.kind === 'button' && <ButtonActionsEditor typeId={typeId} def={def} />}
          {def.kind === 'uid' && (
            <div className="row">
              <span className="small muted">{t('schema.editor.prefix')}</span>
              <input defaultValue={def.prefix ?? ''} placeholder={t('schema.editor.prefixPlaceholder')} style={{ width: 120 }} onBlur={(e) => e.target.value.trim() !== (def.prefix ?? '') && void updateProp(typeId, def.key, { prefix: e.target.value.trim().toLocaleUpperCase(localeTag()) || undefined })} />
              <span className="small muted">{t('schema.editor.preview', { example: def.prefix ? `${def.prefix}-1, ${def.prefix}-2…` : '1, 2, 3…' })}</span>
            </div>
          )}
          {def.kind === 'rollup' && <RollupEditor typeId={typeId} def={def} />}
          {def.kind === 'relation' && (
            <div className="row">
              <span className="small muted">{t('schema.editor.target')}</span>
              <select value={def.target?.[0] ?? 'note'} disabled={builtin} onChange={(e) => void updateProp(typeId, def.key, { target: [e.target.value] })}>
                {TYPES.map((ty) => <option key={ty.id} value={ty.id}>{ty.icon} {ty.plural}</option>)}
              </select>
              <label className="small" title={t('schema.editor.singleTitle')}>
                <input type="checkbox" checked={Boolean(def.single)} onChange={(e) => void updateProp(typeId, def.key, { single: e.target.checked || undefined })} /> {t('schema.editor.single')}
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddProp({ typeId }: { typeId: string }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<PropDef['kind'] | 'status'>('text');
  const [target, setTarget] = useState('note');
  const add = async () => {
    if (!label.trim()) return;
    const def: Omit<PropDef, 'key' | 'custom'> = { label: label.trim(), kind: kind === 'status' ? 'select' : kind, table: true };
    if (kind === 'select' || kind === 'multiselect') def.options = [];
    if (kind === 'status') {
      const [todo, doing, done] = [t('schema.defaults.statusOptions.todo'), t('schema.defaults.statusOptions.doing'), t('schema.defaults.statusOptions.done')];
      def.options = [todo, doing, done];
      def.statusGroups = { [todo]: 'todo', [doing]: 'doing', [done]: 'done' };
    }
    if (kind === 'relation') def.target = [target];
    if (kind === 'formula') def.formula = '';
    if (kind === 'button') def.actions = [];
    await addProp(typeId, def);
    setLabel('');
  };
  return (
    <div className="row add-prop">
      <input className="grow" value={label} placeholder={t('schema.editor.newField')} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
      <select value={kind} onChange={(e) => setKind(e.target.value as PropDef['kind'] | 'status')}>
        {PROP_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
      </select>
      {kind === 'relation' && (
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {TYPES.map((ty) => <option key={ty.id} value={ty.id}>{ty.icon} {ty.plural}</option>)}
        </select>
      )}
      <button type="button" className="btn primary small" disabled={!label.trim()} onClick={() => void add()}>{t('schema.editor.addField')}</button>
    </div>
  );
}

/** Koleksiyonu düzenle: ad, simge, renk, alanlar */
export default function TypeEditor({ typeId, onClose }: { typeId: string; onClose: () => void }) {
  useStore((s) => s.settings.types);
  const ty = editableType(typeId);
  const [pick, setPick] = useState(false);
  if (!ty) return null;
  const hiddenKeys = new Set(Object.entries(useStore.getState().settings.types?.overrides[typeId]?.props ?? {}).filter(([, v]) => v.hidden).map(([k]) => k));
  const keys = ty.props.map((p) => p.key);
  const custom = !isBuiltinType(typeId);
  const count = Object.values(useStore.getState().notes).filter((n) => n.type === typeId && !n.deleted_at).length;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal type-editor" role="dialog" aria-label={t('schema.editor.aria')}>
        <div className="te-head">
          <span className="rel">
            <button type="button" className="te-icon" onClick={() => setPick(!pick)} title={t('schema.editor.icon')}>{ty.icon}</button>
            {pick && <EmojiPicker onClose={() => setPick(false)} onPick={(e) => { if (e) void updateCollection(typeId, { icon: e }); setPick(false); }} />}
          </span>
          <div className="grow">
            <input className="te-name" defaultValue={ty.plural} placeholder={t('schema.editor.plural')} onBlur={(e) => e.target.value.trim() && e.target.value !== ty.plural && void updateCollection(typeId, { plural: e.target.value.trim() })} />
            <div className="row small muted">
              {t('schema.editor.singular')}
              <input className="te-single" defaultValue={ty.label} onBlur={(e) => e.target.value.trim() && e.target.value !== ty.label && void updateCollection(typeId, { label: e.target.value.trim() })} />
              {t('schema.editor.color')}
              <input type="color" value={ty.color} onChange={(e) => void updateCollection(typeId, { color: e.target.value })} />
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <h4>{t('schema.editor.fieldsTitle')}</h4>
        <p className="muted small">{t('schema.editor.fieldsHint')}</p>
        <div className="prop-rows">
          {ty.props.map((p, i) => <PropRow key={p.key} typeId={typeId} def={p} hidden={hiddenKeys.has(p.key)} index={i} keys={keys} />)}
        </div>
        <AddProp typeId={typeId} />

        <h4>{t('schema.editor.automations')}</h4>
        <AutomationsEditor typeId={typeId} />

        <h4>{t('schema.editor.advanced')}</h4>
        <label className="te-opt">
          <input type="checkbox" checked={Boolean(ty.subItems)} onChange={(e) => void setSubItems(typeId, e.target.checked)} />
          <span><b>{t('schema.editor.subItems')}</b><span className="muted small">{t('schema.editor.subItemsHint')}</span></span>
        </label>
        <label className="te-opt">
          <input type="checkbox" checked={Boolean(ty.blockedBy)} onChange={(e) => void setDependencies(typeId, e.target.checked)} />
          <span><b>{t('schema.editor.deps')}</b><span className="muted small">{t('schema.editor.depsHint')}</span></span>
        </label>

        {custom && (
          <div className="te-danger">
            <button type="button" className="btn danger small" onClick={async () => {
              if (!confirm(t('schema.editor.confirmDelete', { name: ty.plural, count }))) return;
              await deleteCollection(typeId);
              onClose();
              go('/');
            }}>{t('schema.editor.delete')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Kenar çubuğundan yeni koleksiyon */
export async function newCollectionFlow(create: (label: string) => Promise<string>) {
  const name = await promptText(t('schema.editor.newPrompt'), '', { hint: t('schema.editor.newHint') });
  if (!name?.trim()) return null;
  return create(name.trim());
}
