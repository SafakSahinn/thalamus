import { t } from '../i18n';
import { useMemo, useState } from 'react';
import GraphView from '../components/GraphView';
import { displayTitle } from '../lib/format';
import { norm } from '../lib/links';
import { go } from '../lib/router';
import { useIndex } from '../lib/store';
import { TYPES, type TypeId } from '../lib/types';

const DEFAULT_OFF: TypeId[] = ['daily'];

export default function GraphPage() {
  const { alive, backlinks } = useIndex();
  const [off, setOff] = useState<Set<TypeId>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('graphOff') ?? 'null') ?? DEFAULT_OFF);
    } catch {
      return new Set(DEFAULT_OFF);
    }
  });
  const [orphans, setOrphans] = useState(false);
  const [q, setQ] = useState('');

  const toggle = (t: TypeId) => {
    const s = new Set(off);
    if (s.has(t)) s.delete(t);
    else s.add(t);
    setOff(s);
    localStorage.setItem('graphOff', JSON.stringify([...s]));
  };

  const nodes = useMemo(() => {
    const visible = alive.filter((n) => !off.has(n.type));
    if (orphans) return visible;
    const ids = new Set(visible.map((n) => n.id));
    return visible.filter((n) => n.links.some((t) => ids.has(t)) || (backlinks.get(n.id) ?? []).some((s) => ids.has(s)));
  }, [alive, off, orphans, backlinks]);

  const highlight = useMemo(() => {
    const nq = norm(q);
    if (!nq) return null;
    return new Set(nodes.filter((n) => norm(displayTitle(n)).includes(nq)).map((n) => n.id));
  }, [q, nodes]);

  const counts = useMemo(() => {
    const c = new Map<TypeId, number>();
    for (const n of alive) c.set(n.type, (c.get(n.type) ?? 0) + 1);
    return c;
  }, [alive]);

  return (
    <div className="graph-page" data-tour="graph">
      <div className="graph-controls">
        <input className="search" placeholder={t('panels.graph.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="typefilters">
          {TYPES.filter((t) => counts.get(t.id)).map((t) => (
            <button key={t.id} className={`tf ${off.has(t.id) ? 'off' : ''}`} style={{ '--c': t.color } as React.CSSProperties} onClick={() => toggle(t.id)}>
              <i /> {t.plural} <span className="muted">{counts.get(t.id)}</span>
            </button>
          ))}
        </div>
        <label className="small"><input type="checkbox" checked={orphans} onChange={(e) => setOrphans(e.target.checked)} /> {t('panels.graph.orphans')}</label>
      </div>
      {nodes.length ? (
        <GraphView notes={nodes} highlight={highlight} onOpen={(id) => go(`/n/${id}`)} />
      ) : (
        <div className="empty"><p>{t.rich('panels.graph.empty', { code: <code>[[</code> })}</p></div>
      )}
    </div>
  );
}
