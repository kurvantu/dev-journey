import Link from "next/link";
import { db } from "@/db";
import { lessons, progress, runs, tracks } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { FRAMEWORK_LOOP, MINDSET_PRINCIPLES } from "@/data/curriculum";
import { asc, count, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureSeeded();

  const trackRows = await db.select().from(tracks).orderBy(asc(tracks.sortOrder));
  const lessonCounts = await db
    .select({ trackId: lessons.trackId, total: count() })
    .from(lessons)
    .groupBy(lessons.trackId);
  const doneCounts = await db
    .select({ trackId: lessons.trackId, done: count() })
    .from(progress)
    .innerJoin(lessons, eq(progress.lessonId, lessons.id))
    .where(eq(progress.completed, true))
    .groupBy(lessons.trackId);
  const [runStats] = await db
    .select({ total: count(), ok: sql<number>`coalesce(sum(case when ${runs.success} then 1 else 0 end), 0)` })
    .from(runs);

  const totalLessons = lessonCounts.reduce((a, b) => a + b.total, 0);
  const totalDone = doneCounts.reduce((a, b) => a + b.done, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* ───────── Hero ───────── */}
      <section className="grid items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="float-in">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live code execution · 5 languages · 1 mental model
          </p>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
            Learn programming <span className="bg-gradient-to-r from-emerald-300 to-sky-400 bg-clip-text text-transparent">once</span>.
            <br />
            Speak every language.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-400">
            PolyglotLab teaches <strong className="text-slate-200">universal concepts</strong> – memory, errors, concurrency, HTTP – and shows you
            how C, Rust, Go, PHP and Node.js each express them. Write code, run it, see the screen, compare sideways.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/learn" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400">
              Start learning →
            </Link>
            <Link href="/mindmap" className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-slate-100 transition hover:border-slate-500">
              Explore the mindmap
            </Link>
            <Link
              href="/llm-lab"
              className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 font-semibold text-yellow-200 transition hover:bg-yellow-500/20"
            >
              🧬 LLM Lab
            </Link>
            <Link
              href="/assembly"
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              ⚙ Assembly
            </Link>
          </div>
        </div>

        {/* stats card */}
        <div className="float-in rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-black/40" style={{ animationDelay: "120ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Your journey</h2>
            <span className="font-mono text-xs text-slate-500">
              {totalDone}/{totalLessons} lessons
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all" style={{ width: `${totalLessons ? (totalDone / totalLessons) * 100 : 0}%` }} />
          </div>
          <ul className="mt-5 space-y-2.5">
            {trackRows.map((t) => {
              const total = lessonCounts.find((c) => c.trackId === t.id)?.total ?? 0;
              const done = doneCounts.find((c) => c.trackId === t.id)?.done ?? 0;
              return (
                <li key={t.id}>
                  <Link href={`/learn/${t.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-slate-800/70">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="w-16 text-sm font-medium text-slate-200">{t.name}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <span className="block h-full rounded-full" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: t.color }} />
                    </span>
                    <span className="w-10 text-right font-mono text-xs text-slate-500">
                      {done}/{total}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{runStats?.total ?? 0}</div>
              <div className="text-xs text-slate-500">programs executed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{Number(runStats?.ok ?? 0)}</div>
              <div className="text-xs text-slate-500">successful runs</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Tracks ───────── */}
      <section className="py-12">
        <SectionTitle kicker="Five languages, five paradigms" title="Deliberately different, so the concepts stand out" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {trackRows.map((t) => (
            <Link
              key={t.id}
              href={`/learn/${t.id}`}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-slate-600"
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: t.color }} />
              <div className="font-mono text-2xl font-bold" style={{ color: t.color }}>
                {t.name}
              </div>
              <p className="mt-1 text-sm text-slate-400">{t.tagline}</p>
              <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{t.paradigm}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.frameworks.slice(0, 4).map((f) => (
                  <span key={f} className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300">
                    {f}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── Mindset ───────── */}
      <section className="py-12">
        <SectionTitle kicker="The mindset" title="Eight principles for learning any language or framework" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {MINDSET_PRINCIPLES.map((p, i) => (
            <article key={p.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <span className="font-mono text-xs text-slate-600">0{i + 1}</span>
              </div>
              <h3 className="font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── Framework loop ───────── */}
      <section className="py-12">
        <SectionTitle kicker="The framework learning loop" title="One recipe for Express, Gin, Laravel, Axum – any of them" />
        <ol className="relative grid gap-3 md:grid-cols-3">
          {FRAMEWORK_LOOP.map((s, i) => (
            <li key={s.step} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-sky-500/20 font-mono text-sm font-bold text-emerald-300">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold text-white">{s.step}</h3>
                <p className="mt-1 text-sm text-slate-400">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-slate-500">
          Finish the <Link href="/rosetta?concept=web" className="text-emerald-400 underline-offset-2 hover:underline">Web / HTTP</Link> lesson in each track first – it is step 0 of this loop, done with no framework at all.
        </p>
      </section>
    </main>
  );
}

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">{kicker}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
    </div>
  );
}
