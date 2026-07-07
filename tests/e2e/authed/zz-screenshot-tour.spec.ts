/**
 * Phase 16 (pre-prod) — visual tour: screenshots of every core surface
 * as the POPULATED demo user, mobile (390×844, the primary form factor)
 * + desktop (1280×800) for key pages. PNGs land in the scratchpad for
 * human/model review. Not an assertion suite — one soft check per page
 * (no error boundary) so a broken page still screenshots.
 *
 * Run: AUTHED=1 TOUR=1 npx playwright test tests/e2e/authed/zz-screenshot-tour.spec.ts
 */

import { test, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { DEMO_STORAGE_STATE } from "./helpers";

const OUT =
  process.env.TOUR_OUT ??
  "C:/Users/MaxVolkov/AppData/Local/Temp/claude/C--Users-MaxVolkov-dev-cognify/02b578b6-3d0c-439f-898d-9152c897f32c/scratchpad/tour";

const PAGES: { route: string; name: string; desktopToo?: boolean }[] = [
  { route: "/dashboard", name: "dashboard", desktopToo: true },
  { route: "/workout", name: "workout", desktopToo: true },
  { route: "/skill-lab", name: "skill-lab" },
  { route: "/skill-lab/storytelling", name: "skill-lab-storytelling" },
  { route: "/build-a-rep", name: "build-a-rep" },
  { route: "/progress", name: "progress", desktopToo: true },
  { route: "/achievements", name: "achievements" },
  { route: "/leaderboard", name: "leaderboard" },
  { route: "/library", name: "library" },
  { route: "/settings", name: "settings" },
];

test.skip(process.env.TOUR !== "1", "opt-in with TOUR=1");
test.skip(
  !existsSync(DEMO_STORAGE_STATE),
  "demo account not seeded — run scripts/seed-demo-user.ts",
);
test.use({ storageState: DEMO_STORAGE_STATE });
test.describe.configure({ timeout: 180_000 });

test("screenshot tour", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });

  const shoot = async (width: number, height: number, suffix: string) => {
    const ctx = await browser.newContext({
      storageState: DEMO_STORAGE_STATE,
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    for (const p of PAGES) {
      if (suffix === "desktop" && !p.desktopToo) continue;
      await page.goto(p.route, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
      await page.waitForTimeout(600); // settle animations/charts
      await expect(
        page.getByText(/Application error|Something went wrong/i),
      ).toHaveCount(0);
      await page.screenshot({
        path: `${OUT}/${p.name}-${suffix}.png`,
        fullPage: true,
      });
    }
    // Signed-out surfaces (marketing/signin) from a fresh context.
    await ctx.close();
  };

  await shoot(390, 844, "mobile");
  await shoot(1280, 800, "desktop");

  // Marketing home + signin, signed out, mobile.
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await anon.newPage();
  for (const p of [
    { route: "/", name: "marketing-home" },
    { route: "/signin", name: "signin" },
    { route: "/onboarding/vertical", name: "onboarding-vertical" },
  ]) {
    await page.goto(p.route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${p.name}-mobile.png`, fullPage: true });
  }
  await anon.close();
});
