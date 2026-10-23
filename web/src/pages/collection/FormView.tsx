import { localeTag, t } from '../../i18n';
import { useMemo, useState } from 'react';
import { openPeek } from '../../components/Peek';
import { displayTitle } from '../../lib/format';
import { createNote, useIndex } from '../../lib/store';
import { optionLabel, typeOf, type PropDef } from '../../lib/types';
import type { ViewProps } from './Views';

// Form görünümü (Notion Formları): koleksiyona form doldurarak kayıt ekle. Hangi alanların sorulacağı
// görünüm ayarlarındaki "gösterilen alanlar" ile seçilir. Hesaplanan alanlar ve dosyalar sorulmaz.

const ASKABLE = new Set(['text', 'longtext', 'number', 'date', 'select', 'multiselect', 'checkbox', 'rating', 'url', 'email', 'phone', 'relation']);

function RelationPick({ def, value, onChange }: { def: PropDef; value: string[]; onChange: (v: string[]) => void }) {
  const { alive } = useIndex();
  const target = def.target?.[0] ?? 'note';
  const options = useMemo(() => alive.filter((n) => n.type === target).sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), 'tr')).slice(0, 300), [alive, target]);
  const byId = new Map(options.map((n) => [n.id, n]));
  return (
    <div className="form-rel">
      {value.map((id) => (
        <span key={id} className="relchip">
          <span className="notechip">{byId.get(id) ? displayTitle(byId.get(id)!) : '?'}</span>
          <button type="button" className="x" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={t('common.remove')}>×</button>
        </span>
      ))}
      <select value="" onChange={(e) => e.target.value && onChange(def.single ? [e.target.value] : [...value, e.target.value])} aria-label={def.label}>
        <option value="">{t('coll.form.pickOf', { label: typeOf(target).label })}</option>
        {options.filter((n) => !value.includes(n.id)).map((n) => <option key={n.id} value={n.id}>{displayTitle(n)}</option>)}
      </select>
    </div>
  );
}

export function FormView({ ty, view, newProps }: ViewProps) {
  const hidden = new Set(view.hidden ?? ty.props.filter((p) => !p.table).map((p) => p.key));
  const fields = ty.props.filter((p) => ASKABLE.has(p.kind) && !hidden.has(p.key));
  const [title, setTitle] = useState('');
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState<{ id: string; title: string } | null>(null);
  const set = (k: string, v: unknown) => setVals((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const props: Record<string, unknown> = { ...newProps() };
    for (const [k, v] of Object.entries(vals)) {
      if (v === '' || v === undefined || v === false || (Array.isArray(v) && !v.length)) continue;
      props[k] = v;
    }
    const n = createNote(ty.id, title.trim(), props);
    setDone({ id: n.id, title: title.trim() || t('common.untitled') });
    setTitle('');
    setVals({});
  };

  const input = (d: PropDef) => {
    const v = vals[d.key];
    switch (d.kind) {
      case 'longtext':
        return <textarea rows={3} value={(v as string) ?? ''} onChange={(e) => set(d.key, e.target.value)} />;
      case 'number':
        return <input type="number" value={(v as number) ?? ''} onChange={(e) => set(d.key, e.target.value === '' ? undefined : Number(e.target.value))} />;
      case 'date':
        return <input type="date" value={(v as string) ?? ''} onChange={(e) => set(d.key, e.target.value)} />;
      case 'select':
        return (
          <select value={(v as string) ?? ''} onChange={(e) => set(d.key, e.target.value)}>
            <option value="">—</option>
            {d.options?.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
          </select>
        );
      case 'multiselect': {
        const arr = (v as string[]) ?? [];
        return (
          <div className="form-opts">
            {d.options?.map((o) => (
              <label key={o} className="form-opt">
                <input type="checkbox" checked={arr.includes(o)} onChange={(e) => set(d.key, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} /> {optionLabel(o)}
              </label>
            ))}
          </div>
        );
      }
      case 'checkbox':
        return <input type="checkbox" className="check" checked={Boolean(v)} onChange={(e) => set(d.key, e.target.checked)} />;
      case 'rating':
        return (
          <span className="stars edit">
            {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= Number(v ?? 0) ? 'on' : ''} onClick={() => set(d.key, i === v ? undefined : i)}>★</span>)}
          </span>
        );
      case 'relation':
        return <RelationPick def={d} value={(v as string[]) ?? []} onChange={(x) => set(d.key, x)} />;
      default:
        return <input type={d.kind === 'email' ? 'email' : d.kind === 'url' ? 'url' : d.kind === 'phone' ? 'tel' : 'text'} value={(v as string) ?? ''} onChange={(e) => set(d.key, e.target.value)} />;
    }
  };

  return (
    <form className="form-view" onSubmit={submit}>
      <div className="form-card">
        <div className="form-head">
          <span className="form-icon">{ty.icon}</span>
          <div>
            <h2>{t('coll.form.newOf', { label: ty.label.toLocaleLowerCase(localeTag()) })}</h2>
            <p className="muted small">{t('coll.form.intro', { plural: ty.plural })}</p>
          </div>
        </div>
        {done && (
          <div className="form-done">
            {t('coll.form.added', { title: done.title })} <button type="button" className="linkbtn" onClick={() => openPeek(done.id)}>{t('coll.open')}</button>
          </div>
        )}
        <label className="form-field">
          <span>{t('coll.form.name')} <span className="req">*</span></span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('coll.form.namePlaceholder', { label: ty.label })} autoFocus />
        </label>
        {fields.map((d) => (
          <div key={d.key} className="form-field">
            <span>{d.label}</span>
            {input(d)}
          </div>
        ))}
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => { setTitle(''); setVals({}); setDone(null); }}>{t('coll.form.clear')}</button>
          <button type="submit" className="btn primary">{t('coll.form.submit')}</button>
        </div>
      </div>
    </form>
  );
}
