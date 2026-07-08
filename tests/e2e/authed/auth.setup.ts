/**
 * Phase 11.B1 — authed-harness setup: ensure the E2E test user exists
 * (Supabase admin API), log in through the REAL signin UI, persist
 * storageState for the authed-chromium project.
 *
 * Dev/preview only — refuses to run against production URLs.
 */

import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env.local") });

import { DEMO_STORAGE_STATE } from "./helpers";

export const STORAGE_STATE = resolve(__dirname, ".auth/user.json");

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-harness@cognify.test";
const TEST_PASSWORD =
  process.env.E2E_TEST_PASSWORD ?? "cognify-e2e-9f3k2m8x!A";
const DEMO_EMAIL = "demo@cognify.test";
const DEMO_PASSWORD = "cognify-demo-7h2p9w!D";

setup("authenticate as the e2e test user", async ({ page, baseURL }) => {
  if (baseURL?.includes("cognifygym.com")) {
    throw new Error("Refusing to run the auth setup against production.");
  }

  // 1) Ensure the user exists + is confirmed (idempotent).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase env missing — cannot provision the test user.");
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "E2E Harness" },
  });
  if (createErr && !/already.*registered|already.*exists/i.test(createErr.message)) {
    throw new Error(`Test-user provisioning failed: ${createErr.message}`);
  }

  // 2) Log in through the real UI (no cookie-format guessing).
  await page.goto("/signin", { waitUntil: "networkidle" });
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in with email/i }).click();

  // Successful sign-in leaves /signin (dashboard or onboarding).
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});

setup("authenticate as the demo user (when seeded)", async ({ browser, baseURL }) => {
  if (baseURL?.includes("cognifygym.com")) {
    throw new Error("Refusing to run the auth setup against production.");
  }
  // No provisioning here — the demo account is created by
  // scripts/seed-demo-user.ts. Skip (don't fail) when it's absent so the
  // authed loops still run on machines that never seeded it.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/signin", { waitUntil: "networkidle" });
  await page.locator("#email").fill(DEMO_EMAIL);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in with email/i }).click();
  try {
    await expect(page).not.toHaveURL(/\/signin/, { timeout: 30_000 });
  } catch {
    setup.skip(true, "demo@cognify.test not seeded — run seed-demo-user.ts");
    return;
  }
  await ctx.storageState({ path: DEMO_STORAGE_STATE });
  await ctx.close();
});
