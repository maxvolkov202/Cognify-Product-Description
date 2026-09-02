/**
 * Prosody v2 QA harness — env/paths/stat helpers with NO database dependency.
 * db.mjs layers the sql client (and the DATABASE_URL requirement) on top; scripts
 * that never touch the DB (audio-model-smoke) import from here instead.
 */
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

export const maskEmail = (e) => (e ? `${e.slice(0, 2)}…@${e.split("@")[1] ?? "?"}` : null);

/** Nearest-rank percentile: s[ceil(p/100·n) − 1]. (floor(p/100·n) picks one element
 *  too high whenever p·n/100 is exact — p90 of n=10 would return the max.) */
export function pctl(xs, p) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.map((x) => (x - m) ** 2).reduce((a, b) => a + b, 0) / (xs.length - 1));
};

/** The established real-rep definition (tracker 08-30 sweep): non-@cognify.test
 *  account AND a non-seed/mock model_version. Use BOTH halves when splitting cohorts. */
export const MOCK_MODEL_VERSIONS = ["seed-demo-v1", "mock-fallback-v1"];
export const isTestEmail = (e) => (e ?? "").endsWith("@cognify.test");
export const isRealRep = (r) => !isTestEmail(r.email) && !MOCK_MODEL_VERSIONS.includes(r.model_version);
