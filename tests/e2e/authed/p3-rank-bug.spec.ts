/**
 * Overhaul Phase 3 smoke — Rank XP visualization + bug-report XP.
 *
 * Reuses the persisted authed session (tests/e2e/authed/.auth/user.json)
 * and drives against the local dev server. All DB writes are strictly
 * scoped to the e2e-harness test account (its XP is saved + restored), and
 * any bug rows this spec inserts are deleted at the end — the Supabase DB
 * is shared with prod, so the spec never touches a real user's data.
 *
 * Run (dev server on :3333 in another terminal):
 *   npx playwright test --config playwright.p3.config.ts
 */

import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env.local") });

const EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-harness@cognify.test";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2 });

async function getUser(): Promise<{ id: string; xp: number } | null> {
  const [u] = await sql<{ id: string; xp: number }[]>`
    select id, xp from cognify_v2.users where email = ${EMAIL} limit 1`;
  return u ?? null;
}
async function setXp(id: string, xp: number): Promise<void> {
  await sql`update cognify_v2.users set xp = ${xp} where id = ${id}`;
}

test.afterAll(async () => {
  // Clean up any bug rows this spec created, then close the pool.
  await sql`delete from cognify_v2.bug_reports where description like 'P3 smoke:%'`;
  await sql.end();
});

test("rank card shows visible XP-in-rank + XP-to-next, updating across a division boundary", async ({
  page,
}) => {
  const u = await getUser();
  expect(u, "e2e-harness user must exist").toBeTruthy();
  const original = Number(u!.xp);
  try {
    // Silver II band: floor 4,500, next Silver III at 5,800.
    // 5,000 → 500 XP in rank, 800 to Silver III.
    await setXp(u!.id, 5000);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByText("500 XP this rank")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/800 to Silver III/)).toBeVisible();

    // Cross the boundary into Silver III (floor 5,800): 5,900 → 100 in
    // rank, 1,200 to Silver IV. Labels + bar must re-render.
    await setXp(u!.id, 5900);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("100 XP this rank")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/1,200 to Silver IV/)).toBeVisible();
  } finally {
    await setXp(u!.id, original);
  }
});

test("bug report grants +10 XP when signed in, and 0 when anonymous", async ({
  page,
  browser,
}) => {
  const u = await getUser();
  expect(u).toBeTruthy();
  const before = Number((await getUser())!.xp);

  // Signed-in: page.request shares the authed context cookies.
  const res = await page.request.post("/api/bug-reports", {
    multipart: { description: "P3 smoke: signed-in bug report XP check." },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.xpAwarded).toBe(10);

  const after = Number((await getUser())!.xp);
  expect(after - before).toBe(10);
  // Restore the +10 so repeated runs stay idempotent.
  await setXp(u!.id, before);

  // Anonymous: force an empty storage state so no auth cookies leak from
  // the config's `use.storageState` → no user → no award, no error.
  const anon = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  try {
    const anonRes = await anon.request.post("/api/bug-reports", {
      multipart: { description: "P3 smoke: anonymous bug report, no XP." },
    });
    expect(anonRes.ok()).toBeTruthy();
    const anonBody = await anonRes.json();
    expect(anonBody.xpAwarded).toBe(0);
  } finally {
    await anon.close();
  }

  // The anonymous submit must not have moved the test user's XP.
  expect(Number((await getUser())!.xp)).toBe(before);
});
