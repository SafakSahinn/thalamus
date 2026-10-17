import type { Action, Rule, Trigger } from '../lib/automations';
import { saveSettings, uid, useStore } from '../lib/store';
import { typeOf, type PropDef } from '../lib/types';

// Koleksiyon ayarları → Otomasyonlar: "ne zaman … olunca … yap" kuralları

const SETTABLE = new Set(['text', 'longtext', 'number', 'date', 'select', 'multiselect', 'checkbox', 'rating', 'url', 'email', 'phone']);
const WATCHABLE = new Set([...SETTABLE, 'relation']);

function ValueSelect({ def, value, onChange, trigger }: { def?: PropDef; value: string; onChange: (v: string) => void; trigger?: boolean }) {
  if (!def) return null;
  if (def.kind === 'select' || def.kind === 'multiselect') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {trigger ? <option value="">herhangi bir değer</option> : <option value="clear">— boşalt</option>}
        {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (def.kind === 'checkbox') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {trigger && <option value="">herhangi bir değişiklik</option>}
        <option value="true">işaretli</option>
        <option value={trigger ? 'false' : 'clear'}>işaretsiz</option>
      </select>
    );
  }
  if (trigger) {
    return <span className="muted small">değişince</span>;
  }
  if (def.kind === 'date') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="today">bugünün tarihi</option>
        <option value="clear">— boşalt</option>
      </select>
    );
  }
  return <input value={value === 'clear' ? '' : value} placeholder="değer (boş = boşalt)" onChange={(e) => onChange(e.target.value || 'clear')} />;
}

const defaultValue = (d?: PropDef) => (d?.kind === 'date' ? 'today' : d?.kind === 'checkbox' ? 'true' : d?.options?.[0] ?? 'clear');

export default function AutomationsEditor({ typeId }: { typeId: string }) {
  const settings = useStore((s) => s.settings);
  const rules = settings.automations?.[typeId] ?? [];
  const t = typeOf(typeId);
  const writable = t.props.filter((p) => SETTABLE.has(p.kind) && !p.back);
  const watchable = t.props.filter((p) => WATCHABLE.has(p.kind));
  const def = (k: string) => t.props.find((p) => p.key === k);
  const save = (next: Rule[]) => void saveSettings({ ...useStore.getState().settings, automations: { ...(useStore.getState().settings.automations ?? {}), [typeId]: next } });
  const patch = (id: string, p: Partial<Rule>) => save(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setAction = (r: Rule, i: number, a: Partial<Action>) => patch(r.id, { then: r.then.map((x, j) => (j === i ? { ...x, ...a } : x)) });
  const add = () => {
    const first = writable[0];
    if (!first) return;
    save([...rules, { id: uid(), on: true, when: { kind: 'created' }, then: [{ key: first.key, value: defaultValue(first) }] }]);
  };

  return (
    <div className="automations">
      {rules.length === 0 && <p className="muted small">Henüz kural yok. Örnek: “Durum <b>Bitti</b> olunca Bitiş tarihini <b>bugün</b> yap”.</p>}
      {rules.map((r) => {
        const w = r.when;
        const wdef = w.kind === 'changed' ? def(w.key) : undefined;
        return (
          <div key={r.id} className={`rule ${r.on ? '' : 'off'}`}>
            <div className="rule-line">
              <label className="rule-on" title="Açık/kapalı"><input type="checkbox" checked={r.on} onChange={(e) => patch(r.id, { on: e.target.checked })} /></label>
              <b>Ne zaman</b>
              <select
                value={w.kind === 'created' ? '__created' : w.key}
                onChange={(e) => {
                  const when: Trigger = e.target.value === '__created' ? { kind: 'created' } : { kind: 'changed', key: e.target.value };
                  patch(r.id, { when });
                }}
              >
                <option value="__created">yeni kayıt eklenince</option>
                {watchable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {w.kind === 'changed' && (
                <>
                  {(wdef?.kind === 'select' || wdef?.kind === 'multiselect' || wdef?.kind === 'checkbox') && <span className="muted small">şu olunca</span>}
                  <ValueSelect trigger def={wdef} value={w.to ?? ''} onChange={(v) => patch(r.id, { when: { ...w, to: v || undefined } })} />
                </>
              )}
              <span className="spacer" />
              <button type="button" className="iconbtn" title="Kuralı sil" onClick={() => save(rules.filter((x) => x.id !== r.id))}>🗑</button>
            </div>
            {r.then.map((a, i) => (
              <div key={i} className="rule-line act">
                <b>{i === 0 ? 'Şunu yap' : 've'}</b>
                <select value={a.key} onChange={(e) => setAction(r, i, { key: e.target.value, value: defaultValue(def(e.target.value)) })}>
                  {writable.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <span className="muted small">=</span>
                <ValueSelect def={def(a.key)} value={a.value} onChange={(v) => setAction(r, i, { value: v })} />
                {r.then.length > 1 && <button type="button" className="iconbtn" title="Eylemi kaldır" onClick={() => patch(r.id, { then: r.then.filter((_, j) => j !== i) })}>×</button>}
              </div>
            ))}
            <button type="button" className="linkbtn small" onClick={() => patch(r.id, { then: [...r.then, { key: writable[0].key, value: defaultValue(writable[0]) }] })}>＋ eylem ekle</button>
          </div>
        );
      })}
      <button type="button" className="btn small" disabled={!writable.length} onClick={add}>＋ Kural ekle</button>
      <p className="muted small">Kurallar bu koleksiyonda senin yaptığın değişikliklerde çalışır (Drive’dan eşitlenen değişikliklerde tekrar çalışmaz).</p>
    </div>
  );
}
