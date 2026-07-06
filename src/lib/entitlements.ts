// PRD v3 Phase 5 — entitlement choke point (Owen C7).
//
// Build a Rep is the compute/memory-heavy mode (context parsing, plan
// generation, long simulations, readiness reviews) and is the likely
// premium tier. There is NO billing system yet — this module exists so
// every Build a Rep entry point already asks the question, and turning
// on a real plan check later is a one-file change.

export type Entitlement =
  | { allowed: true }
  | { allowed: false; reason: "premium_required" };

/** Per-user Build a Rep entitlement. Everyone is entitled today; flip
 *  via FF_BUILD_A_REP_PREMIUM=true once billing lands (env-driven kill
 *  switch in the meantime). The userId parameter is the future plan-
 *  lookup key — unused until billing exists. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getBuildARepEntitlement(_userId: string): Entitlement {
  if (process.env.FF_BUILD_A_REP_PREMIUM === "true") {
    // Billing not built — when the premium gate is forced on, nobody
    // passes. Replace with a plan lookup when subscriptions exist.
    return { allowed: false, reason: "premium_required" };
  }
  return { allowed: true };
}
