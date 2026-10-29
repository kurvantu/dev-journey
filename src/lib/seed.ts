import { db, dbReady } from "@/db";
import { lessons, tracks } from "@/db/schema";
import { LESSONS, TRACKS } from "@/data/curriculum";
import { and, eq } from "drizzle-orm";

let seededPromise: Promise<void> | null = null;

/**
 * Idempotently sync the static curriculum into PostgreSQL.
 * Runs at most once per server process; safe to call from any server component.
 */
export function ensureSeeded(): Promise<void> {
  if (!seededPromise) {
    seededPromise = seed().catch((err) => {
      seededPromise = null;
      throw err;
    });
  }
  return seededPromise;
}

async function seed() {
  await dbReady();
  for (const t of TRACKS) {
    await db
      .insert(tracks)
      .values(t)
      .onConflictDoUpdate({
        target: tracks.id,
        set: {
          name: t.name,
          tagline: t.tagline,
          color: t.color,
          paradigm: t.paradigm,
          mentalModel: t.mentalModel,
          frameworks: t.frameworks,
          sortOrder: t.sortOrder,
        },
      });
  }

  const existing = await db
    .select({ id: lessons.id, trackId: lessons.trackId, slug: lessons.slug })
    .from(lessons);
  const byKey = new Map(existing.map((l) => [`${l.trackId}/${l.slug}`, l.id]));

  for (const [trackId, list] of Object.entries(LESSONS)) {
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const values = {
        trackId,
        slug: l.slug,
        title: l.title,
        concept: l.concept,
        sortOrder: i + 1,
        explanation: l.explanation,
        starterCode: l.starterCode,
        expectedOutput: l.expectedOutput,
        hint: l.hint,
        transfer: l.transfer,
      };
      const id = byKey.get(`${trackId}/${l.slug}`);
      if (id) {
        await db
          .update(lessons)
          .set(values)
          .where(and(eq(lessons.trackId, trackId), eq(lessons.slug, l.slug)));
      } else {
        await db.insert(lessons).values(values);
      }
    }
  }
}
