"use client";

import { useMemo, useState } from "react";
import type { Matrix } from "@/lib/microllm";

/** Diverging colour scale: sky (negative) → slate (zero) → amber (positive). */
export function heatColor(v: number, max: number): string {
  if (!isFinite(v)) return "#1e293b";
  const t = Math.max(-1, Math.min(1, max === 0 ? 0 : v / max));
  const a = Math.abs(t);
  if (t >= 0) return `rgba(251, 191, 36, ${0.08 + a * 0.92})`;
  return `rgba(56, 189, 248, ${0.08 + a * 0.92})`;
}

/** Sequential scale for probabilities in [0,1]. */
export function probColor(p: number): string {
  return `rgba(52, 211, 153, ${0.06 + Math.min(1, p) * 0.94})`;
}

export function absMax(m: Matrix): number {
  let max = 0;
  for (const row of m) for (const v of row) if (isFinite(v)) max = Math.max(max, Math.abs(v));
  return max || 1;
}

interface HeatmapProps {
  matrix: Matrix;
  rowLabels?: string[];
  colLabels?: string[];
  title: string;
  subtitle?: string;
  /** "diverging" for weights/gradients, "prob" for attention/softmax */
  scale?: "diverging" | "prob";
  cell?: number;
  format?: (v: number) => string;
}

export function Heatmap({ matrix, rowLabels, colLabels, title, subtitle, scale = "diverging", cell = 16, format }: HeatmapProps) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const max = useMemo(() => absMax(matrix), [matrix]);
  const fmt = format ?? ((v: number) => (scale === "prob" ? `${(v * 100).toFixed(1)}%` : v.toFixed(4)));
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const showRowLabels = Boolean(rowLabels) && rows <= 40;
  const showColLabels = Boolean(colLabels) && cols <= 40;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="font-mono text-[11px] text-slate-500">
          {rows}×{cols}
        </span>
      </div>
      {subtitle && <p className="mb-3 text-xs leading-relaxed text-slate-400">{subtitle}</p>}

      <div className="overflow-auto">
        <div className="inline-block">
          {showColLabels && (
            <div className="flex" style={{ marginLeft: showRowLabels ? 28 : 0 }}>
              {colLabels!.map((c, j) => (
                <div
                  key={j}
                  className="shrink-0 text-center font-mono text-[9px] text-slate-500"
                  style={{ width: cell, height: 14 }}
                  title={c}
                >
                  {c === " " ? "␣" : c === "\n" ? "⏎" : c.slice(0, 2)}
                </div>
              ))}
            </div>
          )}
          {matrix.map((row, i) => (
            <div key={i} className="flex items-center">
              {showRowLabels && (
                <div className="shrink-0 pr-1 text-right font-mono text-[9px] text-slate-500" style={{ width: 28 }} title={rowLabels![i]}>
                  {rowLabels![i] === " " ? "␣" : rowLabels![i] === "\n" ? "⏎" : rowLabels![i]?.slice(0, 3)}
                </div>
              )}
              {row.map((v, j) => (
                <div
                  key={j}
                  onMouseEnter={() => setHover({ i, j })}
                  onMouseLeave={() => setHover(null)}
                  className="shrink-0 border border-slate-950/60 transition-transform hover:z-10 hover:scale-150 hover:border-white"
                  style={{
                    width: cell,
                    height: cell,
                    background: scale === "prob" ? probColor(v) : heatColor(v, max),
                  }}
                  title={`[${rowLabels?.[i] ?? i}, ${colLabels?.[j] ?? j}] = ${fmt(v)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          {scale === "prob" ? (
            <>
              0
              <span className="inline-block h-2 w-16 rounded" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.06), rgba(52,211,153,1))" }} />
              1
            </>
          ) : (
            <>
              −{max.toFixed(2)}
              <span
                className="inline-block h-2 w-20 rounded"
                style={{ background: "linear-gradient(90deg, rgba(56,189,248,1), rgba(30,41,59,1), rgba(251,191,36,1))" }}
              />
              +{max.toFixed(2)}
            </>
          )}
        </span>
        <span className="font-mono">
          {hover ? `[${rowLabels?.[hover.i] ?? hover.i}, ${colLabels?.[hover.j] ?? hover.j}] = ${fmt(matrix[hover.i][hover.j])}` : "hover a cell"}
        </span>
      </div>
    </div>
  );
}

/** Horizontal bar chart of a probability distribution. */
export function ProbBars({ labels, probs, top = 8, highlight }: { labels: string[]; probs: number[]; top?: number; highlight?: string }) {
  const ranked = probs
    .map((p, i) => ({ p, label: labels[i] }))
    .sort((a, b) => b.p - a.p)
    .slice(0, top);
  return (
    <ul className="space-y-1">
      {ranked.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          <code className={`w-8 shrink-0 rounded px-1 text-center text-xs ${r.label === highlight ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-200"}`}>
            {r.label === " " ? "␣" : r.label === "\n" ? "⏎" : r.label}
          </code>
          <div className="h-3.5 flex-1 overflow-hidden rounded bg-slate-800">
            <div className="h-full rounded bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-200" style={{ width: `${r.p * 100}%` }} />
          </div>
          <span className="w-12 shrink-0 text-right font-mono text-[11px] text-slate-400">{(r.p * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Loss curve over training steps. */
export function LossChart({ history }: { history: { step: number; loss: number }[] }) {
  const W = 520;
  const H = 150;
  const pad = { l: 36, r: 8, t: 8, b: 20 };

  if (history.length < 2) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-600">
        Press ▶ Train to plot the loss curve
      </div>
    );
  }
  const losses = history.map((h) => h.loss);
  const maxL = Math.max(...losses);
  const minL = Math.min(...losses);
  const span = maxL - minL || 1;
  const n = history.length;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (l: number) => pad.t + (1 - (l - minL) / span) * (H - pad.t - pad.b);
  const d = history.map((h, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(h.loss).toFixed(1)}`).join(" ");
  const area = `${d} L${x(n - 1).toFixed(1)},${H - pad.b} L${pad.l},${H - pad.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => {
        const val = minL + f * span;
        const yy = y(val);
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#1e293b" strokeDasharray="3 4" />
            <text x={pad.l - 5} y={yy + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="monospace">
              {val.toFixed(2)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#lossFill)" />
      <path d={d} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(n - 1)} cy={y(losses[n - 1])} r="3.5" fill="#34d399" />
      <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="monospace">
        step {history[n - 1].step}
      </text>
      <text x={pad.l} y={H - 6} fontSize="9" fill="#64748b" fontFamily="monospace">
        cross-entropy loss
      </text>
    </svg>
  );
}
