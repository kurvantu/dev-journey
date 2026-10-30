import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { BOOTSTRAP_SQL } from "./schema";

/**
 * SQLite via libSQL.
 *  - Local file by default:   file:./data/app.db
 *  - Or a remote libSQL/Turso: SQLITE_URL=libsql://… + SQLITE_AUTH_TOKEN
 */
const url = process.env.TURSO_DATABASE_URL || "file:./data/app.db";
const authToken = process.env.TURSO_AUTH_TOKEN  || undefined;

if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length);
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

const globalForDb = globalThis as typeof globalThis & {
  __polyglotLibsql?: Client;
  __polyglotReady?: Promise<void>;
};

export const client = globalForDb.__polyglotLibsql ?? createClient({ url, authToken });
globalForDb.__polyglotLibsql = client;

export const db = drizzle(client);

/** Creates tables on first use. Await before touching the database. */
export function dbReady(): Promise<void> {
  if (!globalForDb.__polyglotReady) {
    globalForDb.__polyglotReady = (async () => {
      if (url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL;");
      await client.executeMultiple(BOOTSTRAP_SQL);
    })().catch((err) => {
      globalForDb.__polyglotReady = undefined;
      throw err;
    });
  }
  return globalForDb.__polyglotReady;
}
