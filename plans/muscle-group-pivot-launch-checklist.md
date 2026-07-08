# Muscle-group pivot — launch checklist

Phase 15 deliverable. Run this before flipping
`FF_MUSCLE_GROUP_WORKOUT=true` in production.

## Feature flag

- **Name:** `FF_MUSCLE_GROUP_WORKOUT`
- **Defaults:** on in dev / preview, off in production (default-by-NODE_ENV).
- **Explicit override:** `FF_MUSCLE_GROUP_WORKOUT=true` or `=false` on Vercel.
- **Rollback:** unset (or set to `false`) on Vercel; legacy serves the BetaSoon placeholder + redirects engaged users to `/skill-lab` (Practice). Re-flipping back is instant — no migration needed because `muscle_group_days` and related tables stay populated; their rows just don't render.

## Pre-merge gates (automated)

- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` — full suite (assignment + session machine + day-status + voice + pre-pivot tests) green
- [ ] `npm run build` green, no lint errors
- [ ] All migrations 0020 → 0023 applied to staging DB (verify via `\dt cognify_v2.*`)

## Pre-merge gates (manual on staging)

These require human eyes on a real device + a real account. Cannot be
verified from a CI sandbox.

### Functional smoke matrix
- [ ] Open `/workout` for the first time → suggestion rationale shown, "Start today's Workout" CTA visible.
- [ ] Tap CTA → muscle-group day created, picker opens at station 1.
- [ ] Walk a full 4-rep day with Shuffle picker → mascot walks between stations, retrospective renders with correct composite.
- [ ] Re-open `/workout` after completing a day → retrospective re-renders (day-complete phase).
- [ ] Force a sharp-regression scenario via `scripts/dev/verify-workout-assignment.mjs --preset regression --apply` → reload `/workout` → suggested dim is Pacing with the regression rationale.
- [ ] Switch tabs mid-recording → state machine moves to `paused`; resume returns to recording.
- [ ] Decline graduation rep → day-complete.
- [ ] Accept graduation rep → 5th rep tagged `is_graduation_rep=true`; bonus XP awarded.
- [ ] Confirm `/dev/mascot` shows all 7 states and the reduced-motion fallback (OS setting toggle).
- [ ] `/progress/muscle-groups` loads <500ms for a user with ≥10 days history; filter chips work; line chart renders.

### Banner / retrospective copy
- [ ] First-ever day → "First {Dim} day. Set the baseline."
- [ ] Strong prior (≥75) → "...— strong. Don't slip."
- [ ] Weak prior (<55) → "...— let's climb."
- [ ] Middle → "...composite N. Beat it."
- [ ] Retrospective shows delta vs last day, per-dim grid, ≥1 highlight.

### Mobile / a11y
- [ ] 375px viewport: 4 stations fit, no horizontal scroll, mascot scales, prompt picker tabs reach thumbs.
- [ ] 768px / 1280px: layout transitions cleanly.
- [ ] iOS Safari standalone: install via Share → Add to Home Screen, confirm splash + standalone framing.
- [ ] Screen reader (VoiceOver / TalkBack): mascot state transitions announce via live region; station strip announces position + status.
- [ ] `prefers-reduced-motion: reduce`: mascot still-frame fallback active; walks collapse to 200ms cross-fade.

### Skill Lab regressions
- [ ] `/skill-lab` still works: framework picker, scenario, random rep, custom prompt, build-a-rep.
- [ ] Skill Lab promo strip appears when today's day is unfinished; hides post-completion.
- [ ] One-time pivot tooltip dismisses + persists via localStorage.

### Ops + cron
- [ ] `/api/cron/muscle-group-day-rollover?dryRun=1` reports expected stats with no errors.
- [ ] Seed a missed-day fixture; run cron (Vercel "Run now" or curl); confirm `closed_out_at` + notification row inserted.
- [ ] Confirm `/ops/calibration/drift` behavior unchanged (no new false flags from exercise-aware scoring).

## Scoring drift check (requires API credits)

Per Phase 15 spec: replay the calibration set against the post-pivot
scoring path; persist baseline; diff vs pre-pivot.

- [ ] `node scripts/phase-baseline.mjs --mode=muscle-group-final --compare-against=plans/baselines/phase-pre-pivot.json` — runs the 10-rep subset through `/api/score/twostage`, persists `plans/baselines/muscle-group-pivot-final.json`, and exits non-zero if composite drift exceeds ±5 on more than 1 of 10 reps. Scaffold landed in Phase C; needs ~$2 of Anthropic credits to execute.
- [ ] Drift tolerance: composite ±5 per rep, dim ±8 per rep, hold on ≥9 of 10 reps. Fail closed.
- [ ] Per-exercise mini-harness: `node scripts/phase-baseline.mjs --mode=muscle-group-final --exercise-id=<slug>` for each of {explain-like-im-12, headline-first, the-3-point-rule, the-30-second-rule, bottom-line-first, kill-the-filler}. Spot-check the per-rep composite + that the XML block appears in the prompt-log debug pane and the filler fast-fail floors conciseness when triggered.

## Rollout (Phase 0 → 100%)

Each step **observed ≥24h before next bump.**

- [ ] **Phase 0 — internal (Max + Bob).** Flag on for internal accounts; everyone else still in BetaSoon. 48h of dogfooding.
- [ ] **5%** — first cohort. Watch completion rate, p95 scoring duration, mock-fallback rate, cron error logs.
- [ ] **25%** — broaden if KPI gates hold.
- [ ] **100%** — all users.

KPI gates at each step:

- 4-of-4 day completion ≥35% on dogfood cohort
- Workout open rate ≥0.6 per active-day
- Median time-to-complete ≤15 min
- Scoring p95 ≤8s
- Mock-fallback <2%
- Mascot asset load ≤1.5s p95 (verify via the perf sampler hook from Phase 4)
- Rollover cron success rate 100% over 48h post-bump

## Rollback procedure

1. Set `FF_MUSCLE_GROUP_WORKOUT=false` on Vercel.
2. `vercel env pull` locally (optional, for parity).
3. Push to redeploy — takes <2 min. `/workout` switches to BetaSoon immediately.
4. Investigate: surface logs, check `cognify_v2.muscle_group_days` for stuck rows, drop the rollover cron schedule if needed.
5. No data deletion required — every muscle-group table preserves its rows. Re-enable when fixed.

Total rollback wall time: ~5 minutes from "decision made" to "production stable."

## Known deferrals (post-launch follow-ups)

These are tracked in `plans/muscle-group-pivot-progress.md`:

1. **RepRunner extraction** (Phase 11 partial deferred). 23-caller migration of RepSurface into the shared primitive. Architectural cleanup; doesn't block launch.
2. **Capacitor native shell** (Phase 12 partial deferred). PWA + platform shims shipped; native shell is its own ~1-sprint project. See `plans/muscle-group-pivot-capacitor-audit.md`.
3. **Mascot polish** (Phase 14, optional). Max-authored Figma → SVG layer swap. The Phase 4 placeholder is production-acceptable.
4. **RAG retrieve filter by exercise** (Phase 8 deferred). Tighter few-shot grounding per-exercise; needs the RAG path edited.
5. **48-rep calibration replay** (Phase 8 + 15 deferred). Needs ~$2 of OpenAI/Anthropic credits + ~5min wall-clock to run.
6. ~~**Playwright tap-target audit** (Phase 12 deferred). E2E harness for mobile-readiness gates.~~ Shipped in Phase C — `npm run test:e2e` after `npx playwright install chromium` + running dev server.
7. ~~**Service worker via Serwist** (Phase 12 deferred).~~ Shipped in Phase D. `withSerwist` in `next.config.ts`, source at `src/app/sw.ts`, registers in production via `ServiceWorkerRegister.tsx`. Default Serwist runtime caching; API routes intentionally bypassed.
8. ~~**MediaSession lock-screen integration** (Phase 12 deferred).~~ Shipped in Phase D. `useMediaSession` hook in `src/hooks/use-media-session.ts`; wired into `WorkoutShell`. Best-effort: Android Chrome / Edge / desktop show the card; iOS Safari needs active playback to honor it (won't show during recording).
9. ~~**PATCH `/api/me/tz`** (Phase 10 deferred).~~ Shipped in Phase A. `src/app/api/me/tz/route.ts` + `TimezoneDetector` client component mounted in `(app)` layout.
10. ~~**`/ops/calibration` per-exercise drift view** (Phase 8 deferred).~~ Shipped in Phase B at `/ops/calibration/per-exercise`.
