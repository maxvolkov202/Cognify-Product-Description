---
name: project_host-reconfigure-handoff
description: Max leaves the Street Diligence laptop ~2026-07-27; host-tied Cognify creds must be re-set up on the new machine
metadata: 
  node_type: memory
  type: project
  originSessionId: 31ae1c5e-295a-4ad7-93e6-66e7a60cc69a
---

Max is on a **Street Diligence company laptop** and leaves the company **around 2026-07-27**
(said "leaving next week" on 2026-07-20), so the dev host will be reconfigured. Several Cognify
credentials/configs live only on this machine and must be re-established on the new host:

- **Modal CLI token** — `C:\Users\MaxVolkov\.modal.toml` (profile `maxvolkov202`, created 2026-07-20).
  Needed to redeploy/manage the prosody worker (`cognify-prosody-worker`). Re-auth with
  `modal token new`. Modal account has ~$30 credits.
- **Vercel CLI auth** — logged in as `maxvolkov202`; project `cognify-v2` linked via `.vercel/`.
- **`.env.local`** — OpenAI/Anthropic/Deepgram/Supabase keys (not in git). Prod uses the shared
  OpenAI account (a validation burst can exhaust it → prod mock-fallbacks; see incident 2026-07-20).
- **Modal secret** `cognify-prosody-secret` holds `PROSODY_WORKER_TOKEN`; the same value is in
  Vercel prod env `PROSODY_WORKER_TOKEN`. Both live server-side, not host-tied, but the deploy
  tooling (Modal CLI) is.

**Cost watch:** the Modal worker runs `min_containers=1` (always-warm) → continuous credit burn
against the $30. With no one monitoring after handoff, consider `min_containers=0` (graceful
cold-start degradation to text tone) or topping up Modal. See [[project_prosody-live]].
