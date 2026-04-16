/**
 * Runtime environment helpers. Used by API routes + server code that needs
 * to pick a behavior based on where we're running:
 *
 *   - dev         → local `next dev`. Fail-soft: log loudly, keep feature usable.
 *   - preview     → Vercel preview deployment for a branch. Same fail-soft as dev
 *                   so reviewers can click around even with a partially-configured
 *                   branch env.
 *   - production  → Vercel prod. Fail-hard when critical keys are missing; a
 *                   silent degradation in prod hides real bugs from us.
 *
 * Vercel exposes `VERCEL_ENV` with one of "development" | "preview" | "production".
 * On bare Node/local builds `VERCEL_ENV` is unset — we fall back to `NODE_ENV`.
 */

export type Runtime = "dev" | "preview" | "production";

export function getRuntime(): Runtime {
  const vercel = process.env.VERCEL_ENV;
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  return "dev";
}

export function isProductionRuntime(): boolean {
  return getRuntime() === "production";
}

/** Should the caller throw on a missing critical key, or fall back quietly? */
export function shouldHardFailOnMissingKey(): boolean {
  return getRuntime() === "production";
}

/**
 * Warn (once per process) that a key is missing. The Set keeps the log from
 * spamming hot paths. Noop in production — shouldHardFailOnMissingKey() will
 * throw before we reach this anyway.
 */
const warned = new Set<string>();
export function warnMissingKey(keyName: string): void {
  if (getRuntime() === "production") return;
  if (warned.has(keyName)) return;
  warned.add(keyName);
  console.warn(
    `[env] ${keyName} is not set. Degraded fallback active — set it in .env.local or Vercel to enable the full feature.`,
  );
}
