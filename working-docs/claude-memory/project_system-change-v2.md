---
name: system-change-v2
description: "Multi-session project driven by July 2026 System Change doc — tracker at plans/system-change-v2-progress.md, decisions D20-D23"
metadata: 
  node_type: memory
  type: project
  originSessionId: c1dd1a62-4cf5-4ad4-a4bf-38482ce02f51
---

Started 2026-07-15. Max shared the updated "Cognify System Change" doc
(`C:\Users\MaxVolkov\Downloads\Cognify System Change.md`, 2.4MB with embedded images); clean copy
imported to `plans/prd/cognify-system-change-v2-2026-07.md`. It supersedes
`plans/prd/cognify-system-change-prd.md` (which drove [[prd-v3-rebuild]]).

**New in this doc revision:** §5.5 Skill Taxonomy expanded to ~149 hidden skills (code had ~34), and
an "Edits" section with 12 Build-a-Rep dogfooding fixes. Everything else = fidelity work.

**Tracker:** `plans/system-change-v2-progress.md` — 7 phases (0 doc/taxonomy data, 1 taxonomy v2,
2 prompt overhaul, 3 grading rethink, 4 BaR edits, 5 doc-fidelity sweep, 6 prod promotion). One phase
per fresh session; each phase ends code-review → PR → merge → Max verify checklist (in tracker).

**Decisions (Max, 2026-07-15):**
- D20: full adoption of ~149-skill taxonomy as canonical hidden-skill layer
- D21: prompt slate stays 5 (D10 stands over doc's 4/6)
- D22: grading rethink — OpenAI primary ("grade using chatgpt"), single unified pass ("all at once"),
  tone/pacing graded from AUDIO not text alone (design spike: audio-in model vs enhanced prosody);
  Anthropic becomes fallback
- D23: retire legacy prompt System A (src/lib/ai/prompts/* hardcoded banks + rep-type planners)

~~Key known issue: PROD still carries ~31k stale prompt rows / v2 flags off in prod.~~ **BOTH FALSE
(corrected Phase 6):** dev=prod share one DB so the Phase-2 reseed already hit prod (4,148 active
prompts); and the 5 v2 flags were already `true` in prod. ALWAYS check actual prod env, don't trust
"off in prod" notes.

**Progress 2026-07-15 (session 2): Phases 0+1 DONE** on `feat/system-change-v2` — **PR #5 open on
maxvolkov202/Cognify-Product-Description awaiting Max's merge** (self-merge blocked by the
review-required rule). Actual taxonomy count is **148** (Thinking Quality table has 28 rows).
Dev DB migrated: drizzle `0041` folded profile hiddenSkills keys; 94 exercises re-tagged
(manifests + DB). `/code-review` high found 10 verified issues, 9 fixed (legacy-id
canonicalization at all read boundaries, two-stage path normalization, degenerate-prosody gate,
tone-drill retag).

**Session 3 (2026-07-15, same day): PROD PROMOTED.** Max refilled OpenAI (Anthropic still dead)
and authorized self-merge ("review the code yourself then merge once clear" — standing for this
workflow). PRs #5 (phases 0+1), #6 (role-aware OpenAI PRIMARY scoring timeout 45s — 15s budget
was timing out gpt-4o → dead-Anthropic fallback → mock scores on prod), #7 (tracker) all merged;
deployed to cognify-v2-neon.vercel.app via `vercel deploy --prod` (CLI now installed, authed as
maxvolkov202, project cognify-v2).

**Key discoveries:**
- **Dev `.env.local` and prod Vercel use the SAME Supabase DB** (postgres.dunnoccrvrqzsgxsfjuv).
  "Dev DB" changes ARE prod. Old memories claiming separate prod state (31k stale prompts) are
  suspect.
- Prod env already had `AI_PROVIDER=openai`; local .env.local now has it too.
- **gpt-4o only emits bullet `subSkill` attribution when the SIGNALS block is in the prompt**
  (FF_DETERMINISTIC_SIGNALS). Prod has it false → null attribution; Max has the one-liner in the
  tracker session-3 log to flip it (agent blocked from prod flag writes).
- Calibration replay ran on gpt-4o: 0/48 within ±5 vs Anthropic-era baselines (provider shift
  dominates; variance −40..+52). Baselines unusable until Phase 3 re-baseline; drift-cron alerts
  are noise meanwhile.
- `/api/score` needs auth; calibration harness takes `CALIBRATION_GUEST_ID=<uuid>`.
- Prod DATABASE_URL (with password) leaked into a session transcript via a node error — suggested
  Max rotate it.

**Session 4 (2026-07-15): Phase 2 DONE — PR #8 MERGED 2026-07-16** (Max ran the merge himself
after the auto-mode classifier blocked agent PR-create/self-merge on the public repo; permission
rules for gh pr create/merge + vercel now in .claude/settings.local.json with Max's grant).
NOTE: the fork's upstream parent is bobsides-AICodebase — `gh pr create` MUST pass
`--repo maxvolkov202/Cognify-Product-Description` or it targets the upstream with no shared
history. Shipped: prompt-gen engine rewritten
to the doc's generation unit + LLM canon judge (verifyPromptsCanon, shared CANON_RULES so
generator/judge can't drift); doc bank content merged (3 new exercises, 62 prompts); System A
DELETED (~3,600 lines) with catalog-backed planner (`src/lib/workout/lab-plan.ts` +
`src/server/lib/lab-session-planning.ts` pure/tested + `planLabSession` action); /drills,
/skill-lab, /try, legacy BaR cut over; pressure bank relocated to catalog as application='pressure'
exercises keyed by archetype id in application_skills (invisible to workout/lab queries; profile
fold guarded with isApplicationId); taxonomy loaders consolidated into `scripts/taxonomy/lib.mjs`.
DB (shared with prod): reseeded (8 new exercises, 225 prompts) then LLM canon audit
(`scripts/audit-canon-llm.ts`, gpt-4o-mini judge, curated manifests + pressure exempt) deactivated
2,788 Wave-era violators → 4,148 active prompts, no exercise below 8. 8-angle review → 10 findings
all fixed. Prod chore done: FF_DETERMINISTIC_SIGNALS=true live + smoked (subSkill ids non-null).
Max skipped the credential-rotation chore ("focus on builds").

**Vercel env gotcha additions:** see [[vercel-env-newline-gotcha]] — stdin into `vercel env add`
is a 3-way trap; use `--value X --no-sensitive --yes`.

**Session 5 (2026-07-16/17): Phase 3 DONE — PR #9 MERGED** (branch feat/grading-v3, 12 commits).
Spike verdict: OpenAI audio-in models CANNOT discriminate prosody → DSP prosody won (Praat worker
block → text grader). v4 contract live: unified pass (coachFocus behavior/why/action,
strongerVersion quote-validated, per-skill feedback; callouts legacy-read only), OpenAI primary +
real Anthropic fallback budget, reps.feedback jsonb (0042, applied to shared DB), async parity +
watchdog, latency p50 13.6→9.3s / p95 20.3→11.8s. RUBRIC/FEEDBACK_VERSION v4.0.0.
**Big recalibration find: the Ch.11 SIGNALS block ("score PRIMARILY against these numbers") +
weak regex extractors crushed gpt-4o scores into 40-65 — live in prod since the 07-15 flag flip.**
Fixed (signals demoted to corroborating, band anchors unconditional/FF_BAND_ANCHORS retired,
SCORE CALIBRATION + dimension-independence + edge rules, MEASURED RATE wpm line); bank re-authored
from 3× replays (scripts/calibration/reauthor-expectations.mjs + rethreshold-independence.mjs);
harness tolerance composite ±6 / per-dim ±15 (gpt-4o noise at temp 0.2); harness hard-fails on
mock fallbacks. Audio exit criterion PASS (calibrate-audio-tone.mjs: tone pairs +25..+38; one clip
re-tagged upspeak specimen; pacing pairs advisory). Local Praat worker: infra/prosody-worker/.venv
(py3.14 works), uvicorn :8080, FF_PROSODY_WORKER/PROSODY_WORKER_URL now in .env.local.
Bank ordering caveat: pipeline inverts some hand-authored family rankings (excellent < competent
in spots) — bank pins current behavior, not endorsement.

**Session 6 (2026-07-17, same session): Phase 4 DONE — PR #10 MERGED** (feat/bar-edits). All 12
BaR edits: user-named questions = the plan + suggestions rail (source='suggested', sortOrder band
1000+); rep screen = question-only display + scoringPromptText on RepSurface + per-moment
speaking-notes panel (critical_moments.notes jsonb, migration 0043 applied to shared DB,
src/lib/prep/moment-notes.ts pure+tested); photo uploads (vision parse + client downscale
src/lib/prep/image-downscale.ts, HEIC-on-Chrome unsupported); event-relevant coaching rule in
the prep-only event block; review-screen playback + blob revocation; CTA options; em-dash purge.
IMPORTANT: momentPrompt format is /compare's grouping identity — keep byte-stable. 6-angle review
fixed: stale CTA row, regenerate-destroys-notes, zero-practice plans, promptText identity break.
LLM paths (plan gen, notes drafts, vision) verified only via fallbacks+tests — live smoke after
credits re-up.

**Session 7 (2026-07-17, same session): Phase 5 DONE — PR #11 MERGED** (feat/doc-fidelity-sweep).
§4: "run it again" implements the review's new focus (baseAttempt switch in RepControls);
retry hints suppressed. §5.7/§6.8 completion screens fixed (always-on Core Skill breakdown,
value-driven recommendation + secondary Lab link, labeled retry-inclusive fallback). §8.5:
lab planner content memory + soft weakness bias + hash-spread deterministic rotation (guests
legacy); prompt skip memory (migration 0044 skipped_prompt_ids, applied to shared DB);
assessment-phase breadth gate (30-day window). Terminology: Composite→Communication Score etc.
**NEEDS MAX RULING: C10 negative-score softening vs PRD §4.7 "highly visible" (amend PRD or
restore numbers); §8.5 context/scenario-tag memory deferred (schema design).**

**Sessions 8+9 (2026-07-17): post-re-up verifications + Phase 6 prod promotion DONE — PRs #12, #13
MERGED. All 7 phases of System Change v2 are now shipped + deployed.**
- Max re-upped billing. **OpenAI (scoring primary) live; Anthropic (fallback) STILL "credit balance
  too low" after the re-up — flag it, but it only costs the fallback hop.**
- Post-re-up queue all green: full-bank calibration at the ≤5 noise floor (rotating failures =
  temp-0.2 noise); audio tone exit criterion PASS (prosody-sourced, pairs +20..+35); latency
  p50/p95 7.66/10.27s, 0% mock-fallback; Phase-4 BaR LLM smokes (named questions / notes / vision)
  all real-model green via `scripts/smoke-bar-llm.ts`; verify-scoring green.
- **Real bug found + fixed (PR #12):** `strongerVersion.quote` Zod `max(400)` dropped long run-on
  answers into mock-fallback (misreported "provider unreachable"). Raised to 1000. Schema-only →
  no calibration re-author. Two bank pins (mock-era thresholds → real gpt-4o): launch-miss thinking
  65→35, qa-excellent-board 77→68.
- **D24 ruling:** kept Owen C10 score-movement softening (delta < −3 → soft copy); PRD §4.7.2
  amended; do NOT restore visible large negatives.
- **Prod (PR #13):** deployed `vercel deploy --prod` (project cognify-v2, alias
  cognify-v2-neon.vercel.app). Set `FF_PROSODY_WORKER=false` (worker not deployed to prod);
  `NEXT_PUBLIC_USE_ASYNC_SCORING=false` in prod → sync `/api/score` serves everyone → **process-rep
  edge fn is off the critical path.** SIGNALS score-compression bug confirmed FIXED in prod (band
  spread 17→73, rubric v4.0.0).
- **DEPLOY LESSON (cost a failed prod build):** run `next build` before `vercel deploy --prod`.
  Client/server bundle-boundary bugs (a client component importing constants from a module that
  dynamic-imports node-only code → `node:zlib` in the browser bundle) pass tests/typecheck/lint and
  ONLY fail `next build`. Fixed by splitting client-safe constants into `src/lib/prep/parse-constants.ts`.
- **process-rep edge fn DEPLOYED (PR #14)** — Max supplied a Supabase token; deployed to project
  `dunnoccrvrqzsgxsfjuv` (ACTIVE v1, v4 code). Stays off the critical path until
  `NEXT_PUBLIC_USE_ASYNC_SCORING` is flipped on (left off deliberately). **Anthropic-fallback low
  credit is INTENTIONAL** (Max: OpenAI-only).
- **Still handed to Max:** prosody-worker prod deploy (Modal; tone stays text-tier meanwhile);
  auth+mic smoke-matrix items #3–#17 (need creds + mic + connected browser); drift-cron hold until
  one clean nightly.
- Supabase CLI is `node_modules/.bin/supabase`; deploy needs `SUPABASE_ACCESS_TOKEN` (no persisted
  login) + `--project-ref dunnoccrvrqzsgxsfjuv`; works API-side without Docker.
Server-action smoke trick: POST the page route with `Next-Action: <id>` header; find the id in
.next/static/chunks/app/<route>/page.js. RSC wire dedupes into "$ref" strings — not a bug.

**Session 10 (2026-07-20): Holistic post-promotion verification pass (read-only) + PR #16.**
Prod (`cognify-v2-neon.vercel.app`, deploy dpl_3Yowf… today) is healthy and correct: all flags exact
(AI_PROVIDER=openai, 5 v2 flags true, FF_PROSODY_WORKER=false, async=false, FF_DETERMINISTIC_SIGNALS=true,
FF_BAND_ANCHORS=false); build/test/lint green; **all automated checks pass** — calibrate-scoring 3/48
noise failures 0 mock, verify-scoring all-pass, phase-baseline prod p50/p95 8.4/10.1s 0% fallback,
drift-cron dryRun 25/29 ok alert-skipped, audio-tone pairs +20..+35 (toneSource:prosody, ran local
dev+worker). **0 mock-fallback anywhere → OpenAI credits are live.** Report:
`plans/verification-2026-07-20-holistic.md`. Harness: `scripts/qa/` (18 authored reps + scorer;
`BASE=<prod> CALIBRATION_GUEST_ID=9bed97cd-01fa-4832-a120-e2fc578f4bd7`).
- **Grading-fidelity read (18 fresh diverse reps):** low/mid + independence (concise/padded/jargon/
  audience) accurate; junk=14 not floored; all strongerVersion quotes verbatim incl. a 907-char run-on
  (quote-cap fix PR #12 confirmed live). **Weaknesses:** (1) `thinking_quality` under-rates concise/
  disorganized INSIGHT — the two "deep-thinking" stress reps scored thinking 40 & 55 (below their own
  structure), coaching reflexively says "add evidence" for depth; (2) upper-tier under-rating quantified:
  elite investor pitch=75 (expected 85+), no strong rep cleared 78, bank's own "excellent" ref=71.
  P2/P3 = Phase-7 grading recalibration (fixing needs re-authoring the calibration bank's pinned scores →
  Max's ruling on where elite reps SHOULD land; do NOT ship blind — the bank deliberately pins current
  under-rating).
- **PR #16 (fix/headline-echo-band-examples, OPEN):** real defect fixed — gpt-4o was lifting the 3
  HEADLINE-RULES band-example sentences verbatim (score.ts:378-380), so ~11/18 reps got a generic stock
  headline ("Clean from open to ask…" on 5 different rep types). Replaced quotable exemplars with tone
  descriptions + a no-stock-sentence/≤90-char rule. Validated score-neutral (calibration same 3-fail
  shape; qa-excellent-board +8 vs +7 before), 0 dup headlines after. `/code-review` caught a 95-char
  headline regression → fixed. Awaiting Max review/merge.
