// Phase 15 P-5 — in-process ops counters for failure modes that can't be
// recorded in the DB (because the DB being down is often the cause).
// Surfaced via /api/health. Per-instance on serverless — that's fine:
// any instance reporting >0 is a real event, and the counters exist to
// make silent degradation visible, not to be an exact ledger.

let authDegradedCount = 0;
let lastAuthDegraded: { at: string; reason: string } | null = null;

/** Called when an AUTHENTICATED session silently degrades to guest
 *  because the user lookup failed (e.g. pooler exhaustion — F-2). */
export function recordAuthDegraded(reason: string): void {
  authDegradedCount += 1;
  lastAuthDegraded = {
    at: new Date().toISOString(),
    reason: reason.slice(0, 200),
  };
  console.error(
    JSON.stringify({
      level: "warn",
      event: "auth.degraded_to_guest",
      count: authDegradedCount,
      reason: reason.slice(0, 200),
      ts: lastAuthDegraded.at,
    }),
  );
}

export function getAuthDegradedStats(): {
  count: number;
  last: { at: string; reason: string } | null;
} {
  return { count: authDegradedCount, last: lastAuthDegraded };
}
