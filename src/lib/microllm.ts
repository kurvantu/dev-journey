/**
 * MicroLLM – the exact same architecture as the Python lessons
 * (learn/python/llm-train), reimplemented in TypeScript so the browser can
 * train it live and visualise every matrix as it changes.
 *
 *   one-hot(token) -> W1 (embedding) -> tanh -> W2 + b2 -> softmax -> next token
 *
 * No libraries. Every multiply and every gradient is written out.
 */

export type Matrix = number[][];

export interface TrainSnapshot {
  step: number;
  loss: number;
  bitsPerChar: number;
}

export interface ForwardTrace {
  tokenId: number;
  /** the raw embedding row W1[token] before the activation */
  preActivation: number[];
  /** hidden layer after tanh */
  hidden: number[];
  logits: number[];
  probs: number[];
}

function randn(rand: () => number, scale: number) {
  // Box–Muller, scaled – keeps initial activations in a sane range
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * scale;
}

/** Deterministic PRNG (mulberry32) so a seed always gives the same run. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function softmax(xs: number[], temperature = 1): number[] {
  const t = Math.max(temperature, 1e-6);
  const scaled = xs.map((x) => x / t);
  const m = Math.max(...scaled);
  const exps = scaled.map((x) => Math.exp(x - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export class MicroLLM {
  readonly vocab: string[];
  readonly stoi: Map<string, number>;
  readonly V: number;
  readonly H: number;
  readonly pairs: [number, number][];

  W1: Matrix; // V x H  (doubles as the embedding table)
  W2: Matrix; // H x V
  b2: number[];

  /** last computed gradients – shown in the UI so learners see what backprop produced */
  gW1: Matrix;
  gW2: Matrix;

  step = 0;
  history: TrainSnapshot[] = [];
  private rand: () => number;

  constructor(text: string, hidden = 24, seed = 1337) {
    const safe = text.length >= 2 ? text : "hello world. ";
    this.vocab = Array.from(new Set(safe.split(""))).sort();
    this.stoi = new Map(this.vocab.map((c, i) => [c, i]));
    this.V = this.vocab.length;
    this.H = hidden;
    this.rand = makeRng(seed);

    this.pairs = [];
    for (let i = 0; i < safe.length - 1; i++) {
      const a = this.stoi.get(safe[i]);
      const b = this.stoi.get(safe[i + 1]);
      if (a !== undefined && b !== undefined) this.pairs.push([a, b]);
    }

    this.W1 = Array.from({ length: this.V }, () => Array.from({ length: this.H }, () => randn(this.rand, 0.4)));
    this.W2 = Array.from({ length: this.H }, () => Array.from({ length: this.V }, () => randn(this.rand, 0.4)));
    this.b2 = new Array(this.V).fill(0);
    this.gW1 = Array.from({ length: this.V }, () => new Array(this.H).fill(0));
    this.gW2 = Array.from({ length: this.H }, () => new Array(this.V).fill(0));
  }

  get paramCount() {
    return this.V * this.H + this.H * this.V + this.V;
  }

  forward(tokenId: number, temperature = 1): ForwardTrace {
    const pre = this.W1[tokenId];
    const hidden = pre.map(Math.tanh);
    const logits = new Array(this.V).fill(0);
    for (let k = 0; k < this.V; k++) {
      let s = this.b2[k];
      for (let j = 0; j < this.H; j++) s += hidden[j] * this.W2[j][k];
      logits[k] = s;
    }
    return { tokenId, preActivation: pre.slice(), hidden, logits, probs: softmax(logits, temperature) };
  }

  /** One full-batch gradient-descent step. Returns the mean cross-entropy loss. */
  trainStep(lr = 0.5): number {
    const { V, H, pairs } = this;
    const gW1: Matrix = Array.from({ length: V }, () => new Array(H).fill(0));
    const gW2: Matrix = Array.from({ length: H }, () => new Array(V).fill(0));
    const gb2 = new Array(V).fill(0);
    let totalLoss = 0;

    for (const [x, y] of pairs) {
      // ── forward ──
      const h = new Array(H);
      for (let j = 0; j < H; j++) h[j] = Math.tanh(this.W1[x][j]);
      const logits = new Array(V);
      for (let k = 0; k < V; k++) {
        let s = this.b2[k];
        for (let j = 0; j < H; j++) s += h[j] * this.W2[j][k];
        logits[k] = s;
      }
      const probs = softmax(logits);
      totalLoss += -Math.log(probs[y] + 1e-12);

      // ── backward: d(cross-entropy ∘ softmax)/d(logits) = probs - onehot(y) ──
      const dlogits = probs.slice();
      dlogits[y] -= 1;
      const dh = new Array(H).fill(0);
      for (let k = 0; k < V; k++) gb2[k] += dlogits[k];
      for (let j = 0; j < H; j++) {
        const hj = h[j];
        for (let k = 0; k < V; k++) {
          gW2[j][k] += hj * dlogits[k];
          dh[j] += this.W2[j][k] * dlogits[k];
        }
      }
      for (let j = 0; j < H; j++) gW1[x][j] += dh[j] * (1 - h[j] * h[j]); // tanh'
    }

    // ── SGD update ──
    const n = pairs.length || 1;
    for (let i = 0; i < V; i++) for (let j = 0; j < H; j++) this.W1[i][j] -= (lr * gW1[i][j]) / n;
    for (let j = 0; j < H; j++) for (let k = 0; k < V; k++) this.W2[j][k] -= (lr * gW2[j][k]) / n;
    for (let k = 0; k < V; k++) this.b2[k] -= (lr * gb2[k]) / n;

    this.gW1 = gW1.map((r) => r.map((v) => v / n));
    this.gW2 = gW2.map((r) => r.map((v) => v / n));

    const loss = totalLoss / n;
    this.step++;
    this.history.push({ step: this.step, loss, bitsPerChar: loss / Math.LN2 });
    if (this.history.length > 4000) this.history.splice(0, this.history.length - 4000);
    return loss;
  }

  sample(tokenId: number, temperature: number, rand: () => number): number {
    const { probs } = this.forward(tokenId, temperature);
    let r = rand();
    for (let i = 0; i < probs.length; i++) {
      r -= probs[i];
      if (r <= 0) return i;
    }
    return probs.length - 1;
  }

  generate(seed: string, length: number, temperature: number, rand: () => number): string {
    let out = seed;
    let x = this.stoi.get(seed[seed.length - 1] ?? this.vocab[0]) ?? 0;
    for (let i = 0; i < length; i++) {
      x = this.sample(x, temperature, rand);
      out += this.vocab[x];
    }
    return out;
  }

  /** Cosine similarity between two token embeddings (rows of W1). */
  similarity(a: number, b: number): number {
    const u = this.W1[a];
    const v = this.W1[b];
    let dot = 0;
    let nu = 0;
    let nv = 0;
    for (let i = 0; i < this.H; i++) {
      dot += u[i] * v[i];
      nu += u[i] * u[i];
      nv += v[i] * v[i];
    }
    return dot / (Math.sqrt(nu) * Math.sqrt(nv) + 1e-9);
  }
}

/* ───────────────────── self-attention (for visualisation) ───────────────────── */

export interface AttentionResult {
  tokens: string[];
  scores: Matrix;
  weights: Matrix;
  context: Matrix;
  dK: number;
}

/**
 * Scaled dot-product self-attention with a causal mask – the same algorithm as
 * the Python `llm-attention` lesson, run over real learned embeddings so the
 * heatmap reflects what the model actually knows.
 */
export function selfAttention(embeddings: Matrix, tokens: string[], causal: boolean, dK = 8): AttentionResult {
  const n = embeddings.length;
  const d = embeddings[0]?.length ?? 1;
  const rand = makeRng(7);
  const proj = (): Matrix => Array.from({ length: d }, () => Array.from({ length: dK }, () => randn(rand, 1 / Math.sqrt(d))));
  const Wq = proj();
  const Wk = proj();
  const Wv = proj();

  const project = (W: Matrix): Matrix =>
    embeddings.map((row) => {
      const out = new Array(dK).fill(0);
      for (let k = 0; k < d; k++) for (let j = 0; j < dK; j++) out[j] += row[k] * W[k][j];
      return out;
    });

  const Q = project(Wq);
  const K = project(Wk);
  const Vm = project(Wv);

  const scores: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < dK; k++) s += Q[i][k] * K[j][k];
      scores[i][j] = s / Math.sqrt(dK);
    }
  }

  const weights = scores.map((row, i) => {
    const masked = row.map((v, j) => (causal && j > i ? -Infinity : v));
    return softmax(masked);
  });

  const context = weights.map((w) => {
    const out = new Array(dK).fill(0);
    for (let j = 0; j < n; j++) for (let k = 0; k < dK; k++) out[k] += w[j] * Vm[j][k];
    return out;
  });

  return { tokens, scores, weights, context, dK };
}
