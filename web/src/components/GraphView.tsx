import ForceGraph from 'force-graph';
import { useEffect, useRef } from 'react';
import { displayTitle } from '../lib/format';
import { typeOf, type Note } from '../lib/types';

interface GNode {
  id: string;
  label: string;
  color: string;
  icon: string;
  deg: number;
  x?: number;
  y?: number;
}
interface GLink {
  source: string | GNode;
  target: string | GNode;
}

interface Props {
  notes: Note[];
  focusId?: string;
  /** Aramada eşleşen notlar vurgulanır */
  highlight?: Set<string> | null;
  onOpen: (id: string) => void;
  className?: string;
}

const lid = (x: string | GNode) => (typeof x === 'string' ? x : x.id);

export default function GraphView({ notes, focusId, highlight, onOpen, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const graph = useRef<ForceGraph<GNode, GLink> | null>(null);
  const hover = useRef<string | null>(null);
  const neighbors = useRef(new Map<string, Set<string>>());
  const hl = useRef(highlight);
  hl.current = highlight;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const fitted = useRef(false);

  useEffect(() => {
    const el = box.current!;
    const g = new ForceGraph<GNode, GLink>(el);
    graph.current = g;
    const css = () => getComputedStyle(el);
    const redraw = () => {
      const c = g.centerAt();
      g.centerAt(c.x, c.y);
    };

    g.backgroundColor('rgba(0,0,0,0)')
      .nodeId('id')
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .cooldownTime(4000)
      .linkColor((l) => {
        const h = hover.current;
        const s = css();
        return h && (lid(l.source) === h || lid(l.target) === h) ? s.getPropertyValue('--accent') : s.getPropertyValue('--graph-link');
      })
      .linkWidth((l) => (hover.current && (lid(l.source) === hover.current || lid(l.target) === hover.current) ? 1.6 : 0.8))
      .nodeCanvasObject((n, ctx, scale) => {
        const h = hover.current;
        const near = h ? h === n.id || neighbors.current.get(h)?.has(n.id) : true;
        const hit = hl.current ? hl.current.has(n.id) : true;
        const r = 3 + Math.sqrt(n.deg) * 1.7;
        ctx.globalAlpha = near && hit ? 1 : 0.15;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();
        if (n.id === focusId || n.id === h) {
          ctx.lineWidth = 2 / scale;
          ctx.strokeStyle = css().getPropertyValue('--text');
          ctx.stroke();
        }
        const showLabel = scale > 1.6 || n.deg >= 6 || n.id === h || n.id === focusId || (h && near) || (hl.current && hit);
        if (showLabel) {
          const fs = Math.max(11 / scale, 2.2);
          ctx.font = `${fs}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = css().getPropertyValue('--text');
          const label = n.label.length > 32 ? `${n.label.slice(0, 30)}…` : n.label;
          ctx.fillText(label, n.x!, n.y! + r + 1.5);
        }
        ctx.globalAlpha = 1;
      })
      .nodePointerAreaPaint((n, color, ctx) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, 5 + Math.sqrt(n.deg) * 1.7, 0, 2 * Math.PI);
        ctx.fill();
      })
      .onNodeHover((n) => {
        hover.current = n?.id ?? null;
        el.style.cursor = n ? 'pointer' : '';
        redraw();
      })
      .onNodeClick((n) => onOpenRef.current(n.id))
      .onEngineStop(() => {
        if (!fitted.current) {
          fitted.current = true;
          g.zoomToFit(400, 40);
          // Az not varken aşırı yakınlaşmasın
          setTimeout(() => {
            if (g.zoom() > 2.2) g.zoom(2.2, 300);
          }, 450);
        }
      });

    const ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      g._destructor();
      graph.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Veri değiştiğinde konumları koruyarak güncelle
  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const ids = new Set(notes.map((n) => n.id));
    const prev = new Map(g.graphData().nodes.map((n) => [n.id, n]));
    const links: GLink[] = [];
    const nb = new Map<string, Set<string>>();
    const deg = new Map<string, number>();
    for (const n of notes) {
      for (const t of n.links) {
        if (!ids.has(t)) continue;
        links.push({ source: n.id, target: t });
        deg.set(n.id, (deg.get(n.id) ?? 0) + 1);
        deg.set(t, (deg.get(t) ?? 0) + 1);
        if (!nb.has(n.id)) nb.set(n.id, new Set());
        if (!nb.has(t)) nb.set(t, new Set());
        nb.get(n.id)!.add(t);
        nb.get(t)!.add(n.id);
      }
    }
    neighbors.current = nb;
    const nodes: GNode[] = notes.map((n) => {
      const t = typeOf(n.type);
      const old = prev.get(n.id);
      return { id: n.id, label: displayTitle(n), color: t.color, icon: t.icon, deg: deg.get(n.id) ?? 0, x: old?.x, y: old?.y };
    });
    const same = prev.size === nodes.length && nodes.every((n) => prev.has(n.id)) && g.graphData().links.length === links.length;
    if (same) {
      // Sadece etiket/renk değişti: simülasyonu yeniden başlatma
      for (const n of nodes) Object.assign(prev.get(n.id)!, { label: n.label, color: n.color, deg: n.deg });
      const c = g.centerAt();
      g.centerAt(c.x, c.y);
    } else {
      g.graphData({ nodes, links });
    }
  }, [notes]);

  useEffect(() => {
    const g = graph.current;
    if (!g) return;
    const c = g.centerAt();
    g.centerAt(c.x, c.y);
  }, [highlight]);

  return <div ref={box} className={`graph ${className ?? ''}`} />;
}
