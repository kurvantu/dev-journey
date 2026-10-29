import Link from "next/link";
import dynamic from "next/dynamic";

const LLMLab = dynamic(() => import("@/components/llm/LLMLab"), {
  loading: () => <div className="grid h-96 place-items-center text-slate-500">Initialising the network…</div>,
});

export const metadata = {
  title: "LLM Lab – build a language model from scratch | PolyglotLab",
  description: "Train a tiny neural language model live in the browser and watch every matrix, gradient and attention weight change.",
};

export default function LLMLabPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-400">Python · LLM Lab</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            Build a language model <span className="bg-gradient-to-r from-yellow-300 to-emerald-400 bg-clip-text text-transparent">from scratch</span>
          </h1>
          <p className="mt-3 text-slate-400">
            No PyTorch, no NumPy, no magic. A real neural network — embedding table, tanh hidden layer, softmax output — trains live in your browser while every matrix, gradient and attention
            weight is drawn on screen. The identical architecture is written out in pure Python in the{" "}
            <Link href="/learn/python" className="text-yellow-300 underline-offset-2 hover:underline">
              Python track
            </Link>
            , so you can run it line by line and get the same numbers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/learn/python/llm-train" className="rounded-xl bg-yellow-500 px-4 py-2 font-semibold text-yellow-950 hover:bg-yellow-400">
            🐍 The Python source →
          </Link>
          <Link href="/rosetta?concept=llm" className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500">
            Rosetta view
          </Link>
        </div>
      </div>

      <LLMLab />

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        <Card
          title="Why build it by hand?"
          body="Calling model.fit() teaches you an API. Writing the matmul, the cross-entropy and the gradient yourself teaches you what the API is doing — and makes every paper, bug and shape error afterwards legible."
        />
        <Card
          title="What is missing vs. GPT"
          body="Attention layers stacked deep, layer-norm, residual connections, positional encodings, multi-head attention, Adam instead of plain SGD, and ~10¹² parameters. Every one of those is an optimisation on top of what you see here — not a different idea."
        />
        <Card
          title="Where to go next"
          body="Port this file to NumPy (10× shorter), then to PyTorch (autograd computes the gradients you just wrote by hand), then read Karpathy's nanoGPT. You will recognise every line."
        />
      </section>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </article>
  );
}
