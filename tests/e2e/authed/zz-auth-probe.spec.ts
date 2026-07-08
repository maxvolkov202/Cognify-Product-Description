/**
 * Phase 12 — session sanity probe. Fails loudly when the storageState
 * session isn't recognized server-side (e.g. Supabase pooler EMAXCONN
 * degrading auth to guest — findings F-2). Runs last alphabetically so
 * a mid-suite degradation still gets caught.
 */

import { test, expect } from "@playwright/test";

test("storageState session is recognized server-side", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Sign in" }),
    "dashboard rendered as GUEST — check DB connections / Supabase auth",
  ).toHaveCount(0);
});
