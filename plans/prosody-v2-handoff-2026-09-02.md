# Prosody v2 — operational handoff (updated 2026-09-03 after the flip)

Originally written 2026-09-02 after Phases 0-4; **updated in place 2026-09-03 after Phase 6
executed (D27)** so every line below reflects the POST-flip world. The contract is
`plans/prosody-v2-plan-2026-09.md` (read its 2026-09-03 amendment note first); full narrative +
gate tables: `plans/system-change-v2-progress.md` entries dated 2026-09-01/02/03 + decision D27.

## Where things stand

- **Phases 0-4 SHIPPED** (PRs #109 #110 #111 #113 #114, + #112/#115/#116 docs/build fixes).
  Worker v2 (`cognify-prosody-worker-v2` on Modal) serves prod via `PROSODY_WORKER_URL`.
  Gates green: GW1 100/100 · GW2 · GW3 15/15 · GF2 (pre-registered reproducibility rule) ·
  GF1 (sep 48) · GP1 (real sd 17.2) · GC1 (one explained diff, bank re-promoted) · GL1
  (prosody_ms IMPROVED ~400ms; panel <2s in e2e).
- **Phase 6 EXECUTED 2026-09-03 (D27): `FF_TONE_PROSODY_CORE` and `FF_LIVE_REP_METRICS` are
  BOTH ON in prod** (deploy `cognify-v2-2a862rjqu`, flipped together). Flip-day evidence:
  re-seed batch `phase6-flip` 15/15 fv2 with 14/15 `[toneCore:]`-tagged (1 = the usual
  cold-start race), prod tone flat 30–33 vs expressive 60–75; GC1 both suites (44/48 = ambient
  drift band; audio 15/15 on the confirming run); prod e2e 4/4 incl. panel-before-scores;
  revert drill executed end-to-end on the prod-serving path.
- **GH1 is the ONE remaining obligation (STANDING, not blocking anything else):** when sheets
  A/B + the fixture mini-sheet are filled, run
  `npx tsx scripts/qa/prosody-v2/gh1-compare.mjs --seed-batch phase3-tone-core`.
  The verdict is THREE criteria — band agreement ≥70% AND v2 MAE ≤12 AND v2 MAE ≤ current MAE —
  failing ANY ⇒ retune curves (+ GF/GP re-run) or revert. **`--seed-batch phase3-tone-core` is
  mandatory:** the phase4-panel default is contaminated (the 09-03 drill re-scored one of its
  reps) and no new flag-off baseline can be seeded while the flag is ON; keep
  `out/seed-batch-phase3-tone-core.json` — it cannot be regenerated without a prod revert.
- **Sheets:** `plans/calibration/human-labeling-2026-09/` — A/B (60 reps, ~2h each) + fixture
  mini-sheet (15 clips, ~15 min each). **Signed links expire 2026-09-09**; re-sign is
  non-destructive and takes seconds (below).
- **Standing watch:** `node scripts/qa/prosody-v2/flip-watch.mjs --since 2026-09-03` once ~10
  real audio reps land post-flip. `--since` is UTC and the flip landed ~01:15 UTC 09-03, so the
  window also catches ~75 min of pre-flip reps — judge by `tone_core_tagged`, not by presence.
- **Phase 5 (Confidence) still needs Max's EXPLICIT go** (plan P7), after GH1.

## Revert (drilled 2026-09-03: guard refused fv2 → v1 extraction served → cache healed)

`FF_TONE_PROSODY_CORE` off + `PROSODY_WORKER_URL` → v1 app + `PROSODY_FEATURE_VERSION_MAX=1` +
`FF_LIVE_REP_METRICS` off, **then `vercel deploy --prod`** (Vercel env changes need a deploy to
take effect — the plan's "no deploy" line is wrong, see its amendment note). Old code: git tag
`prosody-v1-safe-2026-09-02` (recipe in the tag message); v1 Modal app stays live and healthy.
Post-revert caveats: (a) the FIRST rep on a scaled-to-zero v1 worker exceeds the 5s in-request
budget → one text-tier tone rep, then warm; (b) put the `E2E_LIVE_METRICS=0` opt-out BACK on
prod e2e runs or the (default-ON) panel assertion fails on the correctly-missing panel.
There is NO Vercel preview environment in this project (never configured) — drills run locally
against the prod DB with the revert env.

## Operational notes (bite-prevention)

- `.env.local` IS the prod DB. Harness scripts are read-only; seeding only via
  `SEED_BASE_URL=<prod deploy url> node scripts/qa/prosody-v2/seed-example-reps.mjs` under
  `e2e-harness@cognify.test` (SEED_PASSWORD/E2E_TEST_PASSWORD live in `.env.local`, rotated
  09-02 — the old committed password is DEAD on prod).
- Re-sign packet links (frozen, never resamples): `node scripts/calibration/human-labeling/build-packet.mjs --resign`
  and `node scripts/calibration/human-labeling/build-fixture-minisheet.mjs --resign`.
- **09-02 incident:** the five gitignored packet data files vanished from the working tree
  (cause not identified). Restored from a same-day scratch backup, re-signed, verified 11/11
  links. Durable copy: `~/Documents/Cognify grading docs/human-labeling-backup-2026-09-02/` —
  refresh it after any labeling work; check the packet dir is intact before distributing sheets.
- Prod e2e: use the DEPLOYMENT url (`PW_BASE_URL=https://cognify-v2-<id>-…vercel.app`) —
  auth.setup refuses `cognifygym.com` by hostname. Panel assertion is default-ON post-flip
  (only pass `E2E_LIVE_METRICS=0` if the flag is off, e.g. after a revert).
- Calibration = BOTH `calibrate-scoring.mjs` AND `calibrate-audio-tone.mjs`. Dev server needs
  `FF_DETERMINISTIC_SIGNALS=true` + `FF_DETERMINISTIC_SIGNALS_PERCENT=100` (else ~14-18/48
  spurious fails) and a `CALIBRATION_GUEST_ID=<any fixed uuid>`; the audio suite needs a LOCAL
  worker on :8080 (serves clips over localhost — a remote worker cannot fetch them). Local
  worker recipe: scratch venv (python3.9 + praat-parselmouth + `eval_type_backport`) +
  imageio-ffmpeg's bundled static ffmpeg. Ambient calibrate-scoring drift is 4-6/48 on main
  with identical env — pre-existing provider drift, its own open item.
- Vercel env vars are SENSITIVE by project default now — `vercel env pull` returns
  `[SENSITIVE]`, so the trailing-newline grep is impossible; verify new flags FUNCTIONALLY
  (flip → deploy → smoke a flag-dependent surface). Flag parser: exact `"true"`/`"1"` on,
  exact `"false"`/`"0"` off, anything else falls through to the env default (OFF in prod,
  ON in preview/dev).
- Modal token is on this machine (`~/.modal.toml`). Worker deploys:
  `modal deploy infra/prosody-worker/modal_app_v2.py` (v1 app untouched, still deployable).
- Latent gap (pre-existing): the async scoring path (`/api/score-internal`) never passes
  `audioPath` → bypasses prosody cache/version-guard/heal. Dormant
  (`NEXT_PUBLIC_USE_ASYNC_SCORING=false`) but bites if async is ever enabled.
- Open on Max besides sheets: packet-leak git history decision (PR #78; HEAD clean, tripwires
  in place); Phase 5 go/no-go; Bob demo (the system now demonstrably works).

## Handoff prompt (paste into a fresh session)

> Prosody v2 is SHIPPED AND FLIPPED: `plans/prosody-v2-plan-2026-09.md` executed through
> Phase 6 (read its 2026-09-03 amendment note), FF_TONE_PROSODY_CORE + FF_LIVE_REP_METRICS
> both ON in prod since 2026-09-03 (D27). Read `plans/prosody-v2-handoff-2026-09-02.md`
> (post-flip state + tooling), then the 2026-09-03 tracker entry + D27 in
> `plans/system-change-v2-progress.md`. Do NOT re-execute the flip, the drill, or any phase.
>
> What remains: (1) STANDING — when sheets A/B + the fixture mini-sheet are filled, run
> `gh1-compare --seed-batch phase3-tone-core`; failing ANY of band-agreement ≥70% / MAE ≤12 /
> v2 MAE ≤ current ⇒ retune (+ GF/GP re-run) or revert (recipe in the handoff — env flips PLUS
> a redeploy). Links expire 2026-09-09; re-sign BOTH sheets with --resign, NEVER a plain build.
> (2) flip-watch --since 2026-09-03 once ~10 real audio reps land. (3) Phase 5 (Confidence)
> only on my explicit go. (4) Bob demo when I say.
>
> Hard rules that still bite: .env.local IS prod (read-only harness, @cognify.test seeding
> only); branch + PR + /code-review per change, never direct to main; example reps are
> RE-SEEDED, never re-scored — but the flag-off baseline `phase3-tone-core` can NOT be
> re-seeded while the flag is ON, so never delete its batch file; calibration means BOTH
> suites; if a gate fails twice after retuning, STOP and bring me options.
