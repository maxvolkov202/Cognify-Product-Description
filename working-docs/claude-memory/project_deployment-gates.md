---
name: Cognify launch gates — open items before public launch (2026-07-21)
description: Current open items blocking a real Cognify v2 launch — WebM prosody fix, Google OAuth enable, Modal cost, optimistic-score UX. Supersedes the stale 2026-04 NextAuth-era version.
type: project
originSessionId: ae89cbe6-4104-4d03-9db5-4e7b9eefda16
---

Verified 2026-07-20/21 on prod (`cognify-v2-neon.vercel.app`, Vercel project `cognify-v2`,
Supabase `dunnoccrvrqzsgxsfjuv`). Grading is green (junk 21 / elite 84, **0 mock-fallbacks**,
`openai:gpt-4o-2024-08-06`), all PRD systems built, prod flags correct. Open items:

**1. ✅ FIXED + DEPLOYED 2026-07-21 (PR #22).** WebM/Opus prosody now works. `main.py` `_load_sound()`
tries Praat directly then transcodes to 16kHz mono WAV via ffmpeg (already in the Modal image) on
failure. `modal deploy` done; verified end-to-end — real browser webm → non-null prosody
(pitchMeanHz 141.6) and prod `/api/score` → `[toneSource: prosody]` (was `text`), non-mock. See
[[project_prosody-live]].

**2. ✅ WORKING 2026-07-22 — friend completed real Google sign-in end-to-end.** Root cause of the
earlier "blank / Safari can't connect to the server" failure was the Supabase **Site URL still set to
localhost** (`http://localhost:3333`): after Google auth, Supabase fell back to Site URL for the
final redirect, landing the user on an unreachable localhost. Fix was pure dashboard config (no code
change — callback route `src/app/auth/callback/route.ts` and `signInWithOAuth` redirectTo were fine).
Correct Supabase Auth→URL Config now: **Site URL** = `https://cognifygym.com`; **Redirect URLs** =
`https://cognifygym.com/**`, `https://www.cognifygym.com/**`, `http://localhost:3333/auth/callback`
(www `/**` mattered — the app uses `window.location.origin` and www is the primary host). Google
OAuth client authorized redirect = `https://dunnoccrvrqzsgxsfjuv.supabase.co/auth/v1/callback`;
consent-screen branding (app name "Cognify" + logo) set. NOTE: consent screen still shows the raw
`dunnoccrvrqzsgxsfjuv.supabase.co` domain — that's the Google **Authorized domain** (required for the
token redirect) and is cosmetic; only a Supabase **custom domain** add-on (~$10/mo, → `auth.cognifygym.com`)
replaces it. Email/password also wired (`signInWithPassword`/`signUp`).

**3. ✅ RESOLVED 2026-07-22 — Modal worker now scales to zero.** `infra/prosody-worker/modal_app.py`
`min_containers` set `1 → 0`; deployed via `modal deploy` (authed as `maxvolkov202`, token in
`~/.modal.toml`) and verified the leftover warm container drained to **0 active containers**
(`modal container list`), so idle credit burn has stopped. Committed + squash-merged to
**maxvolkov202/main** as PR #31 (merge commit `7b2d771d`). Trade-off: first rep after idle
cold-starts and gracefully degrades to text tone if it exceeds the 5s Node fetch timeout, then warms;
flip back to 1 when steady traffic makes warm latency worth the burn. NOTE: the still-open
`fix/prompt-selection-bugs` branch predates this and shows `min_containers=1` in its tree — harmless
(prod + main are 0; a future fix→main merge won't revert it since that branch never touched the file).
Deploy gotchas on this Windows host: `modal` CLI not on PATH (run `python -m modal ...`); set
`PYTHONIOENCODING=utf-8`/`PYTHONUTF8=1` or the deploy dies on a `✓` charmap encode error; run
`modal deploy` from inside `infra/prosody-worker/` (it references `main.py` by relative path).
See [[project_host-reconfigure-handoff]].

**4. ✅ FIXED + DEPLOYED 2026-07-21 (PR #22).** The "85→71" split preview is gone. `RepSurface.tsx`
no longer shows optimistic dims; a single skeleton runs during grading and all six FINAL dimensions
appear together when `/api/score` returns (sync, ~8-9s). The 85→71 was never a scoring bug — 71 is
the correct blended thinking_quality; 85 was the deterministic baseline shown provisionally.
`computeOptimisticDims`/`OptimisticDimensionPreview` removed from the UI (pure scorers unchanged).

Prompt-bank expansion is the NEXT workstream after audio/google — brief at
`plans/prompt-bank-holistic-brief.md` (targets ~30 prompts/core exercise, taper-stop on >30%
canon-reject/dedup). See [[project_prd-v3-rebuild]].
