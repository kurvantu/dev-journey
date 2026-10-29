import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { lessons, progress, tracks } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { CONCEPTS, type ConceptKey } from "@/data/curriculum";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  await ensureSeeded();
  const [t] = await db.select().from(tracks).where(eq(tracks.id, track));
  if (!t) notFound();

  const rows = await db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      concept: lessons.concept,
      sortOrder: lessons.sortOrder,
      explanation: lessons.explanation,
      completed: progress.completed,
    })
    .from(lessons)
    .leftJoin(progress, eq(progress.lessonId, lessons.id))
    .where(eq(lessons.trackId, track))
    .orderBy(asc(lessons.sortOrder));

  const done = rows.filter((r) => r.completed).length;
  const next = rows.find((r) => !r.completed) ?? rows[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/learn" className="text-xs text-slate-500 hover:text-slate-300">
        ← All tracks
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-4xl font-bold" style={{ color: t.color }}>
            {t.name}
          </h1>
          <p className="mt-1 text-lg text-slate-300">{t.tagline}</p>
        </div>
        {next && (
          <Link href={`/learn/${t.id}/${next.slug}`} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">
            {done === 0 ? "Start" : done === rows.length ? "Review" : "Continue"}: {next.title} →
          </Link>
        )}
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mental model</h2>
          <p className="mt-2 leading-relaxed text-slate-200">{t.mentalModel}</p>
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{t.paradigm}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ecosystem you&apos;ll meet next</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.frameworks.map((f) => (
              <span key={f} className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-200">
                {f}
              </span>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span className="font-mono">
                {done}/{rows.length}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%`, background: t.color }} />
            </div>
          </div>
        </div>
      </section>

      <ol className="mt-8 space-y-2">
        {rows.map((l, i) => {
          const c = CONCEPTS[l.concept as ConceptKey];
          return (
            <li key={l.id}>
              <Link
                href={`/learn/${t.id}/${l.slug}`}
                className="group flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-600 hover:bg-slate-900"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold ${
                    l.completed ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {l.completed ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-white group-hover:text-emerald-300">{l.title}</h3>
                    <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
                      {c?.icon} {c?.title}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{l.explanation.replace(/[`*]/g, "")}</p>
                </div>
                <span className="self-center text-slate-600 group-hover:text-slate-300">→</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
