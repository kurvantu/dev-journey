import { db, dbReady } from "@/db";
import { progress } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbReady();
  const rows = await db.select().from(progress);
  return Response.json(rows);
}

/** Upsert progress for a lesson: { lessonId, completed?, code? } */
export async function POST(req: Request) {
  await dbReady();
  let body: { lessonId?: unknown; completed?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const lessonId = Number(body.lessonId);
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return Response.json({ error: "lessonId required" }, { status: 400 });
  }

  const [existing] = await db.select().from(progress).where(eq(progress.lessonId, lessonId));
  const patch: Partial<typeof progress.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.completed === "boolean") patch.completed = body.completed;
  if (typeof body.code === "string") patch.code = body.code;

  if (existing) {
    const [row] = await db.update(progress).set(patch).where(eq(progress.id, existing.id)).returning();
    return Response.json(row);
  }
  const [row] = await db
    .insert(progress)
    .values({ lessonId, completed: patch.completed ?? false, code: patch.code ?? null })
    .returning();
  return Response.json(row, { status: 201 });
}
