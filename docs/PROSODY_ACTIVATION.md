# Prosody Activation — Cognify Tone Calibration

> Ch.S5 of the DNA base-layer expansion plan.

Cognify's Tone scoring is calibration-blind on text-only reps — without
audio, the LLM scores Tone by guessing at vocal characteristics from
the transcript, which the post-D2 baseline showed is unreliable
(±15-30pt swings).

Ch.S5 wires a real prosody worker so Tone scores ground in measurable
audio features. Two providers are supported:

## Provider A — Hume.ai (recommended for production)

Hume's Expression Measurement API outputs 48-dimensional emotion vectors
per utterance window. Battle-tested commercial service with 99.9%
uptime and ~$0.0005-0.005/rep cost.

**Activation steps:**

1. **Get a Hume API key.** Sign up at <https://platform.hume.ai>;
   their `Expression Measurement` product is what we use.

2. **Set the env var locally:**
   ```powershell
   # Add to .env.local
   FF_PROSODY_WORKER=true
   HUME_API_KEY=hume_<your-key>
   ```

3. **Set the env var in Vercel prod:**
   ```powershell
   npx vercel env add HUME_API_KEY production
   npx vercel env add FF_PROSODY_WORKER production  # value: true
   ```

4. **Verify locally before flipping prod.** Restart `npm run dev` so
   the new env vars load, then upload a short audio clip via
   `/ops/reference-bank` and run:
   ```powershell
   npx tsx scripts/calibrate-prosody.ts --rep <rep-id>
   ```
   Expected output: a JSON result with `prosodyProvider: "hume.ai"`
   and per-Tone-sub-skill scores keyed by emotion vector.

5. **Calibrate against the reference bank.** Upload audio for ≥12
   reference reps via `/ops/reference-bank`, then run:
   ```powershell
   npx tsx scripts/calibrate-prosody.ts
   ```
   Acceptance gate: ≥80% of audio reps have all 6 Tone sub-skills
   within ±10 of expectation. Script exits 0 if gate met, 1 otherwise.

## Provider B — Self-hosted Praat worker (alternative)

If you'd rather not depend on Hume, the original `Ch.3b` stub at
`src/lib/audio/prosody-worker.ts` already supports a self-hosted
Python service. Deploy `infra/prosody-worker/` (or equivalent) on
Fly.io / Railway / etc., then:

```powershell
# .env.local OR Vercel env
FF_PROSODY_WORKER=true
PROSODY_WORKER_URL=https://your-worker.example.com/analyze
PROSODY_WORKER_TOKEN=<bearer-token-if-required>
# Do NOT set HUME_API_KEY when using this path — Hume takes precedence.
```

The worker must accept `POST { audioUrl: string, durationMs: number }`
and return JSON matching the `workerResponseSchema` in
`src/lib/audio/prosody-worker.ts` (pitchMeanHz, pitchStdSemitones,
pitchRangeSemitones, monotoneRatio, upspeakRatio, rmsMean, rmsStd,
articulationScore — all numbers or null).

The Praat path produces RAW DSP fields (the schema's classic fields).
The Hume path produces emotion vectors + leaves classic fields null.
Either populates `ProsodyFeatures.prosodyProvider` for downstream
disambiguation.

## Tone sub-skill mapping

When the Hume path is active, the 6 Tone sub-skills are derived from
emotion vectors as documented in
`src/lib/scoring/signals/sub-skill-mapper.ts`:

| Sub-skill | Hume signal |
|-----------|-------------|
| `pitch_variation` | variance(Excitement + Determination + Joy) |
| `volume_control` | 1 − (Anxiety + Distress) means |
| `downward_inflection` | 1 − (Doubt + Confusion) means |
| `emotional_authenticity` | (Calmness + Contentment + Joy) − (Awkwardness + Embarrassment) |
| `vocal_presence` | Determination + Pride + Triumph means |
| `warmth` | Calmness + Contentment + Sympathy + Love means |

These mappings are heuristic but defensible — Hume's emotion outputs
are calibrated proxies for the underlying acoustic features (e.g. high
Excitement variance correlates strongly with pitch-and-energy variance
in Hume's published validation sets).

## Failure modes

All paths degrade gracefully (score path NEVER fails because of
prosody issues):

- `FF_PROSODY_WORKER` unset → return null → Tone scores fall through
  to `dimension_fallback` (existing behavior).
- `HUME_API_KEY` and `PROSODY_WORKER_URL` both unset → log warning,
  return null.
- Hume job submit / poll / predictions fetch fails → log warning,
  return null.
- Hume timeout (default 60s) → log warning, return null.

When prosody is null, the SIGNALS prompt block surfaces:
```
[PROSODY WORKER OFFLINE — pitch/volume/inflection unavailable;
 Tone score derived from text + inline metrics only]
```

## Cost estimate

Hume Expression Measurement (Prosody model) — approximate at typical
Cognify rep volumes:

| Reps/month | Avg duration | Hume cost (Prosody) |
|-----------:|-------------:|-------------------:|
| 1,000      | 30s          | $0.50–$2.50        |
| 10,000     | 30s          | $5–$25             |
| 100,000    | 30s          | $50–$250           |

Updated costs at <https://platform.hume.ai/pricing>.

## When to call this calibration "done"

Per the Ch.S5 acceptance gate:

- ≥12 reference reps have audio uploaded via D3.
- `npx tsx scripts/calibrate-prosody.ts` returns exit 0 (≥80% reps
  with all 6 Tone sub-skills within ±10 of expectation).
- One end-to-end smoke rep through prod with audio shows tone scoring
  variance (no longer everyone-gets-72).
- 24-hour soak: monitor `/ops/calibration` for any regression in
  composite drift compared to the post-S4 baseline.

If gate fails, options:
- Re-tune the emotion → sub-skill anchor curves in
  `sub-skill-mapper.ts` (HUME_VARIANCE_TO_PITCH_VARIATION et al).
- Add expected `subSkills` scores to a few reference reps to give
  the harness clearer targets.
- Switch to Provider B (Praat) if Hume's emotion-derived signals
  prove insufficient for the calibration math.
