# Cutover checklist — cognify-v2-neon production update

Companion to `plans/keen-wondering-treehouse.md`. Step-by-step runbook; each step has command + expected output + failure response.

Safety rails (still on):
- No `git push` without Max's explicit OK.
- No migration apply against prod DB without Max's explicit OK.
- No `vercel deploy --prod` without Max's explicit OK.

---

## Phase A — Pre-deploy patches (local only)

- [ ] **A1.** Apply Patch 1 (`next.config.ts` line 18: `img-src` adds `https:`). Stage + commit as `fix(security): broaden CSP img-src to https: to cover library/OAuth/OG images`.
- [ ] **A2.** Apply Patch 2 (`src/app/api/cron/audio-retention/route.ts`: `?dryRun=1` branch). Stage + commit as `feat(cron): add dryRun=1 to audio-retention cron`.
- [ ] **A3.** Apply Patch 3 (`src/app/api/cron/calibration-drift/route.ts:316–335`: `scoreOne` swaps to `/api/score-internal`). Stage + commit as `fix(cron): calibration-drift uses /api/score-internal to bypass user gate (P-4)`.
- [ ] **A4.** Apply Patch 4 (`drizzle/migrations/0025_audio_retention.sql:7`: DEFAULT 90 → 180 + comment update). Stage + commit as `chore(db): bump 0025 audio_retention_days default 90 → 180 for soft-launch posture`.
- [ ] **A5.** Full local verification:
  - [ ] `npx tsc --noEmit` — green
  - [ ] `npm run lint` — green
  - [ ] `npm test` — green
  - [ ] `npm run build` — green
  - If red on any: halt, fix, re-run. Never `--no-verify`.

---

## Phase B — Migration apply (against prod Supabase)

Requires Max's explicit "go" before B0.

- [ ] **B0.** `npx vercel env pull .env.prod-temp --environment=production --yes --scope maxvolkov202s-projects`
  - Expected: `.env.prod-temp` written. Host shown is the prod Supabase pooler.
  - Failure: Vercel CLI not authed → `npx vercel login`.
- [ ] **B1.** `node scripts/apply-prod-migration.mjs drizzle/migrations/0025_audio_retention.sql`
  - Expected: instant. Single `ALTER TABLE ADD COLUMN`.
  - Verify: `psql "$DATABASE_URL" -c "\d cognify_v2.users" | grep audio_retention_days` shows `integer | default 180`.
  - Failure: check `.env.prod-temp` host is Supabase pooler, not wrong project.
- [ ] **B2.** `node scripts/apply-prod-migration.mjs drizzle/migrations/0026_fk_and_index_hygiene.sql`
  - Expected: 7 FK ADDs + 3 indexes + 1 drop + 4 type conversions. Sub-second at 72 reps.
  - Verify: `psql "$DATABASE_URL" -c "SELECT data_type FROM information_schema.columns WHERE table_schema='cognify_v2' AND table_name='muscle_group_days' AND column_name='planned_exercise_ids'"` shows `ARRAY` (was `jsonb`).
  - Failure: cast error → re-run `node scripts/_audit-prechecks.mjs` to recheck JSONB integrity. Rollback per §7.2 of plan / `plans/rollback.md` §2.
- [ ] **B3.** `node scripts/apply-prod-migration.mjs drizzle/migrations/0027_email_citext.sql`
  - Expected: `CREATE EXTENSION citext` + two `ALTER COLUMN TYPE citext` + UNIQUE recreate. Sub-second.
  - Verify: `psql "$DATABASE_URL" -c "SELECT data_type FROM information_schema.columns WHERE table_schema='cognify_v2' AND table_name='users' AND column_name='email'"` shows `USER-DEFINED` (citext is a user type).
  - Failure: `CREATE EXTENSION citext` permission denied → abort and contact Supabase support (or use schema `public` if cognify_v2 lacks extension privilege).
- [ ] **B4.** Spot-check verification SQL:
  ```sql
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_schema = 'cognify_v2'
    AND ((table_name = 'users' AND column_name IN ('email', 'audio_retention_days'))
      OR (table_name = 'crew_invites' AND column_name = 'email'));
  ```
  - Expected: 3 rows — `audio_retention_days integer 180`, `email USER-DEFINED` (×2).
- [ ] **B5.** `rm .env.prod-temp` — never commit this file.

---

## Phase C — Push branch (optional, recommended for backup)

Requires Max's explicit "go".

- [ ] **C1.** `git push origin feat/muscle-group-pivot`
  - Expected: pushes 20 audit commits + the 4 new pre-deploy patches.
  - Failure: auth — Max runs `gh auth login` (only Max can do this).

---

## Phase D — Deploy to production

Requires Max's explicit "go" before D1.

- [ ] **D1.** Confirm `FF_MUSCLE_GROUP_WORKOUT=true` in Vercel prod env.
  - `npx vercel env ls production --scope maxvolkov202s-projects | grep FF_MUSCLE_GROUP_WORKOUT` — should show it set.
  - If missing: `npx vercel env add FF_MUSCLE_GROUP_WORKOUT production --scope maxvolkov202s-projects` and enter `true`.
- [ ] **D2.** `npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects`
  - Expected: build runs ~45–60s. Output shows `Production: https://cognify-v2-<hash>-maxvolkov202s-projects.vercel.app` and the `cognify-v2-neon.vercel.app` alias.
  - Failure: build error → `npx vercel logs <deploy-url> --scope maxvolkov202s-projects` and triage. Do NOT promote a half-broken build.
- [ ] **D3.** Header verification:
  ```
  curl -sI https://cognify-v2-neon.vercel.app/ | grep -iE "content-security-policy|strict-transport|permissions-policy|x-frame"
  ```
  Expected: all 4 headers present; CSP is the enforcing form (no `-Report-Only`); CSP `img-src` contains `https:`.
- [ ] **D4.** Walk through `plans/smoke-matrix.md` — all MUST-PASS items.

---

## Phase E — Post-deploy soak + notifications

- [ ] **E1.** After 30-minute soak (no errors, no user reports), send Bob the post-deploy note (template in `plans/keen-wondering-treehouse.md` §9).
- [ ] **E2.** Pre-flight the next-morning audio-retention cron manually:
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" \
       "https://cognify-v2-neon.vercel.app/api/cron/audio-retention?dryRun=1"
  ```
  Expected: HTTP 200, `{ dryRun: true, expired: 0, … }`.
  - Failure: investigate before 03:30 UTC scheduled run.
- [ ] **E3.** Watch the 03:00 UTC calibration-drift cron (next morning). Check `/ops/calibration` page — rows should be a mix of `ok` / `drift` / `fallback`, NOT all-error.
  - Failure: Patch 3 didn't deploy correctly OR `INTERNAL_SCORING_SECRET` mismatched. Manually trigger:
    ```
    curl -H "Authorization: Bearer $CRON_SECRET" \
         https://cognify-v2-neon.vercel.app/api/cron/calibration-drift
    ```
- [ ] **E4.** Update `memory/project_pre-merge-handoff.md` with verdict + post-deploy state.

---

## Sign-off

Cutover is complete when:
- All MUST-PASS smoke matrix items green.
- `audio-retention` cron observed at 03:30 UTC reports `expired: 0` cleanly.
- `calibration-drift` cron observed at 03:00 UTC reports mixed-status rows (no all-error).
- 24h post-deploy, no rollback executed.
