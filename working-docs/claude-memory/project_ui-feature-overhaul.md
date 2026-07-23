---
name: project_ui-feature-overhaul
description: "UI+Feature Overhaul wave status — phases done/remaining, tracker location, and where loose docs are saved"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac9fb85d-60f1-4cbc-af22-551d3279322e
  modified: 2026-07-23T12:16:18.155Z
---

10-phase (+follow-ups) UI + Feature Overhaul wave. Tracker: `plans/ui-feature-overhaul-progress.md`
(branch-per-phase, own PR/merge/deploy each; step 7 prod-verify is a hard gate).

**Done + deployed to prod (cognifygym.com):** P0, P1, P2 (+2b/2c), P3, P4 (+4b/4c/4d/4e), P5,
**P5b** (2026-07-23, PR #57 `fdbca1ec`), P10. **Remaining: P6, P7, P8, P9.**

- **P5b** shipped the Max-reported **Paused-screen bug fix**: tab-hidden mid-rep dispatched `PAUSE`
  but nothing dispatched `RESUME` → stranded. Fixed with auto-RESUME on tab-visible + a "Resume
  workout" button. Also: timer starts at 0:00 (`markStart()`), red "Discard rep" pill, per-exercise
  Suggested Framework (`getFrameworkForExercise`, 102/102 slugs), framework strip in Application Lab.
- **P6 is next** (blind-ranking end-to-end fix — public token-scoped audio route). Handoff prompt is
  at the bottom of the Phase 5 block in the tracker.

**Repo handoff (2026-07-23, machine returned):** all loose untracked docs saved. `main` has the
design docs/reports/baselines at root (PR #57). Branch `chore/archive-working-docs-and-env-template`
(on origin) holds the fuller `working-docs/` layout + `.env.example` + local debug/gaps scripts —
NOT merged to main on purpose (those scripts are the gitignored investigation cruft). Stale Vite
build (`dist/` + root `index.html`) + `__pycache__` are now gitignored. See [[project_host-reconfigure-handoff]].
