# Cognify prosody worker

Standalone HTTP service that extracts pitch / volume / inflection /
monotone / articulation features from a rep's audio file. Called by the
Cognify Next.js app via `src/lib/audio/prosody-worker.ts`.

The Node app talks to this worker over a tiny HTTP contract:

```
POST /
Content-Type: application/json
[Authorization: Bearer <PROSODY_WORKER_TOKEN>]   # optional

{ "audioUrl": "<signed Supabase URL>", "durationMs": 45000 }

→ 200
{
  "pitchMeanHz":          float | null,
  "pitchStdSemitones":    float | null,
  "pitchRangeSemitones":  float | null,
  "monotoneRatio":        float in [0,1] | null,
  "upspeakRatio":         float in [0,1] | null,
  "rmsMean":              float | null,
  "rmsStd":               float | null,
  "articulationScore":    float in [0,1] | null
}
```

ALL fields nullable so the worker can return partial results. The Node
side treats null as "no signal here" and falls back to LLM-only Tone
scoring with `prosodyAvailable: false`.

## Deploy targets

### Recommended: Modal

```bash
pip install modal
modal token new                              # one-time auth
modal deploy infra/prosody-worker/modal_app.py
```

Modal prints the public web URL (e.g.
`https://your-workspace--cognify-prosody-worker-fastapi-app.modal.run`).
Set in Cognify env:

```
PROSODY_WORKER_URL=<modal url>
PROSODY_WORKER_TOKEN=<random secret — also set in Modal env>
FF_PROSODY_WORKER=true
```

Why Modal first: `parselmouth` + `ffmpeg` install cleanly via apt+pip,
free tier covers reasonable Cognify usage, cold start with image
snapshotting is ~1-2s, no DNS/TLS to manage.

### Alternative: fly.io

```bash
fly launch --dockerfile infra/prosody-worker/Dockerfile
fly secrets set PROSODY_WORKER_TOKEN=<secret>
fly deploy
```

### Alternative: Vercel Python Functions

Move `main.py` to `api/prosody.py` and add to `vercel.json`:

```json
{
  "functions": {
    "api/prosody.py": { "runtime": "@vercel/python@4", "memory": 1024 }
  }
}
```

Caveat: Vercel Python Functions have stricter binary-deps support.
parselmouth (a CPython extension) usually works but ffmpeg must be
shipped via the build step. Test locally with `vercel dev` before
deploying. Cold starts on Vercel Python are noticeably worse than on
Modal because there's no warm-pool option.

### Alternative: Replicate

Wrap `main.py`'s analyze function in a `cog.predict()` and push:

```bash
cog push r8.im/<your-user>/cognify-prosody
```

Then point `PROSODY_WORKER_URL` at the Replicate prediction endpoint.
Replicate's pricing model is per-prediction; budget against expected
rep volume.

### Self-hosted

```bash
docker build -t cognify-prosody infra/prosody-worker
docker run -p 8080:8080 -e PROSODY_WORKER_TOKEN=secret cognify-prosody
```

Behind any reverse proxy that terminates TLS (Caddy / nginx / Traefik).

## Local development

```bash
cd infra/prosody-worker
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Test:

```bash
curl -X POST http://localhost:8080/ \
  -H 'content-type: application/json' \
  -d '{"audioUrl": "https://...", "durationMs": 45000}'
```

For the Node app to talk to a local worker, set:

```
PROSODY_WORKER_URL=http://localhost:8080
FF_PROSODY_WORKER=true
```

## Failure semantics

The Node client (`src/lib/audio/prosody-worker.ts`) treats every
abnormal condition as "no worker data" — score path NEVER fails because
of worker issues:

- 5s timeout (default; configurable via `extractWorkerProsody({ timeoutMs })`)
- Non-2xx HTTP response → ignored
- Malformed payload (Zod schema rejects) → ignored
- Network error / DNS failure → ignored
- `FF_PROSODY_WORKER` unset or `PROSODY_WORKER_URL` unset → call skipped

When the worker returns null fields (e.g. parselmouth couldn't track
pitch on silence), the Node side merges what's there and leaves the
rest null. UI shows a low-confidence Tone badge when key fields are
missing (Ch.6 surface).

## Tuning notes

- `min_containers=1` in `modal_app.py` keeps one warm instance to keep
  p99 under 5s. Drop to 0 to save free-tier budget at the cost of
  occasional cold-start timeouts.
- `MAX_DURATION_MS=180000` caps a single request at 3min of audio.
  Cognify reps are <60s in practice; bump if you start serving longer
  formats.
- Articulation is a coarse high-band-energy heuristic. Replace with a
  forced-alignment-based score when calibration data shows the heuristic
  is misleading.
- Upspeak detection uses silence-bounded segments as a sentence-boundary
  proxy. Production-grade upspeak needs forced alignment to actual
  transcript sentence boundaries — TODO when calibration shows the proxy
  underperforms.
