/**
 * Prosody v2 QA harness — DB access on top of env.mjs (plan §P8: .env.local IS prod;
 * everything here is read-only SELECTs + signed-URL reads; the ONLY writer is
 * seed-example-reps.mjs and it writes exclusively through the real app UI under a
 * @cognify.test account).
 */
import postgres from "postgres";
import { env } from "./env.mjs";
export * from "./env.mjs";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing");
export const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 2, prepare: false, idle_timeout: 5 });
