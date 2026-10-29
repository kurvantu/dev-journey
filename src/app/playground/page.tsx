import { db, dbReady } from "@/db";
import { snippets } from "@/db/schema";
import Playground from "@/components/Playground";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  await dbReady();
  const rows = await db.select().from(snippets).orderBy(desc(snippets.createdAt)).limit(50);
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Playground</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Write. Run. See the screen.</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            A scratchpad for all five languages with stdin support, a live terminal and an HTML screen preview. Experiments here are the fastest way to learn – keep the feedback loop under 10 seconds.
          </p>
        </div>
      </div>
      <Playground initialSnippets={rows} />
    </main>
  );
}
