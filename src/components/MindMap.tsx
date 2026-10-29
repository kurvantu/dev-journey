"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MINDMAP, type MindNode } from "@/data/mindmap";

interface Laid {
  node: MindNode;
  depth: number;
  angle: number;
  r: number;
  x: number;
  y: number;
  parent: Laid | null;
  hasChildren: boolean;
  expanded: boolean;
  color: string;
}

const RADII = [0, 170, 400, 610];
const KIND_LABEL: Record<MindNode["kind"], string> = {
  root: "North star",
  pillar: "Pillar",
  concept: "Universal concept",
  language: "Language track",
  framework: "Framework / tool",
  practice: "Practice",
};

function collectIds(n: MindNode, out: string[] = []): string[] {
  out.push(n.id);
  n.children?.forEach((c) => collectIds(c, out));
  return out;
}

function findPath(n: MindNode, id: string, path: MindNode[] = []): MindNode[] | null {
  const next = [...path, n];
  if (n.id === id) return next;
  for (const c of n.children ?? []) {
    const p = findPath(c, id, next);
    if (p) return p;
  }
  return null;
}

function layout(root: MindNode, expanded: Set<string>): Laid[] {
  const out: Laid[] = [];
  const leaves = (n: MindNode): number =>
    !n.children?.length || !expanded.has(n.id) ? 1 : n.children.reduce((a, c) => a + leaves(c), 0);

  const place = (n: MindNode, depth: number, a0: number, a1: number, parent: Laid | null, inherited: string) => {
    const angle = (a0 + a1) / 2;
    const r = RADII[Math.min(depth, RADII.length - 1)];
    const color = n.color ?? inherited;
    const laid: Laid = {
      node: n,
      depth,
      angle,
      r,
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      parent,
      hasChildren: Boolean(n.children?.length),
      expanded: expanded.has(n.id),
      color,
    };
    out.push(laid);
    if (n.children?.length && expanded.has(n.id)) {
      const total = leaves(n);
      let a = a0;
      for (const c of n.children) {
        const span = ((a1 - a0) * leaves(c)) / total;
        place(c, depth + 1, a, a + span, laid, color);
        a += span;
      }
    }
  };
  place(root, 0, -Math.PI / 2, 1.5 * Math.PI, null, "#94a3b8");
  return out;
}

const DEFAULT_EXPANDED = ["root", "mindset", "concepts", "languages", "loop"];

export default function MindMap() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED));
  const [selectedId, setSelectedId] = useState<string>("root");
  const [query, setQuery] = useState("");
  const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const nodes = useMemo(() => layout(MINDMAP, expanded), [expanded]);
  const selectedPath = useMemo(() => findPath(MINDMAP, selectedId) ?? [MINDMAP], [selectedId]);
  const selected = selectedPath[selectedPath.length - 1];
  const pathIds = useMemo(() => new Set(selectedPath.map((n) => n.id)), [selectedPath]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    const out = new Set<string>();
    const walk = (n: MindNode) => {
      if (n.label.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q)) out.add(n.id);
      n.children?.forEach(walk);
    };
    walk(MINDMAP);
    return out;
  }, [query]);

  // auto-expand ancestors of search matches
  useEffect(() => {
    if (matches.size === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      matches.forEach((id) => findPath(MINDMAP, id)?.forEach((n) => next.add(n.id)));
      return next;
    });
  }, [matches]);

  const toggle = useCallback((n: MindNode) => {
    setSelectedId(n.id);
    if (!n.children?.length) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) {
        // collapse this node and all descendants
        collectIds(n).forEach((id) => next.delete(id));
        next.add(n.id);
        next.delete(n.id);
      } else next.add(n.id);
      return next;
    });
  }, []);

  const focus = useCallback((id: string) => {
    setSelectedId(id);
    setExpanded((prev) => {
      const next = new Set(prev);
      findPath(MINDMAP, id)?.forEach((n) => next.add(n.id));
      return next;
    });
  }, []);

  /* ─── pan & zoom ─── */
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.3, v.k * (e.deltaY > 0 ? 0.9 : 1.1)));
        return { ...v, k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = drag.current;
    setView((v) => ({ ...v, x: d.vx + (e.clientX - d.x), y: d.vy + (e.clientY - d.y) }));
  };
  const onPointerUp = () => (drag.current = null);

  const edgePath = (c: Laid) => {
    const p = c.parent!;
    const rm = (p.r + c.r) / 2;
    const pa = p.r === 0 ? c.angle : p.angle;
    const c1 = { x: rm * Math.cos(pa), y: rm * Math.sin(pa) };
    const c2 = { x: rm * Math.cos(c.angle), y: rm * Math.sin(c.angle) };
    return `M${p.x},${p.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${c.x},${c.y}`;
  };

  const expandAll = () => setExpanded(new Set(collectIds(MINDMAP)));
  const collapseAll = () => setExpanded(new Set(["root"]));
  const resetView = () => setView({ x: 0, y: 0, k: 0.8 });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ─── canvas ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#070b14] shadow-2xl shadow-black/40">
        <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: 'ownership', 'Laravel', 'errors'…"
            className="w-64 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
          <button onClick={expandAll} className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
            Expand all
          </button>
          <button onClick={collapseAll} className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
            Collapse
          </button>
          <button onClick={resetView} className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
            Reset view
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-3 rounded-xl bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f472b6]" />Mindset</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#fbbf24]" />Concepts</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#38bdf8]" />Languages</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[#34d399]" />Framework loop</span>
          <span className="text-slate-500">· drag to pan · scroll to zoom · click to expand</span>
        </div>

        <svg
          ref={svgRef}
          className="h-[70vh] min-h-[520px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
          viewBox="-700 -450 1400 900"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <defs>
            <radialGradient id="rootGlow">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.9" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {/* orbit rings */}
            {RADII.slice(1).map((r) => (
              <circle key={r} r={r} fill="none" stroke="#1e293b" strokeDasharray="2 6" />
            ))}
            {/* edges */}
            {nodes
              .filter((n) => n.parent)
              .map((n) => {
                const onPath = pathIds.has(n.node.id) && pathIds.has(n.parent!.node.id);
                return (
                  <path
                    key={`e-${n.node.id}`}
                    d={edgePath(n)}
                    fill="none"
                    stroke={onPath ? n.color : "#334155"}
                    strokeWidth={onPath ? 2.5 : 1.2}
                    strokeOpacity={onPath ? 1 : 0.8}
                  />
                );
              })}
            {/* nodes */}
            {nodes.map((n) => {
              const isRoot = n.depth === 0;
              const isSelected = n.node.id === selectedId;
              const isMatch = matches.has(n.node.id);
              const dim = query && !isMatch && !pathIds.has(n.node.id);
              const deg = (n.angle * 180) / Math.PI;
              const left = Math.cos(n.angle) < 0;
              const radius = isRoot ? 46 : n.depth === 1 ? 11 : n.depth === 2 ? 7 : 5;
              return (
                <g
                  key={n.node.id}
                  className="mind-node"
                  transform={`translate(${n.x},${n.y})`}
                  opacity={dim ? 0.25 : 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(n.node);
                  }}
                >
                  {isRoot ? (
                    <>
                      <circle r={radius} fill="url(#rootGlow)" filter="url(#glow)" />
                      <text textAnchor="middle" fontSize="12" fontWeight="700" fill="#052e16" y="-3">
                        Polyglot
                      </text>
                      <text textAnchor="middle" fontSize="12" fontWeight="700" fill="#052e16" y="11">
                        Developer
                      </text>
                    </>
                  ) : (
                    <>
                      {(isSelected || isMatch) && <circle r={radius + 7} fill={n.color} opacity="0.25" filter="url(#glow)" />}
                      <circle
                        r={radius}
                        fill={n.hasChildren && !n.expanded ? "#0f172a" : n.color}
                        stroke={n.color}
                        strokeWidth={n.hasChildren ? 2.5 : 1.5}
                      />
                      {n.hasChildren && !n.expanded && (
                        <text textAnchor="middle" fontSize={radius * 1.4} fill={n.color} y={radius * 0.5} fontWeight="700">
                          +
                        </text>
                      )}
                      <text
                        transform={left ? `rotate(${deg + 180}) translate(${-(radius + 7)},0)` : `rotate(${deg}) translate(${radius + 7},0)`}
                        textAnchor={left ? "end" : "start"}
                        dominantBaseline="middle"
                        fontSize={n.depth === 1 ? 15 : n.depth === 2 ? 12 : 11}
                        fontWeight={n.depth === 1 ? 700 : isSelected ? 700 : 500}
                        fill={isSelected ? "#ffffff" : n.depth === 1 ? n.color : "#cbd5e1"}
                        style={{ paintOrder: "stroke", stroke: "#070b14", strokeWidth: 4 }}
                      >
                        {n.node.label}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ─── detail panel ─── */}
      <aside className="float-in max-h-[70vh] overflow-auto rounded-3xl border border-slate-800 bg-slate-900/60 p-5" key={selected.id}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {selectedPath.map((n, i) => (
            <span key={n.id} className="flex items-center gap-2">
              {i > 0 && <span>›</span>}
              <button onClick={() => focus(n.id)} className={`hover:text-slate-200 ${i === selectedPath.length - 1 ? "text-slate-300" : ""}`}>
                {n.label}
              </button>
            </span>
          ))}
        </div>
        <span
          className="mt-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
          style={{ background: `${nodeColor(selected)}22`, color: nodeColor(selected) }}
        >
          {KIND_LABEL[selected.kind]}
        </span>
        <h2 className="mt-2 text-2xl font-bold text-white">{selected.label}</h2>
        <p className="mt-2 leading-relaxed text-slate-300">{selected.summary}</p>

        {selected.why && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Why it matters</div>
            <p className="mt-1 text-sm text-slate-300">{selected.why}</p>
          </div>
        )}

        {selected.path && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Learning path</div>
            <ol className="mt-2 space-y-1.5">
              {selected.path.map((s, i) => (
                <li key={s} className="flex gap-2 text-sm text-slate-200">
                  <span className="font-mono text-xs text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        {selected.link && (
          <Link
            href={selected.link}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
          >
            {selected.kind === "language" ? "Open lessons" : selected.kind === "concept" ? "Compare across languages" : "Open"} →
          </Link>
        )}

        {selected.children && selected.children.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Branches ({selected.children.length})</div>
            <ul className="mt-2 grid gap-1.5">
              {selected.children.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => focus(c.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-slate-600"
                  >
                    <span>{c.label}</span>
                    <span className="text-slate-600">→</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function nodeColor(n: MindNode): string {
  if (n.color) return n.color;
  const path = findPath(MINDMAP, n.id) ?? [];
  for (let i = path.length - 1; i >= 0; i--) if (path[i].color) return path[i].color!;
  return "#34d399";
}
