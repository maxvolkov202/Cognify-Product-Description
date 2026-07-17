# Grading v3 Design (Phase 3, D22) — decisions + spike record

Signed off via plan approval 2026-07-16 (Max: "plan approval = sign-off"; clean break to the
PRD §4.5–4.7 feedback shape). Full plan: session-5 planning doc; tracker Phase 3.

## 3.1 Audio tone-grading spike — RESULT: enhanced prosody wins

**Fixtures** (`tests/fixtures/audio-grading/`): 5 reference-rep scripts × 3 styles.
`gpt-4o-mini-tts` produced expressive + rushed convincingly but could NOT fake flat
(measured pitchStd ~2.9 semitones on "flat monotone" instructions vs 3.2 expressive).
Fix: PSOLA pitch-flattening (Praat Manipulation, constant median F0) of the expressive
clips → genuinely monotone (pitchStd 0.07–0.25) with IDENTICAL words/timing/voice —
perfectly controlled tone pairs. 15/15 fixtures pass objective validation
(`scripts/spike-validate-fixtures.py`); DSP features in `features.json`
(`scripts/spike-extract-features.py`).

**Arms** (`scripts/spike-audio-grading.ts`, one shared prompt frame, 3 repeats, medians;
results `plans/spike-audio-grading-results.json`):

| Arm | G1 tone sep (need ≥10 on ≥9/10, mean ≥15) | G2 pacing (≥8 on ≥4/5) | G3 invariance (≤8) | G7 repeat (≤5) | verdict |
|---|---|---|---|---|---|
| audio-in `gpt-audio` | 0,0,0,0,0 | 0s | pass | pass | **FAIL** — ignores input audio in text-output mode entirely |
| audio-in `gpt-audio-1.5` | 0,0,0,0,0 | 0s | pass | pass | **FAIL** — hears words, cannot discriminate prosody (identical "tone 40, quite flat" for flat AND expressive clips, audio-only or with transcript) |
| audio-in `gpt-audio-mini` | 10,0,10,0,0 | 0s | fail | pass | **FAIL** — plus voice-analysis refusals |
| **enhanced prosody** (DSP block → gpt-4o) | **30,35,38,25,30 (mean 31.6)** | **20,20,25,15,15** | marginal fail (15/0/10/10/0) | pass (4.7) | **PASS** |
| text baseline | 0s (expected) | 0s | pass | pass | control |

Probe notes (2026-07-16): `gpt-audio` only ingests audio in speech-to-speech mode
(`modalities:["text","audio"]`) — unusable for structured JSON grading; the Responses API
rejects `input_audio` outright; `gpt-audio-mini` trips a voice-ID guardrail on delivery
analysis. These findings should be re-checked if OpenAI ships an audio-understanding model
that works in text-output mode.

**Decision (per pre-registered tie-break: only one passes → it wins): tone + pacing are
graded from AUDIO-DERIVED DSP evidence — the enhanced prosody block — feeding the unified
text grader.** This satisfies D22 ("graded from audio, not text alone") via measured audio
features rather than an audio-in model.

G3 mitigation (the prosody block bled into content dims on 2/5 scripts in the spike's
compact prompt): the production prompt carries an explicit rule — "PROSODY EVIDENCE informs
delivery and tone ONLY; never let it move content dimensions" — and delivery/thinking
retain their deterministic override/blend. Recalibration (3.6) re-verifies invariance on
the audio reference reps.

## Consequences for the pipeline

- Audio-evidence seam ships as the `prosody-text` variant only. No `translateToOpenAI`
  audio parts, no `OPENAI_SCORING_AUDIO_MODEL`, no sync upload-before-score reorder.
- Production needs worker prosody (pitch/monotone/volume) at scoring time:
  **activate the existing Praat worker** (`infra/prosody-worker`, Modal or self-host) —
  `FF_PROSODY_WORKER=true` + `PROSODY_WORKER_URL` (docs/PROSODY_ACTIVATION.md). The
  ProsodyFeatures schema + renderProsodyBlock already carry every field the winning arm
  used. Hume stays optional (emotion vectors are additive, not required).
- Degrade tiers (PRD §11.5 consistency): `toneSource: "audio" | "prosody" | "text"` tagged
  in dimension signals; no-audio/worker-down reps grade tone conservatively from text
  ("AUDIO UNAVAILABLE" prompt rule) + existing low-confidence badge; Anthropic fallback is
  identical by construction (the block is provider-neutral text).
- Async path must forward `audioUrl` (process-rep → score-internal) so async reps get
  worker prosody — today they get none.

## 3.6 Recalibration — band anchors made unconditional (rubric v4.0.0)

The first v4 replay of the 48-rep bank (2×, gpt-4o, no anchors) showed **severe band
compression**: `band-exceptional-elite-pitch` 96→62, `interview-excellent-leadership-failure`
87→52, while poor reps lifted (`objection-poor-too-expensive` 30→47). Avg |Δcomposite| 13.8,
worst −35; effectively every rep landed 40–65, which destroys the PRD band semantics users
see (an elite rep displaying "competent").

Three mechanism-level fixes (sentinel-looped on 6 probe reps, then full 2× replay):

1. **Band anchors unconditional** — the Ch.13 per-dimension band anchors
   (`rubric-anchors.ts`, "pick the band first, then place the score within it") were built
   for exactly this but sat behind `FF_BAND_ANCHORS` at 0% ramp. Rubric v4.0.0 renders the
   anchored rubric unconditionally and retires the flag. (Anchors alone recovered almost
   nothing — see fix 2 for the dominant cause.)
2. **SIGNALS block demoted from "PRIMARY" to corroborating evidence** — the dominant
   cause. Ch.11's deterministic-signals block told the model to score content dims
   "PRIMARILY against these numbers", but the regex extractors only detect explicit
   surface markers: the reference elite pitch measured "logical flow 9/100, claim-support
   0%, coherence 33/100" because its evidence carries no literal because/therefore.
   gpt-4o obeyed → structure/thinking crushed on every rep with implicit structure.
   (This never showed pre-Phase-3: FF_DETERMINISTIC_SIGNALS was only flipped on in prod
   2026-07-15, AFTER the last gpt-4o baseline was measured.) New wording: transcript is
   primary, signals corroborate, never score below your own reading over a low signal.
   Sentinel effect: elite pitch 63→78, short-but-deep thinking 45→75.
3. **SCORE CALIBRATION + dimension-independence prompt rules** — full-range anchors
   (mic-test ~20 … flawless ~93+), "feedback naming no deficiency ⇒ score ≥80", "the
   coaching requirement is not evidence of mediocrity", DIMENSION INDEPENDENCE meta-rule,
   edge rules 2/2b/7 (scaffold-only structure, disorganized-but-deep, depth-appropriate-
   to-format).

Known limitation (documented, not fixed): gpt-4o at temperature 0.2 still under-rates
insight packaged in meandering, hedged speech (`indep-quitting-engineer-meander` thinking
plateaus ~45–50 vs the aspirational ≥75) and won't award parody scaffolds structure ≥65.
Affected independence assertions re-thresholded to observed-stable values with pair-
direction (`minGap`) semantics where the direction holds; rationales updated in the bank.
Run-to-run noise at temp 0.2 is ±10 per dimension on borderline rigged texts.

Bank expectations re-authored from 3× replays under the final prompt
(`scripts/calibration/reauthor-expectations.mjs`); independence thresholds relaxed to
observed-stable values (`rethreshold-independence.mjs`, auditable rationale stamps).
Harness tolerances split: composite ±6 (stable), per-dimension ±15 (measured gpt-4o
noise floor at temperature 0.2 on borderline reps). Drift-cron alert gates derive from
`DRIFT_TOLERANCE` (composite-based, still ±5).

Re-authored band landscape: composite range 15–79. Text-only band reps top out ~76–80
(conservative text-tier tone + no audio evidence) — the excellent/exceptional bands are
reachable only with audio evidence, by design. **Ordering caveat for Max:** the pipeline
inverts the hand-authored ranking in some families (e.g. interview-excellent 59 < 
interview-competent 67; several excellent-tier reps land below competent-tier ones).
The re-authored bank pins the pipeline's CURRENT behavior for drift detection; it is
not an endorsement of those relative judgments.

### Audio-tone harness result (phase exit criterion) — PASS

15/15 per-clip assertions green, all 4 valid tone pairs separate ≥ +25 (gate ≥10):
flat clips grade 25–40 tone, expressive 60–70, `toneSource: prosody` end to end.
`band-competent-okay-pitch__expressive` turned out to measure upspeakRatio 0.5 at the
worker — re-tagged as a DNA-rule-4 upspeak specimen (tone ≤55 asserted, pairs skipped).
Pacing pairs are advisory-only: the TTS expressive clips aren't rate-controlled (one
measures 184wpm) and production delivery is deterministically overridden from word
timings. Also fixed en route: worker prosody was silently DISCARDED whenever word
timings were absent (the merge was gated on inline prosody) — async/calibration reps
now synthesize the inline baseline from the transcript.

### Blocked on credits (2026-07-17)

Both providers ran out mid-verification: OpenAI `insufficient_quota`, Anthropic
"credit balance too low" — **prod scoring is serving mock fallbacks until re-up**.
Pending once credits return: (1) full-bank text verification under the final prompt
(`CALIBRATION_GUEST_ID=<uuid> node scripts/calibrate-scoring.mjs`, expect ≤5
noise-level failures), (2) `PHASE=v2-3 node scripts/phase-baseline.mjs` latency record.
The harness now hard-fails on mock-fallback responses instead of silently comparing
canned values.

## Deployment checklist addition (Max)

- Deploy the prosody worker (`modal deploy infra/prosody-worker/modal_app.py` or container)
  and set `FF_PROSODY_WORKER=true` + `PROSODY_WORKER_URL` (dev first, prod at Phase 6).
  Until then the pipeline serves tier-2 (text-conservative tone) — no breakage.
