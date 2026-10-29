import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { lessons, progress, tracks } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { CONCEPTS, type ConceptKey } from "@/data/curriculum";
import LessonWorkspace from "@/components/LessonWorkspace";
import type { EditorLang } from "@/components/CodeEditor";
import { and, asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Render `code` spans and **bold** from the lesson prose. */
function Prose({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <p className="leading-relaxed text-slate-300">
      {parts.map((p, i) => {
        if (p.startsWith("`")) {
          return (
            <code key={i} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-300">
              {p.slice(1, -1)}
            </code>
          );
        }
        if (p.startsWith("**")) {
          return (
            <strong key={i} className="text-white">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export default async function LessonPage({ params }: { params: Promise<{ track: string; slug: string }> }) {
  const { track, slug } = await params;
  await ensureSeeded();

  const [t] = await db.select().from(tracks).where(eq(tracks.id, track));
  if (!t) notFound();
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.trackId, track), eq(lessons.slug, slug)));
  if (!lesson) notFound();

  const [prog] = await db.select().from(progress).where(eq(progress.lessonId, lesson.id));
  const siblings = await db
    .select({ id: lessons.id, slug: lessons.slug, title: lessons.title, sortOrder: lessons.sortOrder })
    .from(lessons)
    .where(eq(lessons.trackId, track))
    .orderBy(asc(lessons.sortOrder));
  const idx = siblings.findIndex((s) => s.id === lesson.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const sameConcept = await db
    .select({ trackId: lessons.trackId, slug: lessons.slug, title: lessons.title, color: tracks.color, name: tracks.name })
    .from(lessons)
    .innerJoin(tracks, eq(tracks.id, lessons.trackId))
    .where(eq(lessons.concept, lesson.concept))
    .orderBy(asc(tracks.sortOrder));

  const concept = CONCEPTS[lesson.concept as ConceptKey];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* breadcrumbs */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/learn" className="hover:text-slate-300">
          Learn
        </Link>
        <span>/</span>
        <Link href={`/learn/${t.id}`} className="font-mono hover:text-slate-300" style={{ color: t.color }}>
          {t.name}
        </Link>
        <span>/</span>
        <span className="text-slate-400">
          Lesson {idx + 1} of {siblings.length}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{lesson.title}</h1>
          <Link href={`/rosetta?concept=${lesson.concept}`} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700">
            {concept?.icon} Universal concept: <strong className="text-white">{concept?.title}</strong> · compare across languages →
          </Link>
        </div>
        <div className="flex gap-2 text-sm">
          {prev && (
            <Link href={`/learn/${t.id}/${prev.slug}`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500">
              ← {prev.title}
            </Link>
          )}
          {next && (
            <Link href={`/learn/${t.id}/${next.slug}`} className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500">
              {next.title} →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 lg:col-span-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Concept</h2>
          <Prose text={lesson.explanation} />
          {lesson.expectedOutput === null && (
            <p className="mt-3 text-xs text-amber-300/80">This lesson is verified by a successful run (its output includes timestamps, so there is no exact match).</p>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">Try next</h2>
            <p className="text-sm text-amber-100/90">{lesson.hint}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">Transfer – sideways learning</h2>
            <p className="text-sm text-sky-100/90">{lesson.transfer}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sameConcept
                .filter((s) => s.trackId !== track)
                .map((s) => (
                  <Link
                    key={s.trackId}
                    href={`/learn/${s.trackId}/${s.slug}`}
                    className="rounded-md border px-2 py-0.5 font-mono text-[11px] transition hover:bg-slate-800"
                    style={{ borderColor: `${s.color}55`, color: s.color }}
                  >
                    {s.name} ↗
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <LessonWorkspace
          key={lesson.id}
          lessonId={lesson.id}
          lang={t.id as EditorLang}
          starterCode={lesson.starterCode}
          savedCode={prog?.code ?? null}
          expectedOutput={lesson.expectedOutput}
          initiallyCompleted={prog?.completed ?? false}
        />
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-slate-500">Tip: press Ctrl/⌘ + Enter to run. Your code is saved automatically after every run.</span>
        {next ? (
          <Link href={`/learn/${t.id}/${next.slug}`} className="rounded-xl bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700">
            Next lesson →
          </Link>
        ) : (
          <Link href="/learn" className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-emerald-950 hover:bg-emerald-400">
            Track complete – pick the next language →
          </Link>
        )}
      </div>
    </main>
  );
}
