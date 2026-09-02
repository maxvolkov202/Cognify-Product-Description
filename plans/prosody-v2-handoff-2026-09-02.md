# Prosody v2 — handoff after Phases 0-4 (2026-09-02)

State of `plans/prosody-v2-plan-2026-09.md` (the contract; decisions P1-P8 + gates pre-registered
there). Full narrative + gate tables: `plans/system-change-v2-progress.md` entries dated
2026-09-01/02. This file is the operational handoff.

## Where things stand

- **Phases 0-4 SHIPPED** (PRs #109 #110 #111 #113 #114, + #112/#115/#116 docs/build fixes).
  Worker v2 (`cognify-prosody-worker-v2` on Modal) serves prod via `PROSODY_WORKER_URL`.
  Gates green: GW1 100/100 · GW2 · GW3 15/15 · GF2 (pre-registered reproducibility rule) ·
  GF1 (sep 48) · GP1 (real sd 17.2) · GC1 (one explained diff, bank re-promoted) · GL1
  (prosody_ms IMPROVED ~400ms; panel <2s in e2e).
- **Flags in prod: `FF_TONE_PROSODY_CORE` and `FF_LIVE_REP_METRICS` are OFF.** They flip
  TOGETHER at Phase 6 (the strip's pitch phrasing presumes prosody-graded Tone).
- **Phase 6 is blocked on the human sheets** (Max + Owen, both currently unavailable):
  `plans/calibration/human-labeling-2026-09/` — sheets A/B (60 reps, ~2h each) + fixture
  mini-sheet (15 clips, ~15 min each). **Signed links expire 2026-09-09**; re-sign is
  non-destructive and takes seconds (below). GH fuel; NOTHING else blocks on them.
- **Phase 5 (Confidence) needs Max's EXPLICIT go** (plan P7) and comes only after GH anyway.

## Ready-to-run Phase 6 tooling (built + dry-run-tested this session)

- `npx tsx scripts/qa/prosody-v2/gh1-compare.mjs` — the GH1 verdict (band agreement ≥70%,
  v2 MAE ≤12, v2 MAE ≤ current MAE) from the filled sheets. Dry-run-tested on synthetic sheets.
  Needs `PROSODY_ENV_FILE=<vercel env pull file>` or `--worker-url/--worker-token`.
- `node scripts/qa/prosody-v2/flip-watch.mjs [--since <date>]` — the post-flip watch table
  (tone spread, graded_from_audio, toneCore-tagged rate, fallback share, warm-hit rate, fv mix).
- Revert drill REHEARSED locally 09-02 (v1 app healthy; `featureVersionAllowed` refuses v2 rows
  at max=1 on real cache rows; v1 re-extraction admissible). The full env-flip drill in preview
  is still Phase 6's step. Revert = `FF_TONE_PROSODY_CORE` off + `PROSODY_WORKER_URL` → v1 app +
  `PROSODY_FEATURE_VERSION_MAX=1` + `FF_LIVE_REP_METRICS` off, then redeploy (Vercel env changes
  need a deploy to take effect).

## Operational notes (bite-prevention)

- `.env.local` IS the prod DB. Harness scripts are read-only; seeding only via
  `SEED_BASE_URL=<prod deploy url> node scripts/qa/prosody-v2/seed-example-reps.mjs` under
  `e2e-harness@cognify.test` (SEED_PASSWORD/E2E_TEST_PASSWORD live in `.env.local`, rotated
  09-02 — the old committed password is DEAD on prod).
- Re-sign packet links (frozen, never resamples): `node scripts/calibration/human-labeling/build-packet.mjs --resign`
  and `node scripts/calibration/human-labeling/build-fixture-minisheet.mjs --resign`.
- **09-02 incident:** the five gitignored packet data files vanished from the working tree
  (cause not identified; nothing in this session deletes them on purpose). Restored from a
  same-day scratch backup, re-signed, verified 11/11 links. A durable copy now lives at
  `~/Documents/Cognify grading docs/human-labeling-backup-2026-09-02/` — refresh that copy after
  any labeling work, and check the packet dir is intact before distributing sheets.
- Prod e2e needs `E2E_LIVE_METRICS=0` until the Phase 6 flip (panel assertions skip).
- Calibration = BOTH `calibrate-scoring.mjs` AND `calibrate-audio-tone.mjs` (local worker on
  :8080-style + dev server; the audio suite serves clips over localhost so a REMOTE worker
  cannot fetch them). Ambient calibrate-scoring drift is 4-6/48 on main with identical env —
  pre-existing provider drift, its own open item.
- Modal token is on this machine (`~/.modal.toml`). Worker deploys:
  `modal deploy infra/prosody-worker/modal_app_v2.py` (v1 app untouched, still deployable).
- Open on Max besides sheets: packet-leak git history decision (PR #78; HEAD clean, tripwires in
  place); Phase 5 go/no-go.

## Handoff prompt (paste into a fresh session)

> We're executing `plans/prosody-v2-plan-2026-09.md` — read it, then
> `plans/prosody-v2-handoff-2026-09-02.md` (state + tooling), then the 2026-09-01/02 tracker
> entries in `plans/system-change-v2-progress.md`. Phases 0-4 are SHIPPED; don't redo them.
> Decisions P1-P8 and all gate numbers are settled.
>
> Current state: worker v2 serves prod; FF_TONE_PROSODY_CORE + FF_LIVE_REP_METRICS are OFF in
> prod and flip TOGETHER at Phase 6. Phase 6 is blocked on the human sheets (links expire
> 2026-09-09; re-sign with --resign if needed, NEVER a plain build). GH1 evaluator + flip-watch
> are built and dry-run-tested. Phase 5 needs my explicit go — do not start it.
>
> Hard rules that still bite: .env.local IS prod (read-only harness, @cognify.test seeding
> only); branch + PR + /code-review per change, never direct to main; example reps are
> RE-SEEDED, never re-scored; calibration means BOTH suites; every phase ends with its gate
> table + a Next line in the tracker; if a gate fails twice after retuning, STOP and bring me
> options. When the sheets are filled: gh1-compare → (retune curves + GF/GP re-run if MAE
> fails) → preview revert drill → prod flip of both flags → calibration re-run → flip-watch →
> D-number decision-log entry superseding D22's literal text → Bob demo.
