import { useState } from 'react';
import { EmojiPicker } from '../editor/EmojiPicker';
import { ROLLUP_FNS } from '../lib/compute';
import { checkFormula, FUNCTION_NAMES } from '../lib/formula';
import { go } from '../lib/router';
import AutomationsEditor from './AutomationsEditor';
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
            <select className="status-group" value={groups[o] ?? 'todo'} title="Grup" onChange={(e) => save(opts, { ...groups, [o]: e.target.value as StatusGroup })}>
              {STATUS_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
          )}
          <button type="button" title="Yeniden adlandır (notlar da güncellenir)" onClick={async () => {
            const v = await promptText('Seçeneğin yeni adı', o, { hint: 'Bu seçeneği kullanan bütün notlar da güncellenir.' });
            if (v?.trim() && v.trim() !== o) await renameOption(typeId, def, o, v.trim());
          }}>✎</button>
          <button type="button" title="Yukarı" disabled={i === 0} onClick={() => { const x = [...opts]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; save(x); }}>↑</button>
          <button type="button" title="Kaldır" onClick={() => save(opts.filter((x) => x !== o))}>×</button>
        </span>
      ))}
      <input
        value={add}
        placeholder="+ seçenek"
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
  const t = typeOf(typeId);
  return (
    <div className="formula-editor">
      <textarea rows={2} value={src} spellCheck={false} placeholder='Örnek: if(prop("Durum") == "Bitti", "✅", "⏳")' onChange={(e) => setSrc(e.target.value)}
        onBlur={() => !err && src !== def.formula && void updateProp(typeId, def.key, { formula: src })} />
      {err ? <div className="err small">{err}</div> : <div className="ok small">{src.trim() ? 'Formül geçerli' : ''}</div>}
      <details className="small muted">
        <summary>Yardım</summary>
        <p>Alanlar: {t.props.filter((p) => p.key !== def.key).map((p) => <code key={p.key}>prop("{p.label}")</code>).reduce<React.ReactNode[]>((a, x) => [...a, x, ' '], [])} <code>prop("Ad")</code></p>
        <p>İşlemler: <code>+ - * / % ^</code> · <code>== != &gt; &lt; &gt;= &lt;=</code> · <code>and or not</code></p>
        <p>İşlevler: {FUNCTION_NAMES.filter((f) => f !== 'prop').map((f) => <code key={f}>{f}()</code>).reduce<React.ReactNode[]>((a, x) => [...a, x, ' '], [])}</p>
        <p>Örnekler: <code>prop("Sayfa") / 30</code> (kaç günde biter) · <code>dateBetween(prop("Bitiş"), prop("Başlama"), "days")</code> · <code>round(prop("Puan") * 20) + "%"</code></p>
      </details>
    </div>
  );
}

function RollupEditor({ typeId, def }: { typeId: string; def: PropDef }) {
  const t = typeOf(typeId);
  const rels = t.props.filter((p) => p.kind === 'relation');
  const r = def.rollup ?? { relation: rels[0]?.key ?? '', prop: '__title', fn: 'count' as const };
  const rel = rels.find((p) => p.key === r.relation);
  const target = typeOf(rel?.target?.[0] ?? 'note');
  const set = (patch: Partial<typeof r>) => void updateProp(typeId, def.key, { rollup: { ...r, ...patch } });
  if (!rels.length) return <p className="muted small">Bu koleksiyonda önce bir “Bağlantı” alanı olmalı.</p>;
  return (
    <div className="row rollup-editor">
      <label className="small muted">Bağlantı</label>
      <select value={r.relation} onChange={(e) => set({ relation: e.target.value, prop: '__title' })}>
        {rels.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <label className="small muted">Alan</label>
      <select value={r.prop} onChange={(e) => set({ prop: e.target.value })}>
        <option value="__title">Ad</option>
        {target.props.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <label className="small muted">Hesap</label>
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
  const hasDetails = ['select', 'multiselect', 'formula', 'rollup', 'relation', 'uid'].includes(def.kind);
  return (
    <div className={`prop-row ${hidden ? 'hidden-prop' : ''}`}>
      <div className="row">
        <span className="kind-ic" title={k?.label}>{k?.icon}</span>
        <input className="grow" defaultValue={def.label} disabled={hidden} onBlur={(e) => e.target.value.trim() && e.target.value !== def.label && void updateProp(typeId, def.key, { label: e.target.value.trim() })} />
        <span className="muted small kind-name">{k?.label}</span>
        <label className="small" title="Tablo görünümünde sütun olarak göster"><input type="checkbox" checked={Boolean(def.table)} disabled={hidden} onChange={(e) => void updateProp(typeId, def.key, { table: e.target.checked })} /> tablo</label>
        {hasDetails && !hidden && <button type="button" className="iconbtn" title="Ayarlar" onClick={() => setOpen(!open)}>{open ? '▾' : '⚙'}</button>}
        <button type="button" className="iconbtn" disabled={index === 0} onClick={() => move(-1)}>↑</button>
        <button type="button" className="iconbtn" disabled={index === keys.length - 1} onClick={() => move(1)}>↓</button>
        {hidden ? (
          <button type="button" className="btn small" onClick={() => void restoreProp(typeId, def.key)}>Geri getir</button>
        ) : (
          <button type="button" className="iconbtn" title={builtin ? 'Gizle (veriler kalır)' : 'Alanı sil'} onClick={() => {
            if (builtin || confirm(`"${def.label}" alanı silinsin mi? Notlardaki değerleri görünmez olur.`)) void removeProp(typeId, def.key);
          }}>{builtin ? '🙈' : '🗑'}</button>
        )}
      </div>
      {open && !hidden && (
        <div className="prop-details">
          {(def.kind === 'select' || def.kind === 'multiselect') && <OptionsEditor typeId={typeId} def={def} />}
          {def.kind === 'formula' && <FormulaEditor typeId={typeId} def={def} />}
          {def.kind === 'uid' && (
            <div className="row">
              <span className="small muted">Önek:</span>
              <input defaultValue={def.prefix ?? ''} placeholder="ör. DENEY" style={{ width: 120 }} onBlur={(e) => e.target.value.trim() !== (def.prefix ?? '') && void updateProp(typeId, def.key, { prefix: e.target.value.trim().toLocaleUpperCase('tr') || undefined })} />
              <span className="small muted">Görünüm: {def.prefix ? `${def.prefix}-1, ${def.prefix}-2…` : '1, 2, 3…'}</span>
            </div>
          )}
          {def.kind === 'rollup' && <RollupEditor typeId={typeId} def={def} />}
          {def.kind === 'relation' && (
            <div className="row">
              <span className="small muted">Bağlanacak koleksiyon:</span>
              <select value={def.target?.[0] ?? 'note'} disabled={builtin} onChange={(e) => void updateProp(typeId, def.key, { target: [e.target.value] })}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.plural}</option>)}
              </select>
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
      def.options = ['Başlanmadı', 'Sürüyor', 'Tamamlandı'];
      def.statusGroups = { Başlanmadı: 'todo', Sürüyor: 'doing', Tamamlandı: 'done' };
    }
    if (kind === 'relation') def.target = [target];
    if (kind === 'formula') def.formula = '';
    await addProp(typeId, def);
    setLabel('');
  };
  return (
    <div className="row add-prop">
      <input className="grow" value={label} placeholder="Yeni alan adı" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void add()} />
      <select value={kind} onChange={(e) => setKind(e.target.value as PropDef['kind'] | 'status')}>
        {PROP_KINDS.map((k) => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
      </select>
      {kind === 'relation' && (
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.plural}</option>)}
        </select>
      )}
      <button type="button" className="btn primary small" disabled={!label.trim()} onClick={() => void add()}>Alan ekle</button>
    </div>
  );
}

/** Koleksiyonu düzenle: ad, simge, renk, alanlar */
export default function TypeEditor({ typeId, onClose }: { typeId: string; onClose: () => void }) {
  useStore((s) => s.settings.types);
  const t = editableType(typeId);
  const [pick, setPick] = useState(false);
  if (!t) return null;
  const hiddenKeys = new Set(Object.entries(useStore.getState().settings.types?.overrides[typeId]?.props ?? {}).filter(([, v]) => v.hidden).map(([k]) => k));
  const keys = t.props.map((p) => p.key);
  const custom = !isBuiltinType(typeId);
  const count = Object.values(useStore.getState().notes).filter((n) => n.type === typeId && !n.deleted_at).length;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal type-editor" role="dialog" aria-label="Koleksiyonu düzenle">
        <div className="te-head">
          <span className="rel">
            <button type="button" className="te-icon" onClick={() => setPick(!pick)} title="Simge">{t.icon}</button>
            {pick && <EmojiPicker onClose={() => setPick(false)} onPick={(e) => { if (e) void updateCollection(typeId, { icon: e }); setPick(false); }} />}
          </span>
          <div className="grow">
            <input className="te-name" defaultValue={t.plural} placeholder="Koleksiyon adı (çoğul)" onBlur={(e) => e.target.value.trim() && e.target.value !== t.plural && void updateCollection(typeId, { plural: e.target.value.trim() })} />
            <div className="row small muted">
              Tek bir not:
              <input className="te-single" defaultValue={t.label} onBlur={(e) => e.target.value.trim() && e.target.value !== t.label && void updateCollection(typeId, { label: e.target.value.trim() })} />
              Renk:
              <input type="color" value={t.color} onChange={(e) => void updateCollection(typeId, { color: e.target.value })} />
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Kapat">×</button>
        </div>

        <h4>Alanlar</h4>
        <p className="muted small">Her notta “Ad” alanı her zaman vardır. Hazır alanları silemezsin ama gizleyebilirsin; verileri kaybolmaz.</p>
        <div className="prop-rows">
          {t.props.map((p, i) => <PropRow key={p.key} typeId={typeId} def={p} hidden={hiddenKeys.has(p.key)} index={i} keys={keys} />)}
        </div>
        <AddProp typeId={typeId} />

        <h4>Otomasyonlar</h4>
        <AutomationsEditor typeId={typeId} />

        <h4>Gelişmiş</h4>
        <label className="te-opt">
          <input type="checkbox" checked={Boolean(t.subItems)} onChange={(e) => void setSubItems(typeId, e.target.checked)} />
          <span><b>Alt öğeler</b><span className="muted small"> · Bir kaydın altına alt kayıtlar ekle (ör. projenin görevleri); tabloda iç içe görünür.</span></span>
        </label>
        <label className="te-opt">
          <input type="checkbox" checked={Boolean(t.blockedBy)} onChange={(e) => void setDependencies(typeId, e.target.checked)} />
          <span><b>Bağımlılıklar</b><span className="muted small"> · “Şu bitmeden bu başlamaz” bağları; zaman çizelgesinde ok olarak çizilir, çakışanlar kırmızı olur.</span></span>
        </label>

        {custom && (
          <div className="te-danger">
            <button type="button" className="btn danger small" onClick={async () => {
              if (!confirm(`"${t.plural}" koleksiyonu silinsin mi? İçindeki ${count} not “Notlar”a taşınır, silinmez.`)) return;
              await deleteCollection(typeId);
              onClose();
              go('/');
            }}>Koleksiyonu sil</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Kenar çubuğundan yeni koleksiyon */
export async function newCollectionFlow(create: (label: string) => Promise<string>) {
  const name = await promptText('Yeni koleksiyonun adı', '', { hint: 'Örnek: Laboratuvar deneyleri, Konferanslar, Projeler, Tarifler' });
  if (!name?.trim()) return null;
  return create(name.trim());
}
