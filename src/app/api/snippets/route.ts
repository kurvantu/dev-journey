import { db, dbReady } from "@/db";
import { snippets } from "@/db/schema";
import { isTrackId } from "@/lib/runner";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbReady();
  const rows = await db.select().from(snippets).orderBy(desc(snippets.createdAt)).limit(50);
  return Response.json(rows);
}

export async function POST(req: Request) {
  await dbReady();
  let body: { title?: unknown; trackId?: unknown; code?: unknown; stdin?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isTrackId(body.trackId)) return Response.json({ error: "Unknown track" }, { status: 400 });
  if (typeof body.code !== "string" || !body.code.trim()) {
    return Response.json({ error: "Code is required" }, { status: 400 });
  }
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 128) : `Untitled ${body.trackId} snippet`;

  const [row] = await db
    .insert(snippets)
    .values({
      title,
      trackId: body.trackId,
      code: body.code,
      stdin: typeof body.stdin === "string" ? body.stdin : null,
    })
    .returning();
  return Response.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  await dbReady();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "id required" }, { status: 400 });
  await db.delete(snippets).where(eq(snippets.id, id));
  return Response.json({ ok: true });
}
