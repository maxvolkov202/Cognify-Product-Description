---
name: prd-v3-rebuild
description: PRD v3 rebuild — LIVE IN PRODUCTION 2026-07-07 on cognify-v2-neon.vercel.app; PRs #1/#2 need Max's merge (repo hygiene only); Anthropic re-up revert + Vercel Pro crons pending
metadata: 
  node_type: memory
  type: project
  originSessionId: 407944d3-edaa-45de-b0d1-12dac020305e
---

PRD v3 rebuild (plans/prd/cognify-system-change-prd.md): **DEPLOYED TO PRODUCTION 2026-07-07** via `npx vercel deploy --prod` — project cognify-v2 has NO git link, the CLI from the working tree IS the deploy path, so PR merges are repo hygiene, not deployment. All 17 phases (0–16) + wave 3 live at https://cognify-v2-neon.vercel.app.

Live prod state:
- Env: FF_TRAINING_ENGINE_V2/FF_SKILL_LAB_APPS/FF_BUILD_A_REP_V2/FF_RANK_SYSTEM/FF_PROMPT_GEN=true; AI_PROVIDER=openai (Anthropic credits exhausted); FF_DETERMINISTIC_SIGNALS/FF_BAND_ANCHORS/FF_SUBSKILL_UI=false (tested-config parity); FF_BUILD_A_REP_PREMIUM must stay UNSET (true locks everyone out).
- Prod and dev share the SAME Supabase DB (postgres.dunnoccrvrqzsgxsfjuv) — migrations 0028–0040, catalog seed, backfills were live before the deploy by construction. Demo seeder must NEVER run against it as "prod test data".
- Vercel HOBBY plan rejects sub-daily crons → rollover `0 9 * * *`, committed-day-reminder `0 16 * * *` (commit 4dd8f097). Both routes were DESIGNED for hourly user-local-time windows; Pro upgrade should restore `0 * * * *`.
- Smoke verified post-deploy: /api/health (public minimal + Bearer CRON_SECRET detailed: db 153ms, provider openai, both keys), /api/score/health live probe 1.7s, `/` `/signin` `/workout` robots.txt 200, reminder dryRun ok.

Services provisioned 2026-07-07 via Vercel Marketplace: Upstash Redis (cognify-ratelimit; KV_REST_API_* aliased to UPSTASH_REDIS_REST_*, per-IP limits loosened per Max "don't rate limit too hard" — limiter fails open) + Resend (cognify-email, domain cognifygym.com, RESEND_API_KEY live, EMAIL_FROM left default until DNS verified). Uptime = .github/workflows/uptime.yml (15-min health probe; activates on merge to main). Redeployed + re-smoked incl. live Playwright login as demo user. Docx re-audit: identical to extraction, no new requirements.

Still Max's (human-only): merge PR #1 then PR #2 (gh pr merge blocked by auto-mode classifier enforcing "All PRs require review"); Vercel Pro upgrade (billing) then restore hourly crons; add Resend DNS records for cognifygym.com then set EMAIL_FROM; pick a CALIBRATION_ALERT_WEBHOOK_URL destination; on Anthropic re-up remove AI_PROVIDER=openai and re-baseline.

Deferred (documented in plans/phase15-audit-synthesis.md): P-7 branded id types, I-10 cross-mode recommendations. Demo acct demo@cognify.test / cognify-demo-7h2p9w!D. Full-day live proof: `AUTHED=1 FULLDAY=1 npx playwright test tests/e2e/authed/zz-full-day.spec.ts` (restart stale dev servers first). `db.execute` returns timestamptz as STRING — never .toISOString() those rows.

Related: [[pre-merge-handoff]], [[deployment-gates]]
