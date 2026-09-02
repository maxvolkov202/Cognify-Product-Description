/**
 * Prosody v2 QA harness — shared env/DB access (plan §P8: .env.local IS prod;
 * everything in this directory is read-only SELECTs + signed-URL reads; the ONLY
 * writer is seed-example-reps.mjs and it writes exclusively through the real app
 * under a @cognify.test account).
 */
import postgres from "postgres";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const HARNESS_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HARNESS_DIR, "../../..");
export const OUT_DIR = process.env.OUT ?? resolve(HARNESS_DIR, "out");
mkdirSync(OUT_DIR, { recursive: true });

export function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** .env.local first, then ONLY the prosody vars from an optional pulled env file
 *  (PROSODY_ENV_FILE, e.g. a `vercel env pull` output — taking everything from it
 *  would override .env.local's working Supabase/DB credentials), then process env. */
const prosodyOverlay = () => {
  if (!process.env.PROSODY_ENV_FILE) return {};
  const pulled = loadEnvFile(process.env.PROSODY_ENV_FILE);
  return Object.fromEntries(Object.entries(pulled).filter(([k]) => k.startsWith("PROSODY_") || k.startsWith("FF_")));
};
export const env = {
  ...loadEnvFile(resolve(ROOT, ".env.local")),
  ...prosodyOverlay(),
  ...process.env,
};
env.SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing");

export const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 2, prepare: false, idle_timeout: 5 });

export const maskEmail = (e) => (e ? `${e.slice(0, 2)}…@${e.split("@")[1] ?? "?"}` : null);

/** The established real-rep filter (tracker 08-30 sweep): non-seed/mock model
 *  versions, non-@cognify.test account. */
export const REAL_REP_WHERE = sql`
  r.model_version not in ('seed-demo-v1', 'mock-fallback-v1')
  and coalesce(u.email, '') not like '%@cognify.test'`;

export function pctl(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.map((x) => (x - m) ** 2).reduce((a, b) => a + b, 0) / (xs.length - 1));
};
