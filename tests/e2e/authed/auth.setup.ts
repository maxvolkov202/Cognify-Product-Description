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
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LOCAL_PATH = resolve(__dirname, "../../../.env.local");
config({ path: ENV_LOCAL_PATH });

import { DEMO_STORAGE_STATE } from "./helpers";

// ── Demo-guard interlock (prod runbook risk #4) ─────────────────────────
// dotenv never overrides pre-set vars, so a shell-exported prod
// DATABASE_URL (exactly the state the prod-seeding procedure leaves
// behind) silently wins over .env.local — and this setup provisions +
// signs in test users against whatever environment the process sees.
// Abort when the effective DATABASE_URL host differs from .env.local's.
// (The baseURL production check below stays as a second layer.)

function dbHostOf(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return host ? host.toLowerCase() : null;
  } catch {
    const m = url.match(/@\[?([^/@\s:\]?]+)[^@]*$/);
    return m?.[1]?.toLowerCase() ?? null;
  }
}

function envLocalDatabaseUrl(): string | null {
  if (!existsSync(ENV_LOCAL_PATH)) return null;
  for (const line of readFileSync(ENV_LOCAL_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v || null;
  }
  return null;
}

function assertDbHostMatchesEnvLocal(): void {
  const effectiveUrl = process.env.DATABASE_URL;
  const fileUrl = envLocalDatabaseUrl();
  if (!effectiveUrl || !fileUrl) {
    // No .env.local DATABASE_URL (CI env-only setups) or no effective
    // URL at all — nothing to cross-check; the baseURL guard still runs.
    return;
  }
  const fileHost = dbHostOf(fileUrl);
  const envHost = dbHostOf(effectiveUrl);
  if (fileHost && envHost && fileHost !== envHost) {
    throw new Error(
      `Refusing to run auth setup: process.env.DATABASE_URL points at host "${envHost}" but .env.local points at "${fileHost}". ` +
        `A shell-exported DATABASE_URL is overriding .env.local (dotenv never overrides pre-set vars) — ` +
        `likely left over from a prod procedure. Unset it or update .env.local, then re-run.`,
    );
  }
}

export const STORAGE_STATE = resolve(__dirname, ".auth/user.json");

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-harness@cognify.test";
const TEST_PASSWORD =
  process.env.E2E_TEST_PASSWORD ?? "cognify-e2e-9f3k2m8x!A";
const DEMO_EMAIL = "demo@cognify.test";
const DEMO_PASSWORD = "cognify-demo-7h2p9w!D";

setup("authenticate as the e2e test user", async ({ page, baseURL }) => {
  assertDbHostMatchesEnvLocal();
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
  assertDbHostMatchesEnvLocal();
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
