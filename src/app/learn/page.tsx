import Link from "next/link";
import { db } from "@/db";
import { lessons, progress, tracks } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { CONCEPTS, type ConceptKey } from "@/data/curriculum";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function LearnIndex() {
  await ensureSeeded();
  const trackRows = await db.select().from(tracks).orderBy(asc(tracks.sortOrder));
  const lessonRows = await db
    .select({
      id: lessons.id,
      trackId: lessons.trackId,
      slug: lessons.slug,
      title: lessons.title,
      concept: lessons.concept,
      sortOrder: lessons.sortOrder,
      completed: progress.completed,
    })
    .from(lessons)
    .leftJoin(progress, eq(progress.lessonId, lessons.id))
    .orderBy(asc(lessons.sortOrder));

  const conceptKeys = Object.keys(CONCEPTS) as ConceptKey[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Learn</p>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Concept × Language matrix</h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Read it <strong className="text-slate-200">down</strong> a column to learn one language deeply. Read it <strong className="text-slate-200">across</strong> a row to see how five languages solve the same problem. Both directions are valid – the second one is faster.
      </p>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/50">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Concept</th>
              {trackRows.map((t) => (
                <th key={t.id} className="px-3 py-3 text-left">
                  <Link href={`/learn/${t.id}`} className="font-mono text-base font-bold hover:underline" style={{ color: t.color }}>
                    {t.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conceptKeys.map((ck) => {
              const c = CONCEPTS[ck];
              return (
                <tr key={ck} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <Link href={`/rosetta?concept=${ck}`} className="flex items-center gap-2 text-slate-200 hover:text-white">
                      <span>{c.icon}</span>
                      <span>
                        <span className="block font-medium">{c.title}</span>
                        <span className="block text-xs text-slate-500">{c.blurb}</span>
                      </span>
                    </Link>
                  </td>
                  {trackRows.map((t) => {
                    const cell = lessonRows.filter((x) => x.trackId === t.id && x.concept === ck);
                    if (cell.length === 0)
                      return (
                        <td key={t.id} className="px-3 py-3 text-xs text-slate-700">
                          —
                        </td>
                      );
                    return (
                      <td key={t.id} className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {cell.map((l) => (
                            <Link
                              key={l.id}
                              href={`/learn/${t.id}/${l.slug}`}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                l.completed
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
                              }`}
                            >
                              {l.completed ? "✓" : "○"} {l.title}
                            </Link>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
