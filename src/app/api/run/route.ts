import { db, dbReady } from "@/db";
import { runs } from "@/db/schema";
import { isTrackId, runCode } from "@/lib/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  await dbReady();
  let body: { trackId?: unknown; code?: unknown; stdin?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { trackId, code, stdin } = body;
  if (!isTrackId(trackId)) {
    return Response.json({ error: "Unknown language track" }, { status: 400 });
  }
  if (typeof code !== "string" || code.trim().length === 0) {
    return Response.json({ error: "Code is required" }, { status: 400 });
  }

  const result = await runCode(trackId, code, typeof stdin === "string" ? stdin : "");

  // Fire-and-forget activity log; never fail the run because of it.
  db.insert(runs)
    .values({
      trackId,
      success: result.ok,
      durationMs: result.durationMs,
      engine: result.engine,
    })
    .catch(() => {});

  return Response.json(result);
}
