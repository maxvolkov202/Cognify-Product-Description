---
name: feedback_deploy-after-merge
description: In this repo merged ≠ live — always vercel deploy --prod + verify the alias before calling a phase done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62ad2902-6580-405d-be45-0e608924d303
  modified: 2026-07-22T23:30:21.033Z
---

For the UI/feature overhaul wave (and this repo generally), a change is NOT done when the PR merges
to `main` — this fork is **not** git-auto-deployed, so cognifygym.com keeps serving the old build until
someone runs `vercel deploy --prod` (see [[reference_prod-deploy]]).

**Why:** 2026-07-22 I marked Phase 4 "done" at merge and moved on. Max opened cognifygym.com and every
fix looked broken ("someone", "strongest: delivery", no "Show more", uncentered empty state) — all just
the stale pre-P4 build. Wasted a round-trip and eroded trust in "done".

**How to apply:** the tracker's per-phase gate already requires deploy + prod-verify — actually run it.
After merging, sync `main`, `vercel deploy --prod --yes`, then confirm the alias serves the new
deployment (`vercel inspect https://www.cognifygym.com` created-timestamp + `curl` 200) BEFORE saying a
phase landed. If a symptom looks like "my fix didn't work," first check whether prod was even deployed.
Ties to [[feedback_autonomous-phases]] (execute phases end to end — deploy is part of the end).
