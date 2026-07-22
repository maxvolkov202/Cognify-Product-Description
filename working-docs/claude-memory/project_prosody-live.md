---
name: project_prosody-live
description: Prosody audio-tone grading is LIVE on prod (Modal Praat worker) as of 2026-07-20
metadata: 
  node_type: memory
  type: project
  originSessionId: 31ae1c5e-295a-4ad7-93e6-66e7a60cc69a
---

Audio **tone grading via prosody is LIVE in prod** (`cognify-v2-neon.vercel.app`) as of 2026-07-20.
Prod tone reacts to real delivery for **mp3/wav**: expressive clip → tone 65, flat clip → tone 35
(`toneSource: prosody`).

**🔴 KNOWN BUG (found 2026-07-20 verification): the worker CANNOT decode real browser WebM/Opus**
— the actual prod recording format (`capture.ts:24` prefers `audio/webm;codecs=opus`). `main.py` calls
`parselmouth.Sound()` directly; Praat has no WebM/Matroska reader, so it throws → returns all-nulls →
Node degrades tone to the text tier (`toneSource: text`). Verified 3 ways: local parselmouth
(`PraatError: Not an audio file`), live Modal worker (all-null), full prod `/api/score` with webm
attached (`[toneSource: text]`, non-mock). So **prosody is effectively inert for REAL reps** — it only
worked in tests because the calibration bank is mp3/wav. Every prior test passed for this reason.
**Fix:** transcode webm→wav with ffmpeg (already in the Modal image) in `main.py` before
`parselmouth.Sound()`, then `modal deploy` + re-run the webm test. Worker-only change; no calibration
replay. Users also pay the `NEXT_PUBLIC_PROSODY_SYNC` upload latency for zero benefit until fixed.

Pieces:
- **Modal worker** `cognify-prosody-worker` — Praat/parselmouth prosody, URL
  `https://maxvolkov202--cognify-prosody-worker-fastapi-app.modal.run`, deployed from
  `infra/prosody-worker/modal_app.py`, `min_containers=1`, Bearer-token auth via Modal secret
  `cognify-prosody-secret`.
- **Prod env:** `FF_PROSODY_WORKER=true`, `PROSODY_WORKER_URL=<modal url>`, `PROSODY_WORKER_TOKEN`,
  `NEXT_PUBLIC_PROSODY_SYNC=true`.
- **Code:** PR #19 (sync path uploads audio before scoring, passes signed `audioUrl` to
  `/api/score` when `NEXT_PUBLIC_PROSODY_SYNC=true`); PR #20 (`extractWorkerProsody` now tries the
  Praat worker FIRST, Hume as fallback — a stale `HUME_API_KEY` in prod had been short-circuiting
  the worker and forcing text-tier tone).

Consequences / watch-items:
- With `NEXT_PUBLIC_PROSODY_SYNC=true`, every sync rep uploads audio BEFORE scoring, adding upload
  latency to the perceived score time (intended tradeoff for prosody tone).
- Grading rubric is **v4.1.0** (recalibration, excellent reps reach 80+). With prosody live, elite
  reps with expressive audio can now reach the 85-90 band that text-only capped at ~85.
- `min_containers=1` = continuous Modal credit burn. See [[project_host-reconfigure-handoff]].
