import { redirect } from "next/navigation";

/**
 * /scenario is deprecated. It has been renamed and rebuilt as
 * /build-a-rep per the team spec v2-beta.1. Any link still pointing
 * here auto-forwards so users don't hit a dead route.
 *
 * Phase 6 cleanup will remove this file entirely.
 */
export default function ScenarioRedirect() {
  redirect("/build-a-rep");
}
