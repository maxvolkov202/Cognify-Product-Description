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

## Deployment checklist addition (Max)

- Deploy the prosody worker (`modal deploy infra/prosody-worker/modal_app.py` or container)
  and set `FF_PROSODY_WORKER=true` + `PROSODY_WORKER_URL` (dev first, prod at Phase 6).
  Until then the pipeline serves tier-2 (text-conservative tone) — no breakage.
