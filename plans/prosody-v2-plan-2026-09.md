# Prosody v2 — Tone & Pacing from measured audio (plan, 2026-09-01)

> **AMENDED 2026-09-03 (D27) — read before treating §5/§6 as current.**
> 1. **Phase 6 was executed in P5's order, not §5's order:** the flip happened on the green
>    GF+GW+GP+GC gates with Max's explicit go; GH1 is a STANDING post-flip obligation (run
>    `gh1-compare --seed-batch phase3-tone-core` when the sheets are filled; a failed GH1
>    verdict — band agreement <70% OR MAE >12 OR v2 MAE > current — triggers retune + GF/GP
>    re-run, or revert). §6's "done when GH1 passes and the flip survives its watch window"
>    still stands; only the ordering changed.
> 2. **There is no Vercel preview environment in this project** (it was never configured — no
>    DB/keys). "Preview drill"/"preview soak" steps are impossible as written; the equivalent
>    drill runs locally against the prod DB with the revert env (done 2026-09-03, all checks
>    green). Plan future phases without preview steps.
> 3. **The §4 revert recipe's "All env-only; no deploy" is WRONG on the last clause:** Vercel
>    env changes require a redeploy to take effect. Revert = the §4 env flips **then
>    `vercel deploy --prod`**. (The handoff doc and the `prosody-v1-safe-2026-09-02` tag
>    message state it correctly.)

Origin: CTO (Bob) feedback on scoring — "Python + Praat for acoustic analysis, AI for content;
fallback gpt-4o-audio-preview; show something while processing." Decision: **we implement this
ourselves; no Bob round-trips.** Bob has served as the resource; he gets a demo when it works.
Goals (Max): Tone and Pacing don't grade properly today; improve them (and any other dimension
acoustics honestly helps). Hard requirement: **instant revert to the current system.**

## 0. Verdict on the proposal (what the codebase already settled)

| Bob's point | Reality (verified 2026-09-01) |
|---|---|
| Use Python + Praat | Already live: `infra/prosody-worker/` (praat-parselmouth 0.4.5 + ffmpeg, Modal), warmed at upload since PR #100 |
| "Supabase can't handle it" | Moot — compute is Vercel + Modal; Supabase is DB/storage. Supabase Edge Functions are Deno/TS, not Python |
| Fallback: gpt-4o-audio-preview | Refuted **by family inference**, not by direct test: the pre-registered spike (2026-07-16, `plans/prd/grading-v3-design.md` §3.1) tested gpt-audio / gpt-audio-1.5 / gpt-audio-mini — none can discriminate flat vs expressive in text-output mode (tone separation 0); the DSP-block arm separated 25–38 pts and won. gpt-4o-audio-preview itself was not in the spike; it is the pre-GA predecessor of the tested gpt-audio line, so the inference is strong but not empirical. Phase 1 adds a **one-clip smoke** (one flat + one expressive fixture through gpt-4o-audio-preview via the existing spike harness arm config) purely for the record. **Re-probe trigger:** OpenAI ships a new audio-understanding model that works in text-output mode. |
| Show something while processing | Real gap. Today: single skeleton, then everything at once (`RepSurface.tsx` ~1273). Inline metrics (wpm/fillers/pauses) are available at transcript time; worker prosody is usually cached from the upload warm-up. |

So the actual work is NOT "adopt Praat" — it is:
1. **Extraction quality**: the worker's upspeak/monotone/articulation are self-declared coarse
   heuristics ("refine when calibration data lands" — that data now exists as fixtures + packet).
2. **Feature→score mapping**: the deterministic Tone core (`src/lib/scoring/tone-core.ts`) is
   built but OFF in prod (`FF_TONE_PROSODY_CORE`), curves tuned to prompt bands, never validated.
3. **Progressive feedback UX**: un-built.
4. **Proof**: live testing on reps already in the system + controlled example reps at every phase.

## 1. Goals / non-goals

**Goals:** Tone scored from measured audio with validated deterministic core (LLM ±10 narrative
blend); Pacing verified (already a measured function, rubric v4.2.0); measured-delivery panel
shown while grading runs; every step proven against fixtures + in-system reps; env-flag revert.

**Non-goals (explicit):**
- No gpt-4o-audio-preview / audio-in model arm beyond the Phase 1 one-clip smoke (family-refuted;
  see §0 re-probe trigger).
- No Supabase compute changes of any kind.
- No Hume.ai activation (`src/lib/audio/hume-prosody.ts` stays dormant; revisit only if
  expressiveness gates GF fail with DSP features).
- No Pacing rebuild — WS4 sweep showed healthy spread (sd 9.7, range 68–91, n=6); `timeBudgetMs`
  now flows (defaults to `durationMs`). Pacing gets verification only. Revisit rhythm-variation
  sub-signals only if human labels (GH) show pacing misses.
- No absolute-latency workstream beyond the panel. (Citation honesty: 9.3s p50 is the July
  Phase-3.5 *grading* baseline, tracker line ~725; WS8's audio-path readings are 23.3s p50 on
  outage-confounded real reps and 7.1–13.7s on post-fix harness reps — there is no settled
  audio-path p50 yet. GL1 therefore anchors to a fresh baseline the harness measures in Phase 1,
  and WS8 stays its own open item.)
- No changes to the parked grading items (`grading-open-items-2026-09` memory) beyond what §Phase 0
  needs (link re-sign is deadline-forced).

## 2. Design decisions (P-series)

- **P1 — Ship vehicle:** tone-core v2 replaces v1 in place (v1 was never ON in prod; no dual
  code path). The single revert lever stays `FF_TONE_PROSODY_CORE` (OFF ⇒ exact current prod
  behavior: LLM tone from evidence block). Worker v2 deploys as a **separate Modal app**
  (`cognify-prosody-worker-v2`); switching/reverting is a `PROSODY_WORKER_URL` env flip, no deploy.
  **Cache version guard (revert-correctness):** `audio_prosody_cache` is keyed by path only and
  `getCachedProsody` returns `row.features` with no version check — an env flip alone would leave
  already-warmed v2 features serving to the evidence block. Phase 2 therefore adds a guard in
  `getCachedProsody`: rows whose `features.featureVersion` exceeds `PROSODY_FEATURE_VERSION_MAX`
  (env, default unlimited) are treated as a miss → in-request worker fallback. Revert stays
  env-only: URL flip + `PROSODY_FEATURE_VERSION_MAX=1`.
- **P2 — Worker contract v2 is additive + self-versioned:** response JSON gains
  `featureVersion: 2`, `finalFallRatio` (nullable), and **`segmentTails`**: per voiced-segment
  `{endMs, tailSlopeHzPerSec}` for silence-bounded segments (compact; ≤~60 entries at the 180s
  cap). `monotoneRatio` becomes truly windowed (sliding ~1s pitch-std windows, ratio below
  1.5 st) — matching its documented meaning instead of being a pure function of global std.
  **Alignment happens Node-side at scoring time, not in the worker:** the upload-time warm runs in
  parallel with transcription (`/api/upload` `after()` vs `/api/transcribe` — no transcript exists
  at warm time), so the worker CANNOT receive statement ends. Instead, the scorer intersects the
  cached `segmentTails` with statement-end timestamps derived from Deepgram punctuated word
  timings to compute `upspeakRatioAligned` (and `finalFallRatio` aligned) in TS — unit-testable,
  no second worker call, no warm reordering, no GL1 impact. The worker's silence-heuristic
  `upspeakRatio` remains as the fallback when word timings are absent. Version travels **inside
  the features JSONB** — no DB migration, `audio_prosody_cache` schema untouched; old cached rows
  stay v1 (their reps are already scored), new warms produce v2 (read subject to the P1 version
  guard).
- **P3 — Tone core v2 mapping:** windowed monotone becomes an independent signal alongside pitch
  std (today it's redundant by construction); upspeak uses the aligned ratio; articulation weight
  halved pending validation (crude high-freq proxy). Curves retuned so the 15 PSOLA fixtures
  separate cleanly (GF gates). Keep `blendToneWithModel` ±10 and `buildToneFeedback` divergence
  swap unchanged.
- **P4 — Progressive panel:** new flag `FF_LIVE_REP_METRICS` (defaultOnOutsideProduction). At
  transcript-ready, the grading skeleton shows a "Measured delivery" strip: pace vs 130–165 band,
  fillers/min, pauses, and pitch variety when the warm cache resolves. Display-only, zero
  scoring-path changes ⇒ no calibration impact. Copy rules apply (plain language, no em-dashes).
- **P5 — Evidence ladder for the prod flip:** fixtures (ground truth by construction) → in-system
  reps (distribution + plausibility) → human labels (agreement). Flip for beta after GF+GW+GP+GC
  pass; GH validates/retunes when the sheets are filled — beta traffic itself then feeds WS5's
  ≥30-audio-reps gate.
- **P6 — Calibration guardrail scoping:** `FF_TONE_PROSODY_CORE` is post-processing only
  (`score-shared.ts` ~1968) — no prompt bytes. But worker v2 changes the *values* rendered by
  `renderProsodyBlock` for any rep re-warmed under v2 ⇒ reference-rep prompts change bytes ⇒
  **calibration re-run is mandatory in Phase 2 and again at Phase 6 flip**, with tracker notes.
  Note the calibration suite is TWO runs: `calibrate-scoring.mjs` excludes `kind="audio-tone"`
  reps and delegates them to `scripts/calibrate-audio-tone.mjs` (local HTTP, `npm run dev`) —
  worker v2 changes hit exactly that audio-tone bank, so BOTH must run, and the audio-tone
  expectations may need re-promotion via `scripts/calibration/promote-audio-reps.mjs` (its
  assertions are relative, per `reauthor-expectations.mjs`, but verify rather than assume).
- **P7 — Confidence (stretch, opt-in):** the only other dimension acoustics honestly helps
  (vocal steadiness via rmsStd, finalFallRatio). Parked as Phase 5, only after GH, and only with
  Max's go — it adds prompt bytes (evidence lines) and therefore a calibration cycle.
- **P8 — Prod DB discipline:** `.env.local` IS prod. All harness scripts are read-only SELECTs +
  signed-URL reads, following `scripts/qa/grading-audit/` conventions (db.mjs reuse, masked
  emails, gitignored `out/`, windows anchored to newest rep). Example reps are created only under
  a `@cognify.test` account (excluded by the established real-rep filters). No rep row is ever
  mutated by tooling.

## 3. Test assets ("live testing along the way")

1. **Fixtures (ground truth):** `tests/fixtures/audio-grading/` — 15 clips, 5 scripts × {flat,
   expressive, rushed}; flat are PSOLA pitch-flattened (pitchStd 0.07–0.25) with identical
   words/voice. `features.json` + `scripts/spike-validate-fixtures.py` already exist.
2. **In-system reps:** all prod reps with `audio_path` (tiny today: ~6 real reps / 2 users as of
   the 08-30 sweep; harness re-inventories at run time) + the 11 audio reps in the human packet +
   whatever beta lands mid-build. Read-only.
3. **Example reps in the real system:** Phase 1 seeds the 15 fixture clips through the real
   upload → warm → score path under a `@cognify.test` account (reuse the existing post-warm-up-fix
   harness pattern that produced "harness reps grade from audio 5/5"; builder locates it in
   scripts/ or e2e). These reps are **RE-SEEDED (fresh upload → new audio path → fresh warm under
   the currently-serving worker), not merely re-scored**, at the end of EVERY phase — re-scoring
   alone would replay stale v1 cache rows (`getCachedProsody` is hit-or-null; it never
   re-extracts) and silently validate old features. `seed-example-reps.mjs` is therefore
   idempotent-by-tag and re-runnable; each phase's verify compares the NEW seed batch. Max can
   add self-recorded reps to the same account any time.
4. **Human labels:** the 60-rep packet (`plans/calibration/human-labeling-2026-09/`, sheets A/B
   0/60, links expire ~09-04) + a new tone-only mini-sheet for the 15 fixtures (Max + Owen,
   ~15 min each) so tone has >11 human points early. **Re-sign caveat:** `build-packet.mjs` has
   NO re-sign-only mode today — every run re-queries live reps, recomputes strata, re-runs the
   seeded shuffle, and rewrites the sheets, so running it near the deadline would silently
   resample (new reps shift the seeded PRNG's input). Phase 0 BUILDS a `--resign` mode that
   reads the frozen `sample.json` and refreshes signed URLs only, verified by byte-comparing
   sample + sheets before/after (URLs excepted).

## 4. Gates (pre-registered; numbers before code)

| Gate | Measure | Pass |
|---|---|---|
| GW1 | Worker v2 feature availability on same audio set vs v1 | no regression (every rep with v1 pitch has v2 pitch) |
| GW2 | Windowed monotoneRatio on fixtures | flat ≥0.9; expressive ≤0.3 |
| GW3 | Aligned upspeakRatio sanity on declarative fixture scripts | ≤0.25 (log-only if TTS artifacts make it flaky — then keep but down-weight in core) |
| GF1 | tone-core v2 on fixtures | flat ≤45, expressive ≥65, pairwise separation ≥25 on 5/5 pairs |
| GF2 | No content-dim movement from prosody changes. **Runs FIRST in Phase 2 on audio-carrying reps, BEFORE the prod URL flip** (the worker-v2 value change is the real content-dim risk — the Phase 3 tone core is post-processing and cannot move content dims), re-checked in Phase 3 | calibration bank: clarity/structure/relevance/thinking deltas within the ±15 per-dim noise floor |
| GP1 | Tone distribution over in-system audio reps (example + real) | sd ≥8; no single value >40% of reps |
| GL1 | Warm-path scoring latency | ≤ +200ms p50 vs the audio-path baseline the harness measures in Phase 1 (no settled WS8 p50 exists — see §1 non-goals); panel visible <2s after transcript in e2e |
| GC1 | Calibration after worker v2 and again at flip: BOTH `calibrate-scoring.mjs` AND `scripts/calibrate-audio-tone.mjs` (see P6) | green, or diffs explained + bank/tracker note |
| GH1 | vs human tone labels (11 packet audio reps + 15 fixture labels; grows with beta) | band agreement ≥70% AND MAE ≤12 AND v2 MAE ≤ current-pipeline MAE |

Revert drill (rehearsed in Phase 6, documented in tracker): `FF_TONE_PROSODY_CORE` unset/false +
`PROSODY_WORKER_URL` → v1 URL + `PROSODY_FEATURE_VERSION_MAX=1` (P1 cache guard — without it,
already-warmed v2 rows keep serving v2 features) + `FF_LIVE_REP_METRICS` unset. All env-only; no
deploy. Drill verify: a rep warmed under v2 re-scores with v1 features after the flip.

## 5. Phases (branch per phase; PR + /code-review + tracker entry each; never direct to main)

**Phase 0 — Yardsticks secured** (`chore/labeling-packet-resign`) — DEADLINE-BOUND (~09-04)
**Build a `--resign` mode for `build-packet.mjs` first** (none exists — a plain run re-queries
live reps and re-runs the seeded shuffle, silently resampling; see §3.4): read the frozen
`sample.json`, refresh signed URLs only, touch nothing else. Then re-sign the packet links with
it. Build the 15-fixture tone-only mini-sheet (clip link, tone 0–100, one-word rationale). Ping
Max: sheets A/B + mini-sheet are the GH fuel; Max + Owen fill in parallel — nothing else blocks
on them until Phase 6.
*Verify:* links open; mini-sheet renders; byte-compare of `sample.json` + sheets before/after
shows URLs as the only diff.

**Phase 1 — Harness + baseline** (`feat/prosody-qa-harness`)
`scripts/qa/prosody-v2/`: `inventory.mjs` (read-only counts: audio reps, cache statuses, users),
`extract-compare.mjs` (per rep: sign URL, call worker(s), diff features), `score-compare.mjs`
(tone-core variants vs stored LLM tone; distribution stats), `fixtures-run.mjs` (assert against
`features.json` ground truth), `seed-example-reps.mjs` (fixtures → real upload/score path,
`@cognify.test`). Snapshot BASELINE: v1 features + current tone scores + audio-path scoring
latency p50/p90 (the GL1 anchor) for fixtures, example reps, real reps →
`out/baseline-2026-09.json` (gitignored) + summary table in tracker. Also: the §0 one-clip
gpt-4o-audio-preview smoke (one flat + one expressive fixture; record verdict in tracker, then
that thread is closed).
*Verify:* baseline table exists (features + latency); smoke recorded; example reps visible in
product UI with scores; zero writes to non-test rows.

**Phase 2 — Worker v2** (`feat/prosody-worker-v2`)
Implement P2 in `infra/prosody-worker/` (versioned: keep v1 deployable): windowed monotone,
`segmentTails`, `finalFallRatio`, `featureVersion: 2`. Node side: (a) the P1 cache version guard
in `getCachedProsody` (`PROSODY_FEATURE_VERSION_MAX`); (b) scoring-time alignment in TS —
statement ends from Deepgram punctuated word timings ∩ cached `segmentTails` →
`upspeakRatioAligned` / aligned `finalFallRatio` (unit-tested; the warm path is untouched and
never sees a transcript). Deploy side-by-side Modal app; point ONLY the harness at v2 first.
Gates GW1–GW3 via `extract-compare.mjs` on fixtures + all in-system audio reps, **then GF2 on
audio-carrying reps and GC1 (BOTH `calibrate-scoring.mjs` AND `calibrate-audio-tone.mjs`, P6) —
all BEFORE any prod flip**. Only after GW+GF2+GC1 pass: flip `PROSODY_WORKER_URL` in preview/dev,
soak, then prod (with `FF_TONE_PROSODY_CORE` OFF the user-visible risk is bounded to the LLM
reading changed evidence values — exactly what GF2/GC1 measured).
*Verify:* GW + GF2 gate tables in tracker; both calibration runs noted; re-seeded example rep
smoke in prod (`graded_from_audio` true, `featureVersion` 2 in cache, prosody_ms sane); revert
lever spot-check (`PROSODY_FEATURE_VERSION_MAX=1` locally forces v1-style fallback).

**Phase 3 — Tone core v2** (`feat/tone-core-v2`)
Implement P3 in `tone-core.ts` + unit tests using fixture-derived feature vectors (committed as
JSON fixtures, not audio). Gates GF1/GF2/GP1 via harness; iterate curves until green. Dev/preview
have the flag ON by default — exercise in-product with example reps.
*Verify:* GF/GP tables in tracker; unit suite green; example reps' tone in UI matches intent
(flat reads low with the measured narrative, expressive reads high).

**Phase 4 — Measured-delivery panel** (`feat/live-rep-metrics`)
P4: flag, panel in the grading skeleton (`RepSurface.tsx`), inline metrics at transcript-ready,
pitch variety when warm cache resolves (poll the existing cache read; no new endpoint unless
trivial). E2e: extend skill-lab-loop to assert panel-before-scores. GL1.
*Verify:* e2e green; panel copy passes the plain-language rule; flag OFF ⇒ pixel-identical to today.

**Phase 5 — Confidence assist (OPTIONAL, needs Max's explicit go, after GH)** — see P7.

**Phase 6 — Validation + prod flip** (`feat/prosody-v2-flip`)
When sheets land: score-compare vs human labels → GH1 table; retune curves if MAE fails (then
re-run GF/GP). Rollback drill in preview. Prod: `FF_TONE_PROSODY_CORE=true` +
`FF_LIVE_REP_METRICS=true` (beware the trailing-newline env gotcha; verify with `vercel env pull`
+ grep, smoke a flag-dependent surface). Calibration re-run (both suites) + tracker. Watch:
first N beta audio reps — tone spread, `graded_from_audio` rate, anthropic-fallback share,
warm-hit rate. **Record a decision-log entry in the tracker** (next free D number) noting the
tone mechanism now supersedes D22's literal text: tone is scored by a measured deterministic core
with LLM ±10 narrative blend, still "graded from audio" in D22's spirit — CLAUDE.md requires the
supersession recorded, not built past.
*Verify:* GH table; flip + drill logged in tracker; decision entry recorded; Max gets a concrete
verify checklist; THEN the Bob demo/brief (after it demonstrably works).

## 6. Progress tracking

Every phase ends with: (a) its gate table appended to `plans/system-change-v2-progress.md`,
(b) the example reps RE-SEEDED end-to-end (fresh upload + warm, see §3.3) and eyeballed in the
UI, (c) an explicit
"Next:" line. The plan is done when GH1 passes and the flip has survived its watch window —
or when a gate fails twice after retuning, in which case STOP, write up which gate and why, and
bring Max options (that is the revert-and-rethink point, not a reason to force curves).

## 7. Handoff prompt (start of the build session)

> We're executing `plans/prosody-v2-plan-2026-09.md` — read it in full before doing anything; it
> is the contract. Decisions P1–P8 and the gate numbers are settled; don't relitigate them.
> Memory gives you the background (prosody-praat-exploration-2026-09, env-local-is-prod-db).
> Token cost is not a constraint; I want this done properly, not cheaply.
>
> One-line context: Bob's Praat proposal resolved into — worker v2 extraction (windowed monotone,
> `segmentTails` for Node-side aligned upspeak), validated deterministic tone-core v2 behind
> `FF_TONE_PROSODY_CORE`, measured-delivery panel behind `FF_LIVE_REP_METRICS`, proven on
> fixtures + in-system reps at every phase, env-only revert including the
> `PROSODY_FEATURE_VERSION_MAX` cache guard. No Bob round-trips; he gets a demo when it works.
>
> Start with Phase 0 TODAY: the labeling-packet links expire ~09-04 and `build-packet.mjs` has
> NO re-sign mode — build `--resign` first (frozen `sample.json`; byte-compare shows URLs as the
> only diff), then re-sign, then the fixture mini-sheet, then remind me + Owen. Then Phase 1.
>
> Hard rules (from the plan's §2/§5, repeated because they bite): `.env.local` is the PROD DB —
> harness scripts read-only, seeding only under `@cognify.test`; branch + PR + /code-review per
> phase, never direct to main; calibration means BOTH `calibrate-scoring.mjs` AND
> `scripts/calibrate-audio-tone.mjs`; GF2 + GC1 pass BEFORE the Phase 2 prod URL flip; example
> reps are RE-SEEDED (fresh upload), never just re-scored; every phase ends with its gate table
> in the tracker and a "Next:" line; Phase 5 (Confidence) needs my explicit go.
>
> If any gate fails twice after retuning: STOP, write up which gate and why, bring me options.
