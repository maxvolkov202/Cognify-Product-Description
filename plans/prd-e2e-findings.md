# Phase 12 — E2E findings ledger

Per Max 2026-07-06: "once weve built everything we are then going to test
everything end to end then document additional fixes we need then build
that as well". Every finding gets an entry; Phase 13 builds them and
checks them off. Loop until empty.

**Environment**: dev on :3333, OpenAI provider (Anthropic dead — revert at
re-up), flags default-ON outside production. Accounts: `demo@cognify.test`
(populated, 90 reps) / `e2e-harness@cognify.test` (cold-start).

**Severity**: 🔴 broken flow or wrong data · 🟠 degraded UX or wrong copy ·
🟡 polish / quality.

## Status legend
- [ ] open · [x] fixed (link commit)

---

## Test runs

| Run | Result | Notes |
| --- | --- | --- |
| Unit suites (`npm test`, 11 suites) | ✅ 501 pass / 0 fail | post-11.D/E |
| Smoke harness (`smoke-engine-v2.ts`, live OpenAI) | ✅ 11/11 | AFTER the D3 scoring-context change (scoring_emphasis + failure modes now render for all 94 exercises) |
| Bank expansion (11.D4) | ✅ 940 prompts, 0 failures | quality note → F-1 |
| Drift replay vs OpenAI baseline | ✅ identical | 29 reps: avg \|Δ\| 7.8 (= baseline), max 23 (base 22), 0 errors/fallbacks; only 2 reps moved ≥8 vs baseline (run noise). D3 scoring-context change did NOT shift calibration. |
| Unauthed e2e (13 specs, iPhone-14) | ✅ 13/13 | |
| Authed live loops (workout / skill lab / build-a-rep) | pending | |
| Route sweep (all app routes × cold-start + populated) | pending | |
| Cron dry-runs | pending | calibration-drift ✅ (the dryRun above) |
| Generation quality review | ✅ acceptable | 40-prompt random sample: most carry audience/setting framing, topic spread per §5.6 clearly visible (town halls, gardening, interviews, art, sports). See F-1 (downgraded). |

---

## Findings

### F-1 🟡 Some generated prompts are bare abstract asks (minor)
- **Surface**: prompt-gen (11.D4 expansion output, `tags: ["generated"]`, 940 rows)
- **Assessment (40-row random sample)**: majority WELL-framed with named
  listener/setting; §5.6 topic spread visible. A minority are bare asks
  ("Make the case that smartphone apps are eroding privacy standards") —
  mostly on exercises whose rule doesn't demand an audience, where that's
  acceptable. The one truly thin batch seen in debugging (headline-first
  yes/no one-liners) predates the register examples flowing correctly.
- **Disposition**: ACCEPT for now — live selection mixes curated + generated,
  and QA already dedupes. Revisit at Anthropic re-up (Sonnet was the
  intended generator); if Max dislikes any surfaced prompt in eyes-on
  testing, prune with `scripts/prune-prompts.mjs`.
