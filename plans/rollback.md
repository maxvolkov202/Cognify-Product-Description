# Rollback playbook

Companion to `plans/keen-wondering-treehouse.md` and `plans/cutover-checklist.md`. When to roll back, in what order, and exactly how.

---

## Go / no-go criteria (first 30 minutes post-deploy)

Halt and roll back if ANY of:

- Any MUST-PASS smoke matrix item is red.
- Authenticated dashboard 500s or hangs >10s.
- Workout page renders BetaSoon placeholder despite `FF_MUSCLE_GROUP_WORKOUT=true` verified set.
- CSP enforcing breaks a page that worked in dev after Patch 1 deployed (should not happen).
- Production log error rate >10× the pre-deploy baseline.
- Any of the 6 auth-linked users (Bob, Max, or the 4 others) reports broken auth, data loss, or "I can't sign in."

---

## Rollback order matters (read first)

The new code expects the new schema. If migrations 0026 / 0027 are applied and we roll the **code** back without first rolling the **migrations** back, the old code:

- Reads `planned_exercise_ids` as JSONB but the column is now `uuid[]` → crash.
- Reads `users.email` as `text` but the column is now `citext` → mostly fine but case-comparison semantics differ.

**Decision tree:**

| State at time of rollback | Action |
|---|---|
| Only D2 fired (deploy succeeded); B1/B2/B3 not yet applied | Vercel rollback only (§1). |
| B1 applied (just 0025 audio retention); D2 fired | Vercel rollback only. Old code ignores new column. |
| B2 applied (0026 type conversions); D2 fired | DB rollback §3 FIRST, then Vercel rollback §1. |
| B3 applied (0027 citext); D2 fired | DB rollback §4 FIRST, then Vercel rollback §1. |
| All applied, D2 fired | DB rollback §3 + §4, then Vercel rollback §1. (§2 0025 drop is optional — only do it if column is causing trouble.) |

---

## §1. Vercel deploy rollback

The prior `Ready` deployment is the dna-base-layer at commit `3b10e6a2` (2026-05-04).

**Dashboard path (preferred, visual confirmation):**
1. Vercel UI → Project `cognify-v2` → Deployments tab.
2. Find the deployment dated 2026-05-04 ~21:24 EDT.
3. Click "..." menu → "Promote to Production".
4. Alias `cognify-v2-neon.vercel.app` updates within ~30 seconds.

**CLI path:**
```
npx vercel ls --scope maxvolkov202s-projects | head -20
# identify the pre-cutover deploy URL
npx vercel rollback <prior-deploy-url> --scope maxvolkov202s-projects
```

Verification: `curl -s https://cognify-v2-neon.vercel.app/ | grep -oE "Daily Workout|Today's Workout"` should return `Daily Workout` again.

---

## §2. Migration 0025 rollback SQL

(Only needed if the new column itself is causing trouble; in most rollback scenarios you can leave 0025 in place.)

```sql
ALTER TABLE cognify_v2.users DROP COLUMN IF EXISTS audio_retention_days;
```

Apply via:
```
npx vercel env pull .env.prod-temp --environment=production --yes --scope maxvolkov202s-projects
node scripts/apply-prod-migration.mjs <path-to-rollback-sql-file>
rm .env.prod-temp
```

---

## §3. Migration 0026 rollback SQL

```sql
-- Reverse the 7 FK ADDs (drops are non-blocking metadata changes)
ALTER TABLE cognify_v2.users           DROP CONSTRAINT IF EXISTS users_baseline_rep_id_fk;
ALTER TABLE cognify_v2.reference_reps  DROP CONSTRAINT IF EXISTS reference_reps_source_rep_id_fk;
ALTER TABLE cognify_v2.personal_bests  DROP CONSTRAINT IF EXISTS personal_bests_rep_id_fk;
ALTER TABLE cognify_v2.scoring_telemetry DROP CONSTRAINT IF EXISTS scoring_telemetry_rep_id_fk;
ALTER TABLE cognify_v2.scoring_telemetry DROP CONSTRAINT IF EXISTS scoring_telemetry_user_id_fk;
ALTER TABLE cognify_v2.daily_quests    DROP CONSTRAINT IF EXISTS daily_quests_user_id_fk;
ALTER TABLE cognify_v2.league_membership DROP CONSTRAINT IF EXISTS league_membership_user_id_fk;

-- Reverse the index changes
DROP INDEX IF EXISTS cognify_v2.scoring_telemetry_rep_idx;
DROP INDEX IF EXISTS cognify_v2.exercise_prompts_dim_active_diff_idx;
DROP INDEX IF EXISTS cognify_v2.reference_reps_source_rep_idx;
CREATE INDEX user_prompt_history_user_idx ON cognify_v2.user_prompt_history (user_id);

-- Reverse the 4 JSONB conversions (uuid[] → jsonb, text[] → jsonb)
-- to_jsonb() losslessly converts arrays back to JSONB arrays.
ALTER TABLE cognify_v2.muscle_group_days
  ALTER COLUMN planned_exercise_ids TYPE jsonb
  USING (to_jsonb(planned_exercise_ids));
ALTER TABLE cognify_v2.bug_reports
  ALTER COLUMN image_paths TYPE jsonb
  USING (to_jsonb(image_paths));
ALTER TABLE cognify_v2.external_validations
  ALTER COLUMN rep_ids TYPE jsonb
  USING (to_jsonb(rep_ids));
ALTER TABLE cognify_v2.external_rankings
  ALTER COLUMN ranking TYPE jsonb
  USING (to_jsonb(ranking));
```

---

## §4. Migration 0027 rollback SQL

```sql
-- Reverse users.email: citext → text
ALTER TABLE cognify_v2.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE cognify_v2.users ALTER COLUMN email TYPE text USING email::text;
ALTER TABLE cognify_v2.users ADD CONSTRAINT users_email_key UNIQUE (email);

-- Reverse crew_invites.email: citext → text
DROP INDEX IF EXISTS cognify_v2.crew_invites_email_idx;
ALTER TABLE cognify_v2.crew_invites ALTER COLUMN email TYPE text USING email::text;
CREATE INDEX crew_invites_email_idx ON cognify_v2.crew_invites (email);

-- Keep the citext extension installed; harmless to leave in place.
-- DROP EXTENSION IF EXISTS citext;
```

---

## §5. Feature-flag soft rollback (recommended escape hatch)

If a pivot-specific bug surfaces but the rest of the deploy is fine, the cheapest path is to disable just the pivot:

1. In Vercel dashboard → Settings → Environment Variables → Production:
   - Change `FF_MUSCLE_GROUP_WORKOUT` from `true` to `false`.
2. Redeploy without code changes:
   ```
   npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects
   ```
3. Workout page reverts to `BetaSoon` placeholder; every other improvement (CSP, auth gates, perf, dark mode, env validation, library, calibration ops, etc.) stays live.

This is preferred over a full rollback when the bug is pivot-specific.

---

## §6. Communication if rollback executes

- Drop a short note to Bob: "Rolled back the v2-neon deploy at <timestamp> because <symptom>. Investigating; rollback was clean; no DB data lost. Will redeploy after fix." (Bob also reads from the same Supabase project.)
- Update `memory/project_pre-merge-handoff.md` with the rollback state + cause + next-steps.

---

## §7. Post-rollback verification

After §1 (and §3/§4 if needed):

- `curl -s https://cognify-v2-neon.vercel.app/ | grep -oE "Daily Workout|Today's Workout"` returns `Daily Workout`.
- `curl -sI https://cognify-v2-neon.vercel.app/ | grep -i content-security-policy` returns no enforcing CSP header.
- A signed-in test user can load `/dashboard` without 500.
- `psql "$DATABASE_URL" -c "SELECT data_type FROM information_schema.columns WHERE table_schema='cognify_v2' AND table_name='muscle_group_days' AND column_name='planned_exercise_ids'"` returns `jsonb` (post-§3) or `ARRAY` (if §3 not executed).
