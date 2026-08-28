/**
 * Grading audit WS1 — dependency-free provider error predicates.
 *
 * Lives outside claude.ts on purpose: scoring/telemetry.ts (and through it
 * the saveRep server action) needs this check, and importing claude.ts
 * would pull both provider SDKs and their module-level client
 * constructors into every chunk that saves a rep.
 */

/** Provider credit / quota exhaustion is an ops incident, not a
 *  transient error. One rule shared by the call wrapper (error-level log
 *  for alerting) and the telemetry classifier (`provider_credits`). */
export function isProviderCreditsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /no credits remaining/i.test(msg) ||
    /credit balance/i.test(msg) ||
    /credit_balance_too_low/i.test(msg) ||
    /insufficient_quota/i.test(msg) ||
    /exceeded your current quota/i.test(msg)
  );
}
