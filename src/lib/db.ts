import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/*
 * Lazy singleton Drizzle client over Neon's HTTP driver.
 *
 * Lazy so `next build` doesn't crash when DATABASE_URL is absent at module-eval
 * time. A plain module-level `let` (NOT a Proxy wrapper) — Proxies break adapters
 * that introspect the client object.
 */
function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
