---
name: reference_prod-deploy
description: "How Cognify prod deploys — Vercel project cognify-v2, manual vercel deploy --prod, auto-aliases cognify-v2-neon"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 95631ccb-b6f0-44e8-bd83-1d698b40489d
  modified: 2026-07-22T23:30:09.343Z
---

Cognify prod deploy mechanics (confirmed 2026-07-21, session 12):

- **Vercel project:** `cognify-v2` (projectId `prj_SwZBC9rMztIlOxSdJPwVpHvr5seE`, org
  `team_fAzZIbLNs3aHUdDIJ6gsCrlX`, team `maxvolkov202s-projects`). Local repo is linked via
  `.vercel/project.json`.
- **NOT git-auto-deployed.** Merging a PR to `main` does NOT trigger a prod build. Deploys are
  **manual**: `vercel deploy --prod --yes` from the repo root, which uploads the LOCAL working tree
  (so sync `main` first) and builds on Vercel.
- **Alias auto-follows.** Contrary to the old "manually repoint the alias" note, `vercel --prod`
  auto-aliases all three prod domains to the new deployment:
  `cognify-v2-neon.vercel.app` (the canonical prod URL), `cognify-v2-maxvolkov202s-projects.vercel.app`,
  and `cognify-v2-maxvolkov202-maxvolkov202s-projects.vercel.app`. No `vercel alias set` needed.
- **`www.cognifygym.com` also auto-follows.** `vercel --prod` aliases the custom domain too — confirmed
  2026-07-22 (dpls `2b3RVkWSmtHJoGtn1UuKhTtuDwsW`, `8bgp74kmo…`). **Verify after every deploy:**
  `vercel inspect https://www.cognifygym.com` → check `status ● Ready` + `created … [Nm ago]` matches the
  deploy you just ran + `curl -sS -o /dev/null -w "%{http_code}" https://www.cognifygym.com/` → 200.
- **Auth + CLI ARE present on this host** — `vercel whoami` → `maxvolkov202`, CLI 56.5.0 on PATH
  (`AppData/Roaming/npm/vercel`). The SessionStart hook's "Vercel CLI is not installed" line is WRONG; probe
  with `command -v vercel` / `vercel whoami` before believing it. Host-tied to the SD laptop
  (see [[project_host-reconfigure-handoff]]).
- **GitHub ≠ Vercel-git-link.** The code IS on GitHub (origin `maxvolkov202/Cognify-Product-Description`,
  upstream `bobsides-AICodebase/...`); "no git link" only ever meant the Vercel project isn't wired to
  auto-deploy from that repo.
- Flags live in prod env (`vercel env ls production`): `FF_MUSCLE_GROUP_WORKOUT`,
  `FF_TRAINING_ENGINE_V2`, `NEXT_PUBLIC_USE_ASYNC_SCORING`, etc. Values are encrypted (not readable via
  CLI). Env-var newline gotcha still applies — see [[project_vercel-env-newline-gotcha]].
