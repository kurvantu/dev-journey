import Link from "next/link";
import { db } from "@/db";
import { lessons, tracks } from "@/db/schema";
import { ensureSeeded } from "@/lib/seed";
import { CONCEPTS, type ConceptKey } from "@/data/curriculum";
import RosettaBoard from "@/components/RosettaBoard";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function RosettaPage({ searchParams }: { searchParams: Promise<{ concept?: string }> }) {
  const { concept: raw } = await searchParams;
  await ensureSeeded();
  const keys = Object.keys(CONCEPTS) as ConceptKey[];
  const concept: ConceptKey = keys.includes(raw as ConceptKey) ? (raw as ConceptKey) : "errors";
  const info = CONCEPTS[concept];

  const rows = await db
    .select({
      trackId: lessons.trackId,
      trackName: tracks.name,
      color: tracks.color,
      slug: lessons.slug,
      title: lessons.title,
      code: lessons.starterCode,
      transfer: lessons.transfer,
    })
    .from(lessons)
    .innerJoin(tracks, eq(tracks.id, lessons.trackId))
    .where(eq(lessons.concept, concept))
    .orderBy(asc(tracks.sortOrder));

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Rosetta Stone</p>
      <h1 className="mt-2 text-3xl font-bold text-white">One concept, five languages</h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        The fastest way to learn language #2 (and #5) is to hold a concept fixed and vary only the language. Pick a concept below, run every panel, and read the differences.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {keys.map((k) => (
          <Link
            key={k}
            href={`/rosetta?concept=${k}`}
            className={`rounded-xl border px-3 py-1.5 text-sm transition ${
              k === concept ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600"
            }`}
          >
            {CONCEPTS[k].icon} {CONCEPTS[k].title}
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-lg font-semibold text-white">
          {info.icon} {info.title}
        </h2>
        <p className="mt-1 text-slate-400">{info.blurb}</p>
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="text-slate-500">No lessons for this concept yet.</p>
        ) : (
          <RosettaBoard key={concept} cells={rows} />
        )}
      </div>
    </main>
  );
}
