# Phase 15 — CTO audit synthesis (2026-07-06)

Five parallel auditors re-read the PRD + platform after Phases 0-14.
Every finding and its disposition. Waves: **W1** = commit `4bd33d2b`,
**W2** = second agent wave (same day), **W3/deferred** = tracked below.

## Platform (auditor: architecture/CTO)
Theme: **"the fallback is the lie"** — safeDb and fallback objects
return success-shaped synthetic values (random repIds, zeroed stats,
guest users) that downstream code and dashboards can't distinguish from
real ones. F-2/F-3/F-4 were all instances.

| # | Finding | Disposition |
|---|---------|-------------|
| P-1 | persisted:false ignored; fake repId propagates (F-4 still armed) | ✅ W1 — labeled safeDb writes (counters + dev-throw) + RepSurface banner |
| P-2 | saveRep non-transactional; fallback lies in both directions | ✅ W1 — core tx; best-effort layers outside |
| P-3 | 76 raw SQL fragments, zero executed by tests (F-3 class) | ✅ W2 — 38-check harness (`npm run test:contract`); IMMEDIATELY caught two more always-broken queries (see New finds) |
| P-4 | no general /api/health | ✅ W1 |
| P-5 | auth→guest degradation invisible | ✅ W1 — counter + structured log |
| P-6 | stats fallback zeros read as "healthy" | ✅ W1 — degraded:true sentinel |
| P-7 | no type-level id-family protection (the F-4 junction is `string`) | ⏳ W3 — branded ids on 5 hot pk columns; needs a quiet tree |
| P-8 | crons have no run ledger | ✅ W2 — migration 0038, all 6 routes record ok/duration/error |

## §4-5 Engine/Workout
| # | Finding | Disposition |
|---|---------|-------------|
| W-1 | composite_at_close never written by the real flow (§5.7 hero "—", vs-last-day dead, confidence-builder can never fire) | ✅ W1 — day-close inside tagWorkoutRep tx |
| W-2 | Skip station silently no-op (incl. empty-bank recovery) | ✅ W1 |
| W-3 | §4.6 Stronger Version never renders on Retry | ✅ W1 |
| W-4 | exemplar picker misses the F-5 redirect | ✅ W1 |
| S-1/W-5 | focus text gone during retry recording | ✅ W2 |
| S-2/W-6 | Workout Complete flattens First→Retry story; movement math cross-exercise | ✅ W2 |
| S-3/W-7 | Coach Recommendation never recommends The Lab (§5.7) | ✅ W2 |
| S-4/W-8 | §4.7 review order | ✅ W1 |

## §6-7 Lab / Build a Rep
| # | Finding | Disposition |
|---|---------|-------------|
| L-1 | readiness evidence client-supplied + dies on refresh | ✅ W1 — server-side recompute |
| L-2 | uploaded context never reaches per-moment coaching (§7.5) | ✅ W1 — eventContext block, calibration-safe |
| L-3 | Lab sessions not resumable; sessions never close | ✅ W1 — migration 0036 + resume offer |
| L-4 | moments lack coachCue/scoringHint | ✅ W2 — migration 0039; 42 fallback moments hand-authored; hint rides eventContext (calibration-safe) |
| L-5 | Readiness Review has no concrete next action | ✅ W2 |
| L-6 | first-rep session race | ✅ W1 — awaited ensureSession |
| L-7 | empty outcome on quit | ✅ W1 |
| L-8 | improvement row vanishes | ✅ W1 |
| L-9 | similar-event history ignored (§8.4.6) | ✅ W2 |
| L-10 | sim duration caps disagree | ✅ W1 — aligned to 25-min score ceiling |

## §8 Intelligence
| # | Finding | Disposition |
|---|---------|-------------|
| I-1 | prompt gen drops stage + goals | ✅ W1 |
| I-2 | snapshot computed on hot path, intelligence unconsumed | ✅ W1 — split + UPCOMING EVENT line |
| I-3 | Daily Workout never reads the profile (post-break users look untrained) | ✅ W1 — 0.7/0.3 blend |
| I-4 | plateau = dim-swap only | ✅ W1 — hidden-skill inversion |
| I-5 | coaching memory never surfaces pre-rep | ✅ W2 |
| I-6 | assessment not coverage-aware | ✅ W2 |
| I-7 | no adaptive time-pressure/constraint variation (§8.5.3 step 4) | ⏳ W3 — batch with next calibration replay (changes timeBudgetMs semantics) |
| I-8 | no coaching-technique ledger (EFFECTIVENESS can't verify "switch technique") | ⏳ W3 — technique enum in implementationReview + per-(dim,technique) aggregation |
| I-9 | coached retries fold at full weight (profile drifts toward coached ceiling) | ⏳ W3 cheap: halve k for retry/again in the fold + idempotent backfill — decide with Max (PRD says "every rep contributes") |
| I-10 | no cross-mode "recommended next experience" owner | ⏳ post-promotion (per-mode recs cover the user-visible surface) |

## §9-10 Progression / Onboarding
| # | Finding | Disposition |
|---|---------|-------------|
| R-1/G1 | split-brain streak (progression ran on naive UTC streak) | ✅ W1 — single source |
| R-2/G2 | no mode XP weights or session-completion XP (§10.5.3) | ✅ W1 |
| R-3/G3 | rank-up detection localStorage-only | ✅ W1 — migration 0037 server truth |
| G4 | 2-day committed schedules blocked vs PRD example | ✅ W2 |
| G5 | slate-time topic diversity unenforced (§9.4.1) | ✅ W2 |
| G6 | committed-schedule weekly challenge missing | ✅ W2 |
| S1 | no implementation-based achievements (§10.12); BaR achievement name; dead pressure achievement | ✅ W2 — implement_5/25/100; pressure plumbed incl. async path + rep-column persist |
| S2 | freeze bank: only 1 of 3 ever applies; spend invisible | ✅ W2 — multi-freeze walkBack (32 tests) + freeze-used chip |
| S3 | rank badge absent from leaderboard (§10.5.1) | ✅ W2 |
| S4 | UTC "today" windows in ProgressionStrip | ✅ W2 — user-TZ today for chips + freeze window |
| doc | catalog README missing 11 framework/pack fields | ✅ W2 |

## New finds during wave 2 (the contract harness paying rent immediately)
- **getRepWithDetails threw on EVERY call** (drizzle relations lacked the
  dimensionScores/callouts back-references) → the rep-detail page 404'd
  for every rep in production. Fixed + harness-enforced.
- **fetchEngagement / fetchPlateauedDims TypeError'd on every row with a
  date** (db.execute returns timestamptz as string; .toISOString threw;
  safeDb ate it) → dim selection has been running on its cold-start
  fallback (hence every e2e day being "Clarity Day") and plateau
  detection never fired. Exposed only AFTER F-4's fix made engagement
  rows persist; briefly broke start-day via the new plateau flag, caught
  live, fixed with date coercion.
- Both are instances of the P-3 blindspot for ACTION-local SQL — the
  harness covers `queries/`; consider extending to action-module SQL in
  a future pass.

## Deferred to wave 3 (isolated PRs, post eyes-on)
- **P-7 branded id types** — mechanical, wide-churn; deliberately held
  out of the review diff. Runtime nets (contract harness, session probe,
  live loops, write counters) cover the class meanwhile.
- I-7 adaptive time-pressure variation (batch with a calibration replay).
- I-8 coaching-technique ledger. I-9 retry-weighted profile fold (ask
  Max). I-10 cross-mode recommendation owner (post-promotion).

## Standing guardrails (unchanged)
- Any change to scoring PROMPTS batches with a calibration replay; blocks
  that render only-when-present keep non-prep prompts byte-identical.
- Nothing pushes to origin without Max's approval.
- At Anthropic re-up: remove SCORING_PROVIDER/AI_PROVIDER override,
  re-baseline drift, revisit F-1 generated-prompt register.
