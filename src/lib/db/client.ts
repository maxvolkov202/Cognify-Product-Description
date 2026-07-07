import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Phase 13 (F-2): survive Next.js dev HMR. Every recompile replaces this
// module; a module-scoped pool leaks its sockets on each swap (they stay
// open until GC), and a day of editing walks the Supabase pooler into
// its 200-client EMAXCONN ceiling — at which point auth silently
// degrades to guest. globalThis persists across HMR module instances.
const globalCache = globalThis as unknown as {
  __cognifyDb?: DrizzleDb;
};

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db] DATABASE_URL is not set. Add it to .env.local before using the database.",
    );
  }
  // `prepare: false` is required for Supabase's Transaction pooler (pgBouncer
  // in transaction mode doesn't support prepared statements).
  // `max` stays modest: the pooler multiplexes to real backends anyway,
  // and every dev-server worker + script process gets its own pool.
  const sql = postgres(url, { prepare: false, max: 6 });
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!globalCache.__cognifyDb) globalCache.__cognifyDb = createDb();
    const value = Reflect.get(globalCache.__cognifyDb as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(globalCache.__cognifyDb)
      : value;
  },
}) as DrizzleDb;

export type Db = DrizzleDb;
