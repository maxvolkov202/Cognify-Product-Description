# Production promotion runbook — feat/prd-v3 → live (2026-07-07)

Verified against the actual scripts/migrations by the Phase 16 audit.
Every command was checked for existence + prod-safety. Personnel gates
(Vercel access, prod env vars) are Max/Bob-side.

## Gate 0 — before touching prod
- [ ] AI credits confirmed (OpenAI live; Anthropic optional — Phase 14 makes either provider primary)
- [ ] Max eyes-on tour on dev complete (demo@cognify.test / cognify-demo-7h2p9w!D)
- [ ] Dev calibration replay ≈ baseline: `curl -H "authorization: Bearer $CRON_SECRET" "http://localhost:3333/api/cron/calibration-drift?dryRun=1"` vs `plans/calibration-baseline-openai-2026-07-06.json`
- [ ] `npx tsx scripts/smoke-engine-v2.ts` → 11/11

## 1. Push + merge (can precede everything)
```
git push -u origin feat/prd-v3        # branch currently exists on ONE machine only
# open PR → main (repo rule: no direct commits to main) → merge
```
The merge triggers the prod build. Flags are still off ⇒ it ships as the
current legacy experience — safe.

## 2. Pull prod env
```
npx vercel env pull .env.prod-temp --environment=production --yes
```

## 3. Preflight probe (pre-deploy OK)
```
node scripts/verify-prod-migrations.mjs
```
Expect: pivot-base tables ✓, the 0028+ probes ✗ (not applied yet),
~54 active exercises. If the PIVOT BASE tables are missing → stop;
migrations 0020–0027 must be applied first (same runner, idempotent).

## 4. Migrations 0028–0039 (pre-deploy OK — purely additive)
```
for f in drizzle/migrations/00{28,29,30,31,32,33,34,35,36,37,38,39}_*.sql; do
  node scripts/apply-prod-migration.mjs "$f" || break
done
node scripts/verify-prod-migrations.mjs   # every table/column probe must pass
```
Notes: runner takes ONE file per invocation, auto-commits the 0033 enum
ALTER separately (required by Postgres). All 12 verified idempotent; no
data dependencies; nothing destructive to existing rows.

## 5. Deploy live
Merge from step 1 should already have deployed. Verify:
```
curl https://<prod-domain>/api/health          # {ok:true, ts} (public body is minimal)
```

## 6. Seed the catalog — AFTER the new build is live
(Old code lacked the `application IS NULL` daily-workout filter; seeding
app exercises under old code could serve them as workout stations.)
```
export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env.prod-temp | cut -d= -f2- | tr -d '"')"
node scripts/seed-exercise-catalog.mjs --dry-run    # expect 94 exercises; CHECK THE ECHOED HOST
node scripts/seed-exercise-catalog.mjs --apply      # ~40 new + 54 updated, ~1334 prompts
```

## 7. Backfill (same shell)
```
npx tsx scripts/backfill-communication-profile.ts --dry-run
npx tsx scripts/backfill-communication-profile.ts --apply
unset DATABASE_URL; rm .env.prod-temp
```
Do **NOT** run `backfill-progression.mjs` (legacy XP formula; already ran
in a prior era — re-running would overwrite §10.5.3-weighted XP).

## 8. Env + flags, then REDEPLOY (env applies to new builds only)
Required additions (see `.env.example` tiers):
```
FF_MUSCLE_GROUP_WORKOUT=true    # missing this = BetaSoon placeholder, no legacy fallback
FF_TRAINING_ENGINE_V2=true
FF_SKILL_LAB_APPS=true
FF_BUILD_A_REP_V2=true
FF_RANK_SYSTEM=true
FF_PROMPT_GEN=true
CRON_SECRET=<32+ chars>         # all crons fail closed without it now
AI_PROVIDER=openai              # until Anthropic re-ups; then remove
RESEND_API_KEY=<...>            # welcome/support/reminder emails
EMAIL_FROM="Cognify <hello@cognifygym.com>"
UPSTASH_REDIS_REST_URL / _TOKEN # real rate limiting on the AI burn vectors
OPS_SECRET=<...>                # optional; detailed /api/health (falls back to CRON_SECRET)
```
Verify present: `ANTHROPIC_API_KEY` (boot-required even in openai mode),
`OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `INTERNAL_SCORING_SECRET` (only if
async scoring is on), `NEXT_PUBLIC_APP_URL`. Leave unset: `FF_LEAGUES`,
`FF_SUBSKILL_UI`, `FF_BUILD_A_REP_PREMIUM` (true locks EVERYONE out of
Build a Rep). Then redeploy.

**Vercel project check:** confirm Fluid Compute (or Pro function
durations) so `maxDuration=300` on calibration-drift + day-rollover is
honored — on a clamped plan the nightly drift run dies mid-band.

## 9. Post-deploy smoke
```
curl -H "authorization: Bearer $OPS_OR_CRON_SECRET" https://<prod>/api/health   # detailed body, breaker closed, provider right
curl https://<prod>/api/score/health                                            # live 1-token probe through the REAL serving path
curl -H "authorization: Bearer $CRON_SECRET" "https://<prod>/api/cron/committed-day-reminder?dryRun=1"
curl -H "authorization: Bearer $CRON_SECRET" "https://<prod>/api/cron/calibration-drift?dryRun=1"
```
Then a REAL account: signup → 5-step onboarding → /workout → Insight →
First Rep → score → required Retry → Improvement Review. DB checks: rep
rows with `attempt_kind`, a `coaching_events` row, `communication_profile`
row, XP moved, day `completed_reps` correct.

Next morning:
```
SELECT name, ok, duration_ms, ran_at FROM cognify_v2.cron_runs ORDER BY ran_at DESC LIMIT 12;
```

## 10. Post-launch (quiet window)
- `expand-prompt-bank.ts --per-exercise 10 --apply` against prod (the 940
  generated prompts live only in dev; prod starts curated-only — fine,
  FF_PROMPT_GEN tops up at starvation, but pre-warming avoids in-request
  Sonnet/GPT-4o calls). Budget ~100 generation calls.
- Point `CALIBRATION_ALERT_WEBHOOK_URL` at Slack.
- External uptime poller on `/api/health` (public body).
- Watch `db.write_failed` + `auth.degraded_to_guest` in logs for week 1.

## Rollback
Flip the six FF_* lines off + redeploy → legacy paths (deliberately
retained) serve again. Exception: `FF_MUSCLE_GROUP_WORKOUT=false` renders
the BetaSoon placeholder, not a legacy workout — full rollback is
"pre-pivot legacy", not "v2 minus one feature". Migrations are additive;
no schema rollback needed.
