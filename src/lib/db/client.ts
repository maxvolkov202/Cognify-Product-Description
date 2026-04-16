import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleDb | null = null;

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db] DATABASE_URL is not set. Add it to .env.local before using the database.",
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!cached) cached = createDb();
    const value = Reflect.get(cached as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(cached) : value;
  },
}) as DrizzleDb;

export type Db = DrizzleDb;
