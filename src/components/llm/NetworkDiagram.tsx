"use client";

import type { ForwardTrace } from "@/lib/microllm";

/**
 * Draws the actual network for one forward pass:
 *   one-hot(token) → W1 → tanh(hidden) → W2 → logits → softmax
 * Node brightness = activation value, edge brightness = |weight|.
 */
export default function NetworkDiagram({
  vocab,
  trace,
  W2,
  maxEdges = 140,
}: {
  vocab: string[];
  trace: ForwardTrace;
  W2: number[][];
  maxEdges?: number;
}) {
  const V = vocab.length;
  const H = trace.hidden.length;

  const W = 880;
  const Ht = 440;
  const colX = [70, 300, 580, 810];
  const topPad = 34;
  const usable = Ht - topPad - 26;

  const posY = (i: number, count: number) => topPad + (count === 1 ? usable / 2 : (i / (count - 1)) * usable);

  const hiddenAbsMax = Math.max(...trace.hidden.map(Math.abs), 1e-6);
  const probMax = Math.max(...trace.probs, 1e-6);

  // Only draw the strongest hidden→output edges, otherwise it is spaghetti.
  const edges: { j: number; k: number; w: number }[] = [];
  for (let j = 0; j < H; j++) for (let k = 0; k < V; k++) edges.push({ j, k, w: W2[j][k] });
  edges.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const shown = edges.slice(0, maxEdges);
  const edgeMax = Math.abs(shown[0]?.w ?? 1) || 1;

  const topK = trace.probs
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3)
    .map((d) => d.i);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#070b14] p-3">
      <svg viewBox={`0 0 ${W} ${Ht}`} className="w-full min-w-[760px]">
        {/* column headings */}
        {[
          { x: colX[0], t: "input", s: `one-hot · ${V}` },
          { x: colX[1], t: "hidden", s: `tanh(W1[t]) · ${H}` },
          { x: colX[2], t: "logits", s: `h·W2 + b2 · ${V}` },
          { x: colX[3], t: "softmax", s: "probabilities" },
        ].map((c) => (
          <g key={c.t}>
            <text x={c.x} y={14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#e2e8f0">
              {c.t}
            </text>
            <text x={c.x} y={26} textAnchor="middle" fontSize="8.5" fill="#64748b" fontFamily="monospace">
              {c.s}
            </text>
          </g>
        ))}

        {/* input → hidden : only the active row of W1 matters (one-hot!) */}
        {trace.hidden.map((h, j) => (
          <line
            key={`ih-${j}`}
            x1={colX[0] + 9}
            y1={posY(trace.tokenId, V)}
            x2={colX[1] - 7}
            y2={posY(j, H)}
            stroke={h >= 0 ? "#fbbf24" : "#38bdf8"}
            strokeWidth={0.4 + (Math.abs(h) / hiddenAbsMax) * 1.8}
            strokeOpacity={0.15 + (Math.abs(h) / hiddenAbsMax) * 0.6}
          />
        ))}

        {/* hidden → logits */}
        {shown.map((e, idx) => (
          <line
            key={`hl-${idx}`}
            x1={colX[1] + 7}
            y1={posY(e.j, H)}
            x2={colX[2] - 7}
            y2={posY(e.k, V)}
            stroke={e.w >= 0 ? "#fbbf24" : "#38bdf8"}
            strokeWidth={0.3 + (Math.abs(e.w) / edgeMax) * 1.1}
            strokeOpacity={0.06 + (Math.abs(e.w) / edgeMax) * 0.3}
          />
        ))}

        {/* logits → softmax */}
        {trace.probs.map((p, k) => (
          <line
            key={`ls-${k}`}
            x1={colX[2] + 7}
            y1={posY(k, V)}
            x2={colX[3] - 9}
            y2={posY(k, V)}
            stroke="#34d399"
            strokeWidth={0.5 + (p / probMax) * 3}
            strokeOpacity={0.15 + (p / probMax) * 0.85}
          />
        ))}

        {/* input nodes */}
        {vocab.map((c, i) => {
          const active = i === trace.tokenId;
          return (
            <g key={`in-${i}`}>
              <circle
                cx={colX[0]}
                cy={posY(i, V)}
                r={active ? 8 : 4}
                fill={active ? "#34d399" : "#1e293b"}
                stroke={active ? "#a7f3d0" : "#334155"}
                strokeWidth={active ? 2 : 1}
              />
              <text
                x={colX[0] - 15}
                y={posY(i, V) + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="monospace"
                fill={active ? "#6ee7b7" : "#475569"}
                fontWeight={active ? 700 : 400}
              >
                {label(c)}
              </text>
              {active && (
                <text x={colX[0]} y={posY(i, V) - 13} textAnchor="middle" fontSize="8" fill="#6ee7b7" fontFamily="monospace">
                  1.0
                </text>
              )}
            </g>
          );
        })}

        {/* hidden nodes */}
        {trace.hidden.map((h, j) => {
          const a = Math.abs(h) / hiddenAbsMax;
          return (
            <circle
              key={`hn-${j}`}
              cx={colX[1]}
              cy={posY(j, H)}
              r={3 + a * 3.5}
              fill={h >= 0 ? `rgba(251,191,36,${0.2 + a * 0.8})` : `rgba(56,189,248,${0.2 + a * 0.8})`}
              stroke="#0f172a"
            >
              <title>{`hidden[${j}] = tanh(${trace.preActivation[j].toFixed(3)}) = ${h.toFixed(4)}`}</title>
            </circle>
          );
        })}

        {/* logit nodes */}
        {trace.logits.map((l, k) => {
          const lm = Math.max(...trace.logits.map(Math.abs), 1e-6);
          const a = Math.abs(l) / lm;
          return (
            <circle
              key={`ln-${k}`}
              cx={colX[2]}
              cy={posY(k, V)}
              r={3 + a * 3}
              fill={l >= 0 ? `rgba(251,191,36,${0.2 + a * 0.8})` : `rgba(56,189,248,${0.2 + a * 0.8})`}
              stroke="#0f172a"
            >
              <title>{`logit[${label(vocab[k])}] = ${l.toFixed(4)}`}</title>
            </circle>
          );
        })}

        {/* output nodes */}
        {trace.probs.map((p, k) => {
          const isTop = topK.includes(k);
          return (
            <g key={`on-${k}`}>
              <circle cx={colX[3]} cy={posY(k, V)} r={3 + (p / probMax) * 6} fill={`rgba(52,211,153,${0.15 + (p / probMax) * 0.85})`} stroke="#0f172a">
                <title>{`P(${label(vocab[k])}) = ${(p * 100).toFixed(2)}%`}</title>
              </circle>
              {isTop && p > 0.02 && (
                <text x={colX[3] + 14} y={posY(k, V) + 3} fontSize="9" fontFamily="monospace" fill="#6ee7b7" fontWeight={700}>
                  {label(vocab[k])} {(p * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function label(c: string) {
  if (c === " ") return "␣";
  if (c === "\n") return "⏎";
  return c;
}
