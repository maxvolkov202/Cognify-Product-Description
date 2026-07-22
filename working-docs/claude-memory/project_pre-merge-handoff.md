---
name: pre-merge-handoff-2026-05-27-shipped
description: "Cutover SHIPPED 2026-05-27. cognify-v2-neon.vercel.app is now running HEAD of feat/muscle-group-pivot. Migrations 0025/0026/0027 applied to prod Supabase (clean). All 5 pre-deploy patches landed. Calibration drift cron still broken — pre-existing prod issue (Anthropic timeout + 300s function budget under 29-rep load), not introduced by cutover. INTERNAL_SCORING_SECRET corruption flagged but untouched."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05874d44-5c1b-43e5-badf-fe405f2d48ac
---

**Status (2026-05-27, post-cutover):** Production is live on the v2 stack. All cutover-scope verifications pass.

## What landed

7 new commits on `feat/muscle-group-pivot`:
- `dfb12cb4` Patch 1 — CSP `img-src` adds `https:`
- `05a1c1bc` Patch 2 — audio-retention cron `?dryRun=1` support
- `e547e3f3` Patch 3a — calibration-drift initially swapped to `/api/score-internal` (insufficient — see below)
- `9f3338e9` Patch 4 — migration 0025 default 90 → 180
- `8001a56d` cutover deliverable docs (plans/pre-merge-review.md, cutover-checklist.md, smoke-matrix.md, rollback.md)
- `5bf2d6ca` 0026 migration fix — helper functions for JSONB→array; drop+restore jsonb default on bug_reports.image_paths
- `837e4838` vercel.json — muscle-group-day-rollover hourly → daily (Vercel Hobby plan cap)
- `72abc278` Patch 3b — calibration-drift refactored to call scoreRep() in-process (the actual P-4 fix)

DB migrations applied to prod Supabase:
- 0025 — users.audio_retention_days integer DEFAULT 180 ✓
- 0026 — 7 FKs added, 4 JSONB columns converted to ARRAY, 3 indexes added, 1 dropped ✓
- 0027 — users.email + crew_invites.email switched to citext; citext extension 1.6 installed ✓

Vercel prod env:
- CRON_SECRET (64 hex chars) — added this session
- FF_MUSCLE_GROUP_WORKOUT="true" — added this session
- OPENAI_FALLBACK_MODEL="gpt-4o" — cleaned this session (was stored as `gpt-4o\n`)

Live verifications on `cognify-v2-neon.vercel.app`:
- Marketing page 200 ✓
- CSP enforcing header present; `img-src 'self' blob: data: https:` ✓
- HSTS preload, Permissions-Policy (mic=self), X-Frame-Options DENY, Referrer-Policy, X-Content-Type-Options all set ✓
- Auth gates: /api/score, /api/score/health/stats, /api/transcribe, /api/talking-points all 401 unauth ✓
- Audio-retention dryRun (with secret) → `{"dryRun":true,"expired":0,"capped":false,"sample":[]}` ✓
- /workout page renders the muscle-group pivot (stations, exercises, dimensions, composites) — FF flag confirmed ✓
- /ops unauth → 200 with forbidden shell (no operator data leaked) ✓

## Pre-existing prod hygiene issues surfaced (NOT introduced by cutover)

1. **Calibration drift cron still broken.** Patch 3 (in-process scoring) closed the P-4 self-throttle. But the cron now hits Vercel's 300s function timeout because Anthropic times out at 5000ms per call and the OpenAI fallback adds latency → 29 ref reps × 10–15s each exceeds 300s. Need separate work: either parallelize the fanout (Promise.all with concurrency), reduce the bank to <15 reps, or extend the Anthropic timeout. Not user-facing.
2. **INTERNAL_SCORING_SECRET stored with trailing `\n`.** Pulled value is 66 chars (64 hex + `\n`). The Supabase Edge Function calling /api/score-internal seemingly uses a matching corrupt value (regular rep scoring works in prod). Leaving untouched — cleaning Vercel side without coordinating the Edge Function side would break rep scoring. Document for future hygiene pass.
3. **OPENAI_FALLBACK_MODEL was stored with trailing `\n`.** Cleaned this session.

## Smoke matrix status

Automatable items (curl-based) — ALL PASS:
- ✓ #2 enforcing CSP + all security headers
- ✓ #12 POST /api/score unauth → 401
- ✓ #13 GET /api/score/health/stats unauth → 401
- ✓ #14 GET /api/cron/audio-retention?dryRun=1 unauth → 401
- ✓ #15 same with CRON_SECRET → {"dryRun":true,"expired":0}
- ✓ #17 /ops unauth → no operator data

Browser-required items — STILL NEED EYES-ON:
- #1 console clean
- #3 Google OAuth → onboarding
- #4 email/password sign-in → dashboard
- #5 sign out → reload (no signed-in shell flash)
- #6 guest rep flow
- #7 workout flow (Start → 4 reps → day summary)
- #8 library page (YouTube thumbnails + OG images)
- #9 UserMenu OAuth avatar
- #10/11 privacy settings retention dropdown
- #16 /ops/calibration (will show error rows — see pre-existing issue above)
- #18 console-clean during sessions
- #19 audio playback on a week-old rep
- #20 RestDayNotification
- #21 theme toggle
- #22 mobile viewport

## Safety rails respected this session

- No `git push` — branch is 26 commits ahead of `origin/feat/muscle-group-pivot` locally. Max can push when ready.
- Migrations applied with explicit auth.
- vercel deploy --prod ran with explicit auth.
- Env var changes only on what Max explicitly authorized (CRON_SECRET, FF_MUSCLE_GROUP_WORKOUT, OPENAI_FALLBACK_MODEL cleanup).
- INTERNAL_SCORING_SECRET corruption flagged but not touched (would risk breaking rep scoring pipeline).

## Bob notification

Bob's post-deploy note (template in plans/keen-wondering-treehouse.md §9) not yet sent. Max decides timing.

Related memories: [[muscle-group-pivot]] · [[full-app-audit-fixes]] · [[deployment-gates]] · [[deferred-work]]
