import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;

/** A learning track = one programming language. */
export const tracks = sqliteTable("tracks", {
  id: text("id").primaryKey(), // c | rust | go | php | python | node
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  color: text("color").notNull(),
  paradigm: text("paradigm").notNull(),
  mentalModel: text("mental_model").notNull(),
  frameworks: text("frameworks", { mode: "json" }).$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** A single interactive lesson inside a track. */
export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: text("track_id")
    .notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  concept: text("concept").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  explanation: text("explanation").notNull(),
  starterCode: text("starter_code").notNull(),
  expectedOutput: text("expected_output"),
  hint: text("hint"),
  transfer: text("transfer"),
});

/** Learner progress per lesson (single-learner playground, no auth). */
export const progress = sqliteTable("progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  code: text("code"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(now),
});

/** Free-form playground snippets saved by the learner. */
export const snippets = sqliteTable("snippets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  trackId: text("track_id").notNull(),
  code: text("code").notNull(),
  stdin: text("stdin"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

/** Every execution, so the learner can see their activity. */
export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trackId: text("track_id").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  engine: text("engine").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export type Track = typeof tracks.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Progress = typeof progress.$inferSelect;
export type Snippet = typeof snippets.$inferSelect;
export type Run = typeof runs.$inferSelect;

/**
 * Idempotent DDL so a fresh SQLite file is usable without running drizzle-kit.
 * Kept in sync with the table definitions above.
 */
export const BOOTSTRAP_SQL = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  color TEXT NOT NULL,
  paradigm TEXT NOT NULL,
  mental_model TEXT NOT NULL,
  frameworks TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  concept TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  explanation TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  expected_output TEXT,
  hint TEXT,
  transfer TEXT
);
CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE TABLE IF NOT EXISTS snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  title TEXT NOT NULL,
  track_id TEXT NOT NULL,
  code TEXT NOT NULL,
  stdin TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  track_id TEXT NOT NULL,
  success INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  engine TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;
