---
name: reference-authed-e2e-and-db
description: "How to run the authed fake-mic workout e2e (local + against prod), reset a test account's day, and the Supabase auth-id -> internal users.id mapping"
metadata: 
  node_type: memory
  type: reference
  originSessionId: fae75f10-7a66-41ee-8779-1c9cbe9f9cf1
---

Running the authed workout loop e2e with real example reps (fake-mic → live Deepgram + scoring):

- `AUTHED=1 npx playwright test tests/e2e/authed/<spec>` — runs against local dev (`http://127.0.0.1:3333`, needs `npm run dev` up).
- Add `PW_BASE_URL=https://cognify-v2-neon.vercel.app` to run the SAME spec against **prod** (auth.setup only refuses `cognifygym.com`, so the neon URL is allowed). This is a real prod end-to-end smoke.
- Config: `playwright.config.ts` launches Chromium with `--use-file-for-fake-audio-capture=tests/fixtures/spoken-rep.wav`. Test user `e2e-harness@cognify.test` is auto-provisioned via Supabase admin.
- Regression spec for the workout-loop fixes: `tests/e2e/authed/zz-workout-fix-smoke.spec.ts` — the anti-remount score-reveal check PAUSES 4s like a human (the old loop e2e missed the bug by clicking inside the exit-animation window).

DB facts (all one Supabase project `dunnoccrvrqzsgxsfjuv`, pooler host `aws-1-us-east-2.pooler.supabase.com`; local `.env.local` and prod Vercel env point at the SAME DB):
- `muscle_group_days.user_id` (and reps/sessions) reference the INTERNAL `cognify_v2.users.id`, NOT `auth.users.id`. Map via `cognify_v2.users.auth_user_id` (= Supabase auth id) or `.email`. e2e-harness: auth id `1692d5a6…`, internal id `331d61b4…`.
- To free a test account's day for a fresh loop run: `node scripts/dev/reset-e2e-day.mjs [email]` (guards to `@cognify.test` only; deletes that user's latest day + its sessions/reps/telemetry). A fresh day regenerates on next `/workout`.
- **Onboarding gate differs by env:** dev/preview bypasses onboarding (flags default ON outside prod) so `/workout` serves the loop; PROD enforces it, so an un-onboarded account lands on the 5-step onboarding and never reaches the picker. If a prod e2e stalls on "What do you do?", the account needs `cognify_v2.users.vertical` + `onboarded_at` set. See [[reference-prod-deploy]].
- Minor: prod `NEXT_PUBLIC_SUPABASE_URL` (via `vercel env pull`) shows a trailing `\n` — the env-newline gotcha ([[project_vercel-env-newline-gotcha]]); prod auth+loop still work end-to-end, so low priority, but worth cleaning.
