import Link from "next/link";
import MindMap from "@/components/MindMap";

export const metadata = {
  title: "Mindmap – PolyglotLab",
};

export default function MindmapPage() {
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Strategic mindmap</p>
          <h1 className="mt-2 text-3xl font-bold text-white">How everything connects</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Four pillars radiate from one goal. <strong className="text-slate-200">Mindset</strong> is how you learn, <strong className="text-slate-200">Universal Concepts</strong> are what you learn,{" "}
            <strong className="text-slate-200">Languages &amp; Frameworks</strong> are where you apply it, and the <strong className="text-slate-200">Framework Loop</strong> is the repeatable recipe.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/learn" className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500">
            Lesson matrix
          </Link>
          <Link href="/rosetta" className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500">
            Rosetta view
          </Link>
        </div>
      </div>
      <MindMap />

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <Strategy
          n="01"
          title="Depth first, then breadth"
          body="Pick ONE language (Node or Go are the gentlest) and finish its track. You now own the ten universal concepts. Every other track is a translation exercise."
        />
        <Strategy
          n="02"
          title="Contrast on purpose"
          body="Your second language should be maximally different: after Node pick Rust or C; after Go pick PHP. Contrast makes the invariants visible – the things that never change are the things worth knowing."
        />
        <Strategy
          n="03"
          title="Frameworks are the last 10%"
          body="Once concepts + toolchain are in place, a framework is a weekend. Run the 9-step loop, build the same todo API, and keep notes on where the framework hides each concept."
        />
      </section>
    </main>
  );
}

function Strategy({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="font-mono text-xs text-emerald-400">{n}</div>
      <h3 className="mt-1 font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
    </article>
  );
}
