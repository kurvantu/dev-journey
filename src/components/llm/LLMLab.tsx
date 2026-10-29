"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MicroLLM, makeRng, selfAttention } from "@/lib/microllm";
import NetworkDiagram from "./NetworkDiagram";
import { Heatmap, LossChart, ProbBars } from "./Viz";

const PRESETS: { name: string; text: string }[] = [
  { name: "hello llm", text: "hello world. hello llm. hello neural net. " },
  { name: "nursery rhyme", text: "the cat sat on the mat. the cat ate the rat. the rat ran. " },
  { name: "code-ish", text: "def train(model): return model.fit(data) def test(model): return model.eval(data) " },
  { name: "abab pattern", text: "ababababcdcdcdcdababababcdcdcdcd" },
];

type Stage = "tokenize" | "forward" | "train" | "attention" | "generate";

const STAGES: { id: Stage; n: string; title: string; blurb: string }[] = [
  { id: "tokenize", n: "1", title: "Tokenize", blurb: "Text → integers. The model never sees letters." },
  { id: "forward", n: "2", title: "Forward pass", blurb: "One-hot → embedding → tanh → logits → softmax." },
  { id: "train", n: "3", title: "Train", blurb: "Cross-entropy loss, backprop, gradient descent." },
  { id: "attention", n: "4", title: "Attention", blurb: "Which earlier tokens does each token look at?" },
  { id: "generate", n: "5", title: "Generate", blurb: "Sample a token, append, repeat. That is ChatGPT." },
];

export default function LLMLab() {
  const [corpus, setCorpus] = useState(PRESETS[0].text);
  const [hidden, setHidden] = useState(24);
  const [lr, setLr] = useState(0.5);
  const [speed, setSpeed] = useState(4);
  const [temperature, setTemperature] = useState(0.8);
  const [stage, setStage] = useState<Stage>("tokenize");
  const [causal, setCausal] = useState(true);

  const [model, setModel] = useState(() => new MicroLLM(PRESETS[0].text, 24, 1337));
  const [, forceRender] = useState(0);
  const [training, setTraining] = useState(false);
  const [probe, setProbe] = useState("h");
  const [sample, setSample] = useState("");
  const raf = useRef<number | null>(null);

  const rebuild = useCallback(
    (text: string, h: number) => {
      setTraining(false);
      const m = new MicroLLM(text, h, 1337);
      setModel(m);
      setProbe(m.vocab.find((c) => c.trim()) ?? m.vocab[0]);
      setSample("");
    },
    [],
  );

  // training loop
  useEffect(() => {
    if (!training) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      for (let i = 0; i < speed; i++) model.trainStep(lr);
      forceRender((n) => n + 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [training, model, lr, speed]);

  const probeId = model.stoi.get(probe) ?? 0;
  const trace = useMemo(() => model.forward(probeId), [model, probeId, model.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = useMemo(() => Array.from(corpus).map((c) => model.stoi.get(c) ?? -1), [corpus, model]);
  const loss = model.history[model.history.length - 1]?.loss ?? null;

  const attnTokens = useMemo(() => Array.from(corpus.slice(0, 14)), [corpus]);
  const attention = useMemo(() => {
    const emb = attnTokens.map((c) => model.W1[model.stoi.get(c) ?? 0]);
    if (!emb.length) return null;
    return selfAttention(emb, attnTokens, causal, 8);
  }, [attnTokens, model, causal, model.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const doGenerate = () => {
    const rng = makeRng(Date.now() & 0xffff);
    setSample(model.generate(probe, 120, temperature, rng));
  };

  const vocabLabels = model.vocab;
  const hiddenLabels = Array.from({ length: model.H }, (_, i) => String(i));

  return (
    <div className="space-y-6">
      {/* ─── control bar ─── */}
      <div className="sticky top-[57px] z-30 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setTraining((t) => !t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition ${
              training ? "bg-amber-500 text-amber-950 hover:bg-amber-400" : "bg-emerald-500 text-emerald-950 shadow-emerald-500/20 hover:bg-emerald-400"
            }`}
          >
            {training ? "⏸ Pause" : "▶ Train"}
          </button>
          <button
            onClick={() => {
              setTraining(false);
              model.trainStep(lr);
              forceRender((n) => n + 1);
            }}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            Step ×1
          </button>
          <button onClick={() => rebuild(corpus, hidden)} className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">
            ↺ Reset weights
          </button>

          <div className="flex items-center gap-4 rounded-xl bg-slate-950/60 px-4 py-2 font-mono text-xs">
            <span className="text-slate-400">
              step <b className="text-white">{model.step}</b>
            </span>
            <span className="text-slate-400">
              loss <b className={loss !== null && loss < 1 ? "text-emerald-400" : "text-amber-300"}>{loss !== null ? loss.toFixed(4) : "—"}</b>
            </span>
            <span className="hidden text-slate-400 sm:inline">
              bits/char <b className="text-sky-300">{loss !== null ? (loss / Math.LN2).toFixed(3) : "—"}</b>
            </span>
            <span className="hidden text-slate-400 md:inline">
              params <b className="text-white">{model.paramCount.toLocaleString()}</b>
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400">
            lr
            <input type="range" min={0.05} max={3} step={0.05} value={lr} onChange={(e) => setLr(Number(e.target.value))} className="w-24 accent-emerald-500" />
            <b className="w-8 font-mono text-slate-200">{lr.toFixed(2)}</b>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            steps/frame
            <input type="range" min={1} max={20} step={1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-20 accent-emerald-500" />
            <b className="w-5 font-mono text-slate-200">{speed}</b>
          </label>
        </div>
      </div>

      {/* ─── stage tabs ─── */}
      <div className="grid gap-2 sm:grid-cols-5">
        {STAGES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`rounded-2xl border p-3 text-left transition ${
              stage === s.id ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 place-items-center rounded-lg font-mono text-xs font-bold ${stage === s.id ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-300"}`}>
                {s.n}
              </span>
              <span className="text-sm font-semibold text-white">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{s.blurb}</p>
          </button>
        ))}
      </div>

      {/* ─── corpus + probe ─── */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Training corpus</h3>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setCorpus(p.text);
                    rebuild(p.text, hidden);
                  }}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={corpus}
            onChange={(e) => setCorpus(e.target.value)}
            onBlur={() => rebuild(corpus, hidden)}
            rows={3}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              {corpus.length} chars · {model.V} vocab · {model.pairs.length} training pairs
            </span>
            <label className="flex items-center gap-2">
              hidden units
              <input
                type="range"
                min={4}
                max={64}
                step={4}
                value={hidden}
                onChange={(e) => setHidden(Number(e.target.value))}
                onMouseUp={() => rebuild(corpus, hidden)}
                onTouchEnd={() => rebuild(corpus, hidden)}
                className="w-24 accent-emerald-500"
              />
              <b className="font-mono text-slate-200">{hidden}</b>
            </label>
            <span className="text-slate-600">(editing the corpus or hidden size resets the weights)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">
            Probe token — <span className="text-emerald-400">what comes after this?</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            {model.vocab.map((c) => (
              <button
                key={c}
                onClick={() => setProbe(c)}
                className={`h-7 min-w-7 rounded-md px-1.5 font-mono text-xs transition ${c === probe ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                {c === " " ? "␣" : c === "\n" ? "⏎" : c}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <ProbBars labels={model.vocab} probs={trace.probs} top={6} />
          </div>
        </div>
      </div>

      {/* ─── stage content ─── */}
      {stage === "tokenize" && (
        <Section
          title="1 · Tokenize — text becomes integers"
          body="The vocabulary is every distinct character, sorted. Each one gets an index. Everything downstream is arithmetic on these numbers; the model has no idea what a letter is."
          pyLink="/learn/python/llm-tokenizer"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Vocabulary ({model.V} tokens)</h4>
              <div className="flex flex-wrap gap-1.5">
                {model.vocab.map((c, i) => (
                  <span key={c} className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs">
                    <b className="text-emerald-400">{i}</b>
                    <span className="text-slate-300">{c === " " ? "␣" : c === "\n" ? "⏎" : c}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Encoded corpus</h4>
              <div className="max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {ids.map((id, i) => (
                  <span key={i} className="mr-1 inline-block rounded bg-slate-800/70 px-1 text-sky-300">
                    {id}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Training pairs are (token<sub>i</sub> → token<sub>i+1</sub>): {model.pairs.length} examples of &ldquo;given this, predict the next&rdquo;.
              </p>
            </div>
          </div>
        </Section>
      )}

      {stage === "forward" && (
        <Section
          title="2 · Forward pass — watch one token flow through the network"
          body="The input is a one-hot vector, so multiplying by W1 just selects row W1[token] — that row IS the token's embedding. tanh squashes it, W2 projects it back to one score per vocabulary token, and softmax turns those scores into probabilities. Warm colours are positive values, cool are negative; node size is magnitude."
          pyLink="/learn/python/llm-embeddings"
        >
          <NetworkDiagram vocab={model.vocab} trace={trace} W2={model.W2} />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Heatmap
              matrix={[trace.preActivation]}
              rowLabels={[probe === " " ? "␣" : probe]}
              title={`W1[${probe === " " ? "␣" : probe}] — the embedding`}
              subtitle="One row of the embedding table: this token's learned vector."
              cell={14}
            />
            <Heatmap matrix={[trace.hidden]} rowLabels={["h"]} title="hidden = tanh(embedding)" subtitle="Squashed into (−1, 1). This is the token's internal representation." cell={14} />
            <Heatmap matrix={[trace.logits]} rowLabels={["z"]} colLabels={vocabLabels} title="logits = h · W2 + b2" subtitle="One raw score per vocabulary token, before softmax." cell={14} />
          </div>
        </Section>
      )}

      {stage === "train" && (
        <Section
          title="3 · Train — gradients reshape the matrices"
          body="Loss = −log(probability the model assigned to the correct next character). Backprop computes how every weight contributed to that error, then each weight steps a little way downhill. Press Train and watch the weight matrices organise themselves out of random noise."
          pyLink="/learn/python/llm-train"
        >
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Loss curve</h4>
              <LossChart history={model.history} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <Stat label="step" value={String(model.step)} />
                <Stat label="loss" value={loss !== null ? loss.toFixed(4) : "—"} />
                <Stat label="random baseline" value={Math.log(model.V).toFixed(4)} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                A loss of {Math.log(model.V).toFixed(2)} means &ldquo;pure guessing&rdquo; ({model.V} equally likely tokens). Every bit below that is knowledge the model extracted from your text.
              </p>
            </div>
            <Heatmap
              matrix={model.W1}
              rowLabels={vocabLabels}
              title="W1 — embedding table (V × H)"
              subtitle="Each row is one token's vector. Rows for characters that behave alike drift toward similar patterns."
              cell={13}
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Heatmap matrix={model.W2} rowLabels={hiddenLabels} colLabels={vocabLabels} title="W2 — output projection (H × V)" subtitle="Maps hidden state to a score for every possible next token." cell={13} />
            <Heatmap
              matrix={model.gW1}
              rowLabels={vocabLabels}
              title="∂loss/∂W1 — the gradient"
              subtitle="The correction signal from the last step. Weights move opposite to this, scaled by the learning rate. It fades toward zero as the model converges."
              cell={13}
            />
          </div>
        </Section>
      )}

      {stage === "attention" && attention && (
        <Section
          title="4 · Attention — which tokens look at which?"
          body="Real transformers add this layer. Each token builds a Query, a Key and a Value from its embedding; scores = Q·Kᵀ/√d_k, then softmax gives the weights below. The causal mask zeroes everything above the diagonal so a token can never read the future — that constraint is the only thing separating a GPT from a BERT."
          pyLink="/learn/python/llm-attention"
        >
          <div className="mb-3 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={causal} onChange={(e) => setCausal(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
              Causal mask (GPT-style, no peeking ahead)
            </label>
            <span className="text-xs text-slate-500">{causal ? "Decoder: lower-triangular" : "Encoder: every token sees every other token"}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Heatmap
              matrix={attention.weights}
              rowLabels={attention.tokens}
              colLabels={attention.tokens}
              title="Attention weights — softmax(mask(Q·Kᵀ/√d_k))"
              subtitle="Row = the token doing the looking, column = the token being looked at. Each row sums to 1."
              scale="prob"
              cell={22}
            />
            <Heatmap
              matrix={attention.scores.map((r, i) => r.map((v, j) => (causal && j > i ? 0 : v)))}
              rowLabels={attention.tokens}
              colLabels={attention.tokens}
              title="Raw scores before softmax"
              subtitle="Dot-product similarity between each Query and each Key, divided by √d_k to keep gradients stable."
              cell={22}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            These use your model&apos;s live embeddings, so the pattern changes as you train. Projections Wq/Wk/Wv are fixed random here — in a real transformer they are learned too.
          </p>
        </Section>
      )}

      {stage === "generate" && (
        <Section
          title="5 · Generate — sampling one token at a time"
          body="Feed a token in, read the probability distribution, draw a sample from it, append, and feed that back in. Temperature divides the logits before softmax: low temperature sharpens the distribution (confident, repetitive), high temperature flattens it (creative, chaotic). This loop is exactly how every chatbot produces text."
          pyLink="/learn/python/llm-generate"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                Temperature
                <input type="range" min={0.1} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="flex-1 accent-emerald-500" />
                <b className="w-8 font-mono text-emerald-400">{temperature.toFixed(1)}</b>
              </label>
              <p className="mt-1 text-xs text-slate-500">{temperature < 0.5 ? "Sharp & repetitive" : temperature > 1.2 ? "Chaotic & creative" : "Balanced"}</p>
              <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Distribution after &ldquo;{probe === " " ? "␣" : probe}&rdquo; at T={temperature.toFixed(1)}
              </h4>
              <div className="mt-2">
                <ProbBars labels={model.vocab} probs={model.forward(probeId, temperature).probs} top={8} />
              </div>
              <button onClick={doGenerate} className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
                ✨ Generate 120 characters
              </button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Model output</h4>
              {sample ? (
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-950 p-4 font-mono text-sm leading-relaxed text-emerald-200">{sample}</pre>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                  Train for a few hundred steps, then press Generate.
                  <br />
                  <span className="text-xs text-slate-600">Untrained output is random noise — that is the point.</span>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                With {model.paramCount.toLocaleString()} parameters and {model.pairs.length} examples this model can only learn character statistics. GPT-4 is the same five steps with ~10
                <sup>12</sup> parameters, trillions of tokens, and attention layers stacked 100 deep.
              </p>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, body, children, pyLink }: { title: string; body: string; children: React.ReactNode; pyLink: string }) {
  return (
    <section className="float-in">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-4xl">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
        </div>
        <Link href={pyLink} className="shrink-0 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-200 hover:bg-yellow-500/20">
          🐍 Run this in Python →
        </Link>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/60 p-2">
      <div className="font-mono text-sm font-bold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
