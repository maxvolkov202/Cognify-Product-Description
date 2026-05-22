/**
 * Phase 12 follow-up — mobile tap-target audit.
 *
 * Apple HIG + Material guidelines require ≥44×44px tap targets for any
 * interactive element. Touch-screen users can't reliably hit smaller
 * controls. This audit walks the post-pivot routes and asserts every
 * <button>, <a>, <input>, and role="button" is at least 44×44 in the
 * iPhone-14 viewport.
 *
 * Run:
 *   npm run dev               # in a separate terminal
 *   npx playwright install chromium
 *   npm run test:e2e
 *
 * Routes audited:
 *   - /workout (suggestion view + active-day shell)
 *   - /progress/muscle-groups
 *
 * Authenticated state: this audit hits the routes unauthenticated. The
 * (app) layout returns auth-gated UI but the BetaSoon fallback / public
 * shell elements should already exhibit the tap-target shape. If
 * authenticated-only chrome (rep controls) is the failure point, add a
 * storage-state fixture to log in first.
 */

import { test, expect, type Locator } from "@playwright/test";

const MIN_TAP_TARGET = 44;
const ROUTES = ["/workout", "/progress/muscle-groups"];

async function collectViolations(locator: Locator): Promise<
  { html: string; width: number; height: number }[]
> {
  const handles = await locator.elementHandles();
  const violations: { html: string; width: number; height: number }[] = [];
  for (const h of handles) {
    const visible = await h.isVisible();
    if (!visible) continue;
    const box = await h.boundingBox();
    if (!box) continue;
    if (box.width < MIN_TAP_TARGET || box.height < MIN_TAP_TARGET) {
      const html = await h.evaluate(
        (el) => (el as HTMLElement).outerHTML.slice(0, 240),
      );
      violations.push({
        html,
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
    }
  }
  return violations;
}

for (const route of ROUTES) {
  test(`tap targets ≥${MIN_TAP_TARGET}px on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });

    // Wait a beat for any reduced-motion mascot transitions to settle.
    await page.waitForTimeout(200);

    const interactive = page.locator(
      'button:not([aria-hidden="true"]), a:not([aria-hidden="true"]), [role="button"]:not([aria-hidden="true"]), input:not([type="hidden"])',
    );

    const violations = await collectViolations(interactive);

    if (violations.length > 0) {
      console.log(`\nTap-target violations on ${route}:`);
      for (const v of violations) {
        console.log(`  ${v.width}×${v.height}px — ${v.html.replace(/\s+/g, " ")}`);
      }
    }
    expect(
      violations,
      `Found ${violations.length} interactive elements smaller than ${MIN_TAP_TARGET}×${MIN_TAP_TARGET} on ${route}`,
    ).toEqual([]);
  });
}
