# Job 2 — Prosody worker prod deploy

> **Update (2026-07-20, later):** Blocker 2 (sync path never sent `audioUrl`) is **FIXED in code**
> — `RepSurface.tsx` now uploads audio first and passes the signed `audioUrl` to `/api/score`
> when `NEXT_PUBLIC_PROSODY_SYNC=true` (default off → byte-identical to old behavior). Blocker 1
> (Modal auth) is the only thing still outstanding: Modal is installed but has **no credentials** —
> run `modal token new` (interactive) or provide a token-id/secret pair. Activation sequence at the
> bottom. Original write-up below.

# (original) Prosody worker prod deploy: BLOCKED (2 blockers for Max)

Status at 2026-07-20: **not deployed / flag not flipped.** Two independent blockers, both
Max-owned. Neither is a code defect in the grading pipeline — the audio-tone grading itself is
proven to work (Praat worker on :8080, `calibrate-audio-tone.mjs` passes). The blockers are
(1) no usable Modal credential, and (2) the prod SYNC scoring path never sends `audioUrl`, so
flipping the flag alone would be a no-op for tone.

---

## Blocker 1 — Modal token was a placeholder

The prompt's token slot read literally `<PASTE MODAL TOKEN HERE>` — no token was pasted. I
cannot `modal token set` / `modal deploy infra/prosody-worker/modal_app.py` without it, so I
have no public worker URL to set `PROSODY_WORKER_URL` to.

**Need from Max:** a real Modal token (or run `modal deploy infra/prosody-worker/modal_app.py`
yourself and paste the resulting URL).

## Blocker 2 — the prod SYNC path does not pass `audioUrl` to `/api/score` (the important one)

Prod runs the **sync** scoring path (`NEXT_PUBLIC_USE_ASYNC_SCORING=false`, confirmed in the
prod env). I traced recorder → score:

- `src/components/product/RepSurface.tsx:568-609` builds `scoreBody` and POSTs `/api/score`.
  **`scoreBody` has no `audioUrl` field.**
- The audio upload happens **after** scoring, at `RepSurface.tsx:633-647`, and its result is
  used only for `saveRep` (persistence + playback) — never sent to the scorer.
- In `src/lib/ai/score.ts:988-994`, the prosody worker is only called when `input.audioUrl != null`.
  With no `audioUrl`, `workerProsody` is null → `toneSource` stays `"text"` → tone is graded on
  the conservative text tier.

**Consequence:** setting `FF_PROSODY_WORKER=true` + `PROSODY_WORKER_URL` in prod will NOT make
sync reps use prosody. The worker is never called because the request carries no audio. The flag
would light up only the (currently-off) async path.

Note the async path IS wired correctly for reference: `RepSurface.tsx:499-524` uploads audio
first and threads `audioPath` → `insertPendingRep` → `process-rep` edge fn
(`supabase/functions/process-rep/index.ts:85-110` signs the path and passes `audioUrl` to
`/api/score-internal`, which forwards it to `scoreRep`). Only the sync path has the gap.

### Proposed fix (sync path)

Replicate the async path's "upload + sign, then score" order in the sync path:

1. In `RepSurface.tsx`, move the audio upload to **before** the `/api/score` call.
2. Return (or separately fetch) a short-lived **signed URL** for the uploaded object.
   `/api/score`'s `audioUrl` is validated as `z.string().url()` and the worker needs a
   self-authorizing signed URL (same TTL pattern as `process-rep` uses:
   `createSignedUrl(path, SIGNED_URL_TTL_SECONDS)`). `/api/upload` today returns a storage
   path; either extend it to also return a signed URL, or add a tiny sign endpoint.
3. Add `audioUrl` to `scoreBody`.

**Latency:** this moves the upload onto the critical path (adds ~0.5-2s before the score
returns). `extractWorkerProsody` already no-ops instantly when `FF_PROSODY_WORKER!==true`
(`prosody-worker.ts:75`), so passing `audioUrl` is server-safe when the flag is off — but the
client still pays the upload-first latency. Recommend gating the reorder behind a
client-readable mirror flag (e.g. `NEXT_PUBLIC_PROSODY_SYNC=true`) so the extra latency is only
paid once prosody is actually deployed; when off, behavior is byte-identical to today.

This is a hot-path change to the recorder and is Max-owned Job-2 territory, so I did **not**
implement it — it needs your call on the latency tradeoff and can't be end-to-end verified
without a live worker URL (blocker 1) anyway.

## Recommended sequence once unblocked

1. Deploy worker (`modal deploy …`), capture URL.
2. Land the sync-path `audioUrl` fix (behind `NEXT_PUBLIC_PROSODY_SYNC`).
3. Set prod env: `PROSODY_WORKER_URL=<url>`, `NEXT_PUBLIC_PROSODY_SYNC=true` (use
   `vercel env rm … && vercel env add … --value <v> --no-sensitive --yes`; verify with
   `vercel env pull` — stdin piping is a 3-way trap).
4. Redeploy, smoke `/api/score` with an `audioUrl` → confirm `tone.signals` carries
   `[toneSource: prosody]`.
5. Only then flip `FF_PROSODY_WORKER=true`, redeploy, re-smoke expressive-vs-flat delivery.
