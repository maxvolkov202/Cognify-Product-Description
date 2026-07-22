# UI + Feature Overhaul Wave — Progress Tracker

**Created:** 2026-07-22 · **Branch base:** `main` (branch per phase, e.g. `feat/overhaul-p1-application-lab`)
**Owner:** Max · **Style bible:** existing app tokens (see §Shared conventions) + design docs
(`HOMEPAGE_REDESIGN.md`, `RECORDING_SCREEN_REDESIGN.md`, `CONFIGURATION_FLOW_REDESIGN.md`).

**Source of truth:** `plans/prd/cognify-system-change-v2-2026-07.md`. Where this wave overrides the PRD
(rank-XP visibility, Skill Lab rename) Phase 0 amends the PRD so code and doc agree — do not skip it.

## How to use this file

One phase per work session. Each phase is **fully independent**: its own branch, its own PR, its own merge —
it does not depend on later phases and must be shippable on its own. Start each session by reading this file
top-to-bottom, then the specific files the phase lists. Never commit to `main`. All net-new surfaces are
flag-gated (§Shared conventions).

### Per-phase protocol (run in this exact order — do not skip the gate)

1. **Branch** — `git checkout -b feat/overhaul-p<N>-<slug>` off the latest `main`.
2. **Build** the phase's tasks; keep the diff scoped to that phase only.
3. **Local gate** — `npm run lint && npm test && npm run build` all green.
4. **Smoke test** — run the phase's "Smoke test" steps end-to-end in dev (fake-mic loop where a rep is
   involved). It must pass before opening a PR. If it fails, fix in-phase; do not defer.
5. **Review** — `/code-review`, fix findings, re-run step 3.
6. **PR + merge** — open the PR (note "no calibration impact — XP/rank ≠ score" so review doesn't block),
   get it reviewed, merge to `main`. Each phase merges on its own.
7. **Deploy + landed-verification (THE GATE)** — deploy to prod, then run the phase's **"Prod verify
   checklist"** on cognifygym.com. Tick every box. **Do not start the next phase until every box in the
   current phase's prod verify checklist is checked.** If any box fails, reopen the phase and fix it before
   proceeding.
8. **Record** — tick this phase's boxes here, add a dated line to the Session log, then run the phase's
   **handoff prompt** after `/clear` to begin the next phase.

The per-phase **Smoke test** (step 4, proves it works in dev before merge) and **Prod verify checklist**
(step 7, proves it landed in prod before advancing) are listed inside every phase below. Treat step 7 as a
hard gate — it is how you confirm a phase landed properly before moving on.

---

## Decisions locked (confirmed by Max 2026-07-22)

- **DEC-1 — Rank system:** build on the existing Rank ladder (`FF_RANK_SYSTEM`, `src/lib/progression/rank.ts`),
  not legacy Level 1-100. Progressive tier costs already exist via the `^1.6` XP curve; we retune + surface.
- **DEC-2 — Rank XP is visible:** show "X XP this rank / Y XP to <next>" and fill the progress bar to that
  ratio. **Overrides PRD §10.5.2** (which hides raw XP in rank mode). Phase 0 amends §10.5.2.
- **DEC-3 — Social = full friend graph:** the graph already exists (`friendships`, `friendChallenges`,
  `activityEvents`, `/friends` route). We surface it on the dashboard and fix the live-feed data bugs; no
  new graph tables needed.
- **DEC-4 — Rename Skill Lab → Application Lab:** user-facing copy **+ route** (`/skill-lab` → `/application-lab`
  with a 308 redirect). Code identifiers and DB `mode='skill_lab'` stay stable. Phase 0 updates the
  terminology map + PRD (which currently says "name stays Skill Lab").
- **DEC-5 — Onboarding walkthrough = interactive spotlight tour:** highlights real UI with tooltips,
  dismissible, replayable from Settings.
- **DEC-6 — Library = editorial page:** fix real video thumbnails (broaden extraction), only fall back to a
  *visual* (non-text) card. Not a personal reps gallery (reps are audio-only, no video frame).
- **DEC-7 — Rep stepper:** replace Application Lab's fixed 3/5/10 with a +/- stepper, range **1–5**,
  default 3. Reuse the same stepper anywhere reps/sessions are chosen.

---

## Request → phase map (all 22 asks)

| # | Ask | Phase |
|---|---|---|
| 1 | "Skill Lab" → "Application Lab" | P1 |
| 2 | 1–5 +/- rep stepper | P1 |
| 3 | Center Interviewing + Persuasion (web symmetry) | P1 |
| 4 | Dashboard "Last 5" → "Last 5 reps average" / "-25 from your baseline" | P2 |
| 5 | "Communication Score" long-run wording | P2 |
| 6 | Remove "Last sessions" from dashboard | P2 |
| 7 | Resize activity heatmap (less dead space) | P2 |
| 8 | Show XP-in-rank + XP-to-next on card **and** progress bar | P3 |
| 9 | Progressive rank costs (Bronze flat, Silver more, Gold more…) | P3 |
| 10 | +10 XP for bug reports | P3 |
| 11 | Friends-activity / social section on dashboard | P4 |
| 12 | Live feed: real name (not "someone"), real "strongest" skill | P4 |
| 13 | Live feed: 10 entries + "Show more" | P4 |
| 14 | Leaderboard "My team" off-center | P4 |
| 15 | Abort rep (discard without grading) | P5 |
| 16 | "Suggested Framework" + shuffle + pencil-edit/custom | P5 |
| 17 | Blind ranking: recipient audio + submit + notify sender | P6 |
| 18 | Progress: remove rubric version | P7 |
| 19 | Progress: relisten + retry a past rep | P7 |
| 20 | Library: real video thumbnails, bigger headers, smaller bubbles | P8 |
| 21 | Settings: split General / Personalization + dedupe theme | P8 |
| 22 | Onboarding "How to / What this is" spotlight walkthrough | P9 |
| 23 | Temporarily hide the Daily Workout General/Personalized switch — general-only for now | P10 |

---

## Shared conventions

**Style tokens (match these exactly — from the live codebase):**
- Cards: `surface-card overflow-hidden` + a `brand-gradient h-1` top stripe + `p-5 md:p-6` body.
- Brand fills: `brand-gradient` (bg), `brand-gradient-text` (text), accents `text-brand-purple` /
  `dark:text-brand-lavender`. Neutrals: `ink-*` scale, always with `dark:` variants **except onboarding**
  (light-mode only).
- Eyebrows: `text-[11px] font-semibold uppercase tracking-wider text-ink-400`.
- Section `<h2>`: `text-lg font-bold text-ink-900 dark:text-white`. Page `<h1>`: `text-4xl md:text-5xl
  font-extrabold`.
- Chips/pills: `rounded-full px-4 py-1.5 text-xs font-semibold`; active = `brand-gradient text-white
  shadow-sm` (reference `FilterChip`, `LeaderboardTabs.tsx:180`).
- Primary CTA: `brand-gradient … rounded-full px-6 py-3 text-sm font-semibold text-white` + `ArrowRight`.
- Icons: `lucide-react`. Stepper reference already in repo: `MixedRepsStep` (`SkillLabClient.tsx:977-1080`,
  `Minus`/`Plus`, clamp `Math.max(0, Math.min(5, …))`).

**Flag pattern:** add flags to `src/lib/flags.ts` using `defaultOnOutsideProduction("FF_*")` (ON in
dev/preview, OFF in prod until promotion). Server-resolve only. New flags introduced by this wave are
named per phase below.

**Smoke-test harness (per memory `reference_authed-e2e-and-db`):** authed fake-mic loop via Playwright
(`PW_BASE_URL` for prod), reset a test day with `scripts/dev/reset-e2e-day.mjs`. `npm run lint` +
`npm test` + `npm run build` must be green before every PR. Prod verify uses cognifygym.com with a real
account.

**Definition of done per phase (PRD "Working with Claude Code"):** behaves as specced · integrates with
existing systems · meets PRD §11 Product Standards · tests + lint + build green · tracker updated · Max
handed a concrete prod verify checklist. Copy stays plain-language, no em-dashes, no theory jargon.

---

## Phase 0 — Doc sync + shared primitives  ✅ (merged 2026-07-22, `feat/overhaul-p0-primitives`)

**Goal:** make the docs agree with DEC-1…7 *before* code changes, and build the two primitives reused
across later phases so we don't fork them.

**Files/tasks:**
- [x] 0.1 PRD: amend §10.5.2 to state rank XP is **visible** ("X XP this rank / Y to next"), progress bar
      fills to that ratio (DEC-2). Note the reversal in the decision log.
- [x] 0.2 PRD + `plans/prd/terminology-map.md` row for Skill Lab → rename user-facing term to **Application
      Lab**, route `/application-lab`; keep code `mode='skill_lab'` + `/skill-lab` redirect note (DEC-4).
- [x] 0.3 `plans/system-change-v2-progress.md` decision log: add D25 (this wave) pointing here.
- [x] 0.4 Build `src/components/ui/Stepper.tsx` — reusable +/- integer stepper (`min`, `max`, `value`,
      `onChange`, `label`), lifted from `MixedRepsStep`'s pattern, styled with brand tokens. Clamp logic
      unit-tested in **`tests/stepper.test.ts`** (14 assertions) — moved from the doc's proposed
      `__tests__/Stepper.test.tsx` path to match the repo's actual harness (`tsx tests/*.test.ts`, no DOM
      renderer); registered in `package.json`'s `test` script. Exported pure helpers `clampToRange`/`clampStep`.
- [x] 0.5 Extract the friends live-feed row into a shared `src/components/product/friends/ActivityFeedRow.tsx`
      (was inline `RealActivityRow`) so P4 can mount it on the dashboard without duplication. Pure extraction:
      the row JSX + its `Avatar`/`initials`/`relativeTime` deps moved **verbatim** (proven byte-identical) and
      re-imported into the friends page; `/friends` renders identically.

**Flag:** none (docs + inert primitives).
**Smoke test:** `npm run lint && npm test && npm run build` green; `/friends` renders unchanged after the
row extraction (visual diff).
**Prod verify:** n/a (no user-facing change ships this phase; can merge without prod check).
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md` and both CLAUDE.md files. Execute **Phase 1 — Application Lab
> rename, 1–5 rep stepper, app-grid symmetry**. Use the `Stepper` primitive from Phase 0. Follow the file
> list and styling tokens in the phase. When done: run the Phase 1 smoke test, `/code-review`, fix findings,
> open a PR, update this tracker, and give me the Phase 1 prod verify checklist.

---

## Phase 1 — Application Lab rename + 1–5 rep stepper + app-grid symmetry  ✅ (merged 2026-07-22, `feat/overhaul-p1-application-lab`)

**Goal:** rename the surface, replace the length picker with a 1–5 stepper, center the trailing two app cards.

**Files/tasks:**
- [x] 1.1 **Rename copy** — change every user-visible "Skill Lab" string to "Application Lab":
      `skill-lab/page.tsx:39,129,200`, `SkillLabClient.tsx:302,368`, `AppSessionClient.tsx:400,882`,
      `layout.tsx:30` (nav), `dashboard/page.tsx:334`, `ModeBadge.tsx:55`, `ModesSection.tsx:11`,
      `pricing/page.tsx:32`, `opengraph-image.tsx:94`, `library/page.tsx:337,350`,
      `workout/page.tsx:391,398`, `DayCompleteSummary.tsx:374`, engagement copy
      (`weekly-challenges.ts:60`, `quests.ts:88`, `achievements.ts:65`), and the `[slug]`/exemplars metadata.
- [x] 1.2 **Route rename** — move `src/app/(app)/skill-lab/` → `src/app/(app)/application-lab/`; add a 308
      redirect `/skill-lab/:path* → /application-lab/:path*` (Next config or a thin re-export). Update all
      internal `href="/skill-lab…"` (nav, dashboard tile, back links) to `/application-lab`. Keep DB
      `mode='skill_lab'` untouched.
- [x] 1.3 **Rep stepper** — replace `LengthPick` fixed `[3,5,10]` buttons (`AppSessionClient.tsx:601-646`)
      with the `Stepper` primitive: range 1–5, default 3, label "How many reps?", helper "3 · recommended".
      `start(count)` unchanged (`:159`). Confirm `completeSkillLabSessionV2` accepts arbitrary 1–5 counts.
- [x] 1.4 **App-grid symmetry** — in `ApplicationsHub` (`skill-lab/page.tsx:143`), center the trailing two
      cards (Interviewing, Persuasion) under the top three at `lg:grid-cols-3`. Cleanest: keep the grid but
      wrap so the last row centers (e.g. a flex row with `justify-center max-w-[…]`, or `lg:[&>*:nth-child(4)]:col-start-…`
      offset). Verify at sm (2-col) it still reads well.

**Flag:** reuse `FF_SKILL_LAB_APPS` (already gates the hub). Rename copy is safe unflagged.
**Styling:** app cards keep `APPLICATION_ACCENTS`; stepper uses brand tokens from Phase 0.
**Smoke test:** dev — nav shows "Application Lab"; `/skill-lab` 308-redirects to `/application-lab`; start an
Application Lab session, set stepper to 1 and to 5, complete a fake-mic rep; the 5-card grid is symmetric at
desktop width. `npm run build` (catches broken imports/route refs).
**Prod verify checklist:** ✅ all confirmed by Max on cognifygym.com 2026-07-22.
- [x] Nav item reads "Application Lab" on cognifygym.com.
- [x] Visiting `/skill-lab` redirects to `/application-lab` (no 404).
- [x] Rep stepper shows 1–5, defaults to 3, +/- clamps; chosen count drives the session length.
- [x] On a wide screen the 5 application cards are visually centered/symmetric (no lone left-aligned pair).
- [x] No stray "Skill Lab" text anywhere (dashboard tile, badges, OG image, pricing).
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 2 — Dashboard content polish** (Last-5 copy,
> Communication Score wording, remove Last sessions, resize heatmap). Files are in the phase. Smoke test the
> dashboard end-to-end, `/code-review`, PR, update tracker, give me the Phase 2 prod verify checklist.

---

## Phase 2 — Dashboard content polish  ✅ merged + deployed 2026-07-22 (`feat/overhaul-p2-dashboard-polish`, PR #36) · ⏳ awaiting Max's prod verify

**Goal:** clearer baseline/score copy, remove redundant section, tighten the heatmap.

**Files/tasks:**
- [x] 2.1 **"Last 5" → "Last 5 reps average"** — `DashboardHero.tsx` label; footnote copy →
      `"+N points from your baseline"` / `"N points from your baseline"` / `"Even with your baseline"` /
      `"No baseline yet"`. Kept "points" per Max's phrasing and made it grammatically correct
      (`Math.abs(delta) === 1 ? "point" : "points"`, fixing the `/code-review` ±1 finding); tabular-nums intact.
- [x] 2.2 **Communication Score wording** — `DashboardHero.tsx`. Label "Communication Score" unchanged;
      default footnote "All six Core Skills, long-run" → **"Your all-time communication average"**. The
      `benchmarkNote` override path (`communicationScoreNote ?? …`) is intact and still wins when present
      (verified in prod smoke: demo user still shows "Typical manager band: 60-75").
- [x] 2.3 **Remove "Last sessions"** — `dashboard/page.tsx`: deleted the render + local `LastSessions` /
      `SessionCard` / `RecentRep` type, and the now-unused `Mic` import. **Kept** the `getRecentReps(userId,5)`
      fetch — still feeds `avgRecent` and `totalSessions`.
- [x] 2.4 **Heatmap dead space** — `WeekCalendar.tsx`. Cells now scale to fill their column
      (`aspect-square w-full`, `Check` bumped to `size-5`, number to `text-base`) and the grid is centered +
      constrained (`mx-auto max-w-lg`, `sm:gap-3`) so the row reads as a dense band instead of small circles
      floating in wide columns. aria-label count/avg-composite tooltip + today-ring preserved. **Trade-off
      noted for Max:** `max-w-lg` centers the strip, so a very wide card keeps symmetric side margins; bump the
      max-width if you want it edge-to-edge.

**Flag:** none (copy + layout on a shipped surface).
**Smoke test:** dev dashboard with ≥5 reps: Last-5 tile reads "Last 5 reps average" with "… from your
baseline"; Communication Score footnote reads all-time; no "Last sessions" block; heatmap fills its card.
Empty-state path (`page.tsx:218-275`) still renders.
**Prod verify checklist:**
- [ ] "Last 5 reps average" label + "X from your baseline" footnote (sign correct: down shows negative).
- [ ] Communication Score footnote reads as an all-time/overall average.
- [ ] No "Last sessions" section on the dashboard.
- [ ] Activity heatmap fills its box with minimal left/right dead space; hover tooltip still works.
- [ ] New-user (0 reps) dashboard still renders without errors.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 3 — Rank & XP visualization + progressive
> curve + bug-report XP**. Build on `FF_RANK_SYSTEM`; surface rank XP per DEC-2 (PRD §10.5.2 already amended
> in P0). Smoke test rank display + bug report, `/code-review`, PR, update tracker, give me the checklist.

---

## Phase 3 — Rank & XP visualization + progressive curve + bug-report XP  ⬜

**Goal:** make rank progress legible (XP earned in rank, XP to next, on the card and the bar), tune the curve
so higher tiers graduate slower, and award 10 XP for bug reports.

**Files/tasks:**
- [ ] 3.1 **Surface rank XP** — `LevelStreakCard.tsx` rank mode (`:63-102`). `RankInfo` already exposes
      `floorXp`/`nextFloorXp`/`progress` (`rank.ts:48-54`). Render:
      `xpInRank = xp - floorXp`, `xpToNext = (nextFloorXp ?? xp) - xp`; show e.g. "1,240 XP · 360 to Silver II",
      and fill the progress bar (`:88-94`) to `rank.progress`. At Grandmaster IV (`nextFloorXp === null`) show
      "Max rank". Remove the §10.5.2 XP-hidden guard (`:96-102`) now that P0 amended the PRD.
- [ ] 3.2 **Progress bar everywhere rank shows** — ensure the same bar+labels appear on the dashboard card;
      if rank also renders elsewhere (profile), reuse a small `RankProgress` subcomponent.
- [ ] 3.3 **Progressive tier costs** — Max wants all Bronze divisions to cost the same, Silver slightly more
      each, Gold more, etc. Today `RANK_FLOORS` anchors divisions to levels via `xpForLevel` (`rank.ts:58-73`),
      so within a tier the 4 divisions are *not* equal. Redefine `RANK_FLOORS` as **per-tier flat division
      costs that step up by tier**: define `TIER_DIVISION_XP = { bronze: B, silver: B*k, gold: …}` and build
      cumulative floors so each of a tier's 4 divisions adds the same amount, and each tier's per-division
      amount exceeds the previous tier's. Keep floors strictly ascending (guards in `rankFromXp`). Add a unit
      test asserting: (a) equal deltas within Bronze, (b) Silver-delta > Bronze-delta > … monotonic by tier,
      (c) floors strictly ascending across all 32. **Do not touch `xp.ts` earn multipliers** (grading/calibration
      unaffected — XP ≠ score). Document the new curve in a comment + the PRD progression section.
- [ ] 3.4 **Bug-report +10 XP** — `src/app/api/bug-reports/route.ts` after the insert (`:127`), when
      `userId` (`:94-95`) is non-null, do a **flat additive** award (copy `awardSessionCompletionXp`'s
      `users.xp += 10` pattern, `xp.ts:85-97`) — **not** `awardXp` (avoids composite curve + `lifetimeReps`).
      Best-effort/try-catch so it never fails the bug submit. Optional toast "+10 XP for the report" in
      `ReportBugModal` success state.

**Flag:** `FF_RANK_SYSTEM` (existing) gates 3.1–3.3. Bug XP (3.4) unflagged (safe, additive).
**Migration/risk note:** changing `RANK_FLOORS` re-labels existing users' ranks at the same XP. Before merge,
run a script over prod XP distribution to confirm nobody visibly *demotes* in a jarring way; if they do,
choose floors that preserve current placements at the current XP median. Note the reshuffle for Max.
**Smoke test:** dev with a test user at a mid-rank: card shows "N XP · M to <next>" and the bar matches;
step XP across a division boundary → labels + bar update, rank-up detection (`rankChanged`) fires. Submit a
bug report as a signed-in user → `users.xp` increases by exactly 10; submit anonymously → no award, no error.
Unit tests for the new floors pass.
**Prod verify checklist:**
- [ ] Rank card shows XP earned in the current rank and XP remaining to the next rank.
- [ ] Progress bar fill matches the XP ratio (0% just after promotion, ~100% just before next).
- [ ] Grandmaster IV shows "Max rank" with no negative "to next".
- [ ] Higher tiers visibly need more XP per division than lower tiers (spot-check Bronze vs Gold spacing).
- [ ] Submitting a bug report while signed in grants +10 XP (check profile XP before/after); anonymous does not.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 4 — Social on dashboard + live-feed fixes +
> leaderboard centering**. The friend graph + `getActivityFeedForUser` already exist; mount the extracted
> `ActivityFeedRow` (P0) on the dashboard and fix the "someone"/"strongest: delivery" data bugs. Smoke test,
> `/code-review`, PR, update tracker, give me the Phase 4 prod verify checklist.

---

## Phase 4 — Social on dashboard + live-feed fixes + leaderboard centering  ⬜

**Goal:** put a friends-activity feed on the dashboard, fix the feed showing "someone" and identical
"strongest: delivery", add 10-entries + "Show more", and center the leaderboard "My team" empty state.

**Files/tasks:**
- [ ] 4.1 **Dashboard friends-activity section** — add a `DashboardFriendsActivity` card to
      `dashboard/page.tsx` (near the social/quests area), fed by `getActivityFeedForUser(userId,{limit:10})`
      (`activity.ts:63-123`), rendering the shared `ActivityFeedRow` (P0). Empty state = a "Find friends"
      CTA linking `/friends`. Match `surface-card` + `brand-gradient h-1` styling; heading "Friends activity".
- [ ] 4.2 **Live-feed "someone" bug** — in the feed row/query, the actor name falls back to "someone" when a
      join/display field is missing. Fix `getActivityFeedForUser` (or the row) to select and show the actor's
      registered name/username (users table `name`/`username`); "someone" only for genuinely null. Apply on
      both `/friends` (`RealActivityRow`, `friends/page.tsx:265-315`) and the new dashboard card (shared row).
- [ ] 4.3 **"strongest: delivery" for everyone** — the row shows a hardcoded/placeholder strongest skill.
      Source the actor's real top Core Skill from their profile (highest dimension EMA in
      `communication_profile`/`progress_snapshots`), or drop the "strongest" line if not cheaply available
      per-actor. Confirm it varies across users before shipping.
- [ ] 4.4 **10 entries + "Show more"** — feed renders first 10, then a "Show more" button reveals the next
      page (client state, or a `?feed=N` server bump). Apply on `/friends` live feed (`:247-258`) and reuse
      the same cap logic on the dashboard card (dashboard stays 10, links to `/friends` for the rest).
- [ ] 4.5 **Leaderboard "My team" centering** — `LeaderboardTabs.tsx` empty-state `<p>` at `:300` and `:327`
      use `max-w-md` **without** `mx-auto`, pinning the box left inside a `text-center` parent. Add `mx-auto`.
      Verify the populated team board (podium/table `:112-173`) is already centered by the page wrapper.

**Flag:** new `FF_DASHBOARD_SOCIAL` (via `defaultOnOutsideProduction`) gates 4.1 only. Bug fixes 4.2–4.5 are
unflagged corrections.
**Styling:** feed rows match `ActivityRow` spacing; "Show more" is a ghost/secondary button, not the primary CTA.
**Smoke test:** dev with a user that has ≥2 accepted friends emitting events: dashboard shows a Friends
activity card with real names and varied strongest skills; feed caps at 10 with a working "Show more" on
`/friends`; team-tab empty state paragraph is centered under its heading. Zero-friends dashboard shows the
"Find friends" CTA, no crash.
**Prod verify checklist:**
- [ ] Dashboard has a Friends activity section; entries show the friend's real name/username (never "someone"
      when a name exists).
- [ ] "Strongest" skill varies per person (not "delivery" for everyone), or is absent by design.
- [ ] `/friends` live feed shows 10 rows then a "Show more" that loads more.
- [ ] Leaderboard "My team" empty-state text is centered under the heading.
- [ ] User with no friends sees a friendly "Find friends" CTA on the dashboard, no error.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 5 — Rep flow: Abort rep + Suggested
> Framework**. This touches the live recording path (`RepSurface`, `RepFrameworkStrip`) — an abort must skip
> transcribe/score/save/tag entirely. Smoke test a full workout + Application Lab rep including abort and
> framework shuffle/edit, `/code-review`, PR, update tracker, give me the Phase 5 prod verify checklist.

---

## Phase 5 — Rep flow: Abort rep + Suggested Framework (shuffle / edit / custom)  ⬜

**Goal:** let a user abort a rep mid-flow without grading it, and reframe the framework as an editable
suggestion (shuffle for a new one, pencil to edit/create your own).

**Files/tasks:**
- [ ] 5.1 **Abort rep** — `RepSurface.tsx`. Add an "Abort" / "Discard rep" control available while recording
      and immediately after (before scoring). Wire it to reset the phase machine to `idle` **without** calling
      `runScoringPath` (`:457`) — i.e. skip `/api/transcribe` (`:411`), `/api/score` (`:619`), `saveRep`
      (`:655`) / `insertPendingRep` (`:492`), and `onComplete` (`:684`). Mirror the existing `handleDiscard`
      (`:729-737`) but expose it as a first-class button (not only the sub-threshold gate). In the callers,
      ensure abort does **not** advance the session: workout `tagWorkoutRep`/`advanceExercise`
      (`RepControls.tsx:476`) and Application Lab `onRepComplete` must be skipped so earlier reps stay intact
      and the same slot can be re-recorded. Confirm mic stream is stopped/released on abort.
- [ ] 5.2 **"Suggested Framework" relabel** — `RepFrameworkStrip.tsx:128` header "Framework" →
      "Suggested Framework"; soften `RepSurface.tsx:1026` "Hold this structure" and `InsightScreen.tsx:131-138`
      "Structure to hold" to recommendation language ("Suggested structure — a shape you can follow, you're
      not graded on it"). Keep the existing disclaimer footnote (`:280`).
- [ ] 5.3 **Shuffle** — add a shuffle affordance to `RepFrameworkStrip` that swaps to an alternate framework.
      Source alternates from `frameworks-library.ts` / `REP_TYPES` (`rep-types.ts`) rather than the single
      `getFrameworkForDimension` lookup (`exercise-framework.ts:20-27`). Hold the choice in local state around
      `repTypeFramework` (the strip already imports `PenLine`). Never blocks recording.
- [ ] 5.4 **Edit / create your own** — pencil icon opens an inline editor to rename the framework and edit its
      steps/nodes (the numbered list). Persist per-rep in local state (session-scoped is fine; optional:
      persist a user's custom frameworks to a lightweight store if Max wants them to stick — flag as a
      follow-up, not required this phase). Custom framework flows through the same display path; it is
      **not** sent to scoring (verify `/api/score` payload does not include framework adherence).

**Flag:** new `FF_REP_FRAMEWORK_EDIT` gates shuffle/edit (5.3–5.4). Abort (5.1) + relabel (5.2) unflagged —
abort is a safety feature and relabel is copy.
**Risk note:** 5.1 is the highest-risk item in the wave (touches the save/grade path). Add a unit/integration
check that abort produces **no** rep row, no XP, no streak fold, no coaching event.
**Smoke test:** dev — start a rep, hit Abort mid-recording → returns to idle, no rep saved (check DB via
`reset-e2e-day` state), mic released; re-record same slot → normal grade. Shuffle framework → different shape
renders; pencil-edit → rename + edit steps, custom shows during rep, score still returns (framework not
graded). Run the full fake-mic workout loop to confirm normal (non-abort) reps still save + grade + advance.
**Prod verify checklist:**
- [ ] An "Abort" control is visible while recording; aborting returns to the start with **no** grade, no XP,
      no streak change, and the rep does not appear in Progress/Library.
- [ ] After aborting, the same rep can be recorded normally and grades fine.
- [ ] Framework is labeled "Suggested Framework" and copy makes clear it's not graded.
- [ ] Shuffle swaps to a different framework; the pencil lets you rename/edit steps (and make your own).
- [ ] A rep done with a custom framework still receives a normal Communication Score.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 6 — Blind ranking (validation) end-to-end
> fix**. Root cause: `/api/validate/audio/[repId]` rejects the anonymous recipient (401/403) so audio never
> loads. Add a token-scoped public audio route, verify submit end-to-end, and notify the sender. Smoke the
> full send→listen→rank→results loop, `/code-review`, PR, update tracker, give me the checklist.

---

## Phase 6 — Blind ranking (validation) end-to-end fix  ⬜

**Goal:** make the shared blind-ranking link actually work — recipient can hear each rep and submit a ranking,
and the sender is notified/sees results.

**Files/tasks:**
- [ ] 6.1 **Public token-scoped audio route** — the recipient page `src/app/validate/[token]/page.tsx` is
      anonymous, but `BlindRankingSurface.tsx:78-83` points `<audio>` at `/api/validate/audio/${id}`, which
      401s anonymous callers and 403s non-owners (`route.ts:26-32,44-54`). Add a **new** route
      `src/app/api/validate/audio/[token]/[repId]/route.ts` (or extend with a `?token=`) that: loads the
      validation by token, verifies `repId ∈ validation.repIds`, rejects if `isClosed`, then streams via
      `getAudioSignedUrl(rep.audioUrl)` (`src/lib/audio/upload.ts:53`, bucket `rep-audio`, 1h TTL). Point
      `BlindRankingSurface` at the token-scoped URL. Keep the old owner-only route for authed surfaces.
- [ ] 6.2 **Verify submit end-to-end** — `submitRanking()` (`validation.ts:74`) + `external_rankings` insert
      already exist and are wired in `BlindRankingSurface`. Confirm the full drag-order → submit → success →
      aggregation (`getValidationAggregation`, `queries/validation.ts:119`) path works once audio loads. Guard
      against double-submit and submitting to a closed validation.
- [ ] 6.3 **Notify the sender** — the UI promises "You'll be notified" (`ValidationCreator.tsx:150`) but no
      notification exists. On successful `submitRanking`, emit a notification to the owner (reuse the app's
      notification/activity mechanism — e.g. an `activityEvents`-style row or the existing notifications
      system if present; if none, at minimum surface an unseen-count badge on `/validate` results). Keep it
      best-effort (never fail the recipient's submit).
- [ ] 6.4 **Latent path bug** — while here, note `getBeforeAfterReps` returns a raw `audioUrl` used directly
      as `<audio src>` (`BeforeAfterAudio.tsx:179`) — unsigned, won't play. Fix belongs to P7; cross-link.

**Flag:** none (this is a broken feature being repaired). Consider `FF_VALIDATION_V2` only if you want a safe
prod toggle during rollout.
**Smoke test:** dev — create a validation link for 2–3 of your reps; open the `${origin}/validate/${token}`
link in a **logged-out** browser/incognito; each rep's audio plays; drag to rank; submit → success; back as
the sender, `/validate/results/[token]` shows the aggregation and a notification/badge. Close the validation
and confirm a late submit is rejected.
**Prod verify checklist:**
- [ ] Open a blind-ranking link while signed out (incognito): every rep's audio plays.
- [ ] Reorder and submit a ranking successfully; a second submit is prevented.
- [ ] Sender sees the submitted ranking in results and gets a notification/badge.
- [ ] A closed link no longer accepts submissions and shows a clear closed state.
- [ ] Audio URLs are short-lived signed URLs (not raw storage paths) and don't leak other users' reps.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 7 — Progress page: remove rubric version +
> relisten & retry**. Also fix the P6-flagged `BeforeAfterAudio` unsigned-URL bug. Reps are audio in bucket
> `rep-audio`; sign with `getAudioSignedUrl`. Retry routes to the practice flow with `parentRepId` for
> lineage. Smoke test, `/code-review`, PR, update tracker, give me the Phase 7 prod verify checklist.

---

## Phase 7 — Progress page: remove rubric version + relisten & retry  ⬜

**Goal:** drop the internal "Rubric version" stat, and let users replay a past rep's audio and retry it.

**Files/tasks:**
- [ ] 7.1 **Remove rubric version** — `progress/page.tsx`: delete the "Rubric version" `StatCard`
      (`:307-313`) + the `RUBRIC_VERSION` import (`:3`); change the stat grid from `md:grid-cols-4` to
      `md:grid-cols-3` (`:284`) so the remaining three balance.
- [ ] 7.2 **Relisten** — extend `getRecentReps` (`progress.ts:377`) to also select `reps.audioUrl`, and sign
      it server-side with `getAudioSignedUrl` (`upload.ts:53`). In the recent-reps list (`page.tsx:402-423`)
      add an `<audio>`/play button per row (reuse the `BeforeAfterAudio` play UI). **Fix** the latent
      `BeforeAfterAudio` bug at the same time: `getBeforeAfterReps` (`progress.ts:889,924`) must return a
      **signed** URL, not the raw path (`BeforeAfterAudio.tsx:179`).
- [ ] 7.3 **Retry a past rep** — add a "Retry" action per recent rep that routes into the practice flow with
      the original prompt prefilled and `parentRepId` passed into the scoring call so lineage
      (`attemptKind:'again'` + `parentRepId`, `reps.ts:729-742`) and the improvement/implementation XP
      multipliers apply. Reuse the existing retry entrypoints (`BuildARepFlow.tsx:343`, workout retry) rather
      than inventing a new scoring path. Deep-link e.g. `/workout?retryRep=<id>` (or the Application Lab
      equivalent depending on the rep's origin mode) and hydrate prompt + parent.

**Flag:** new `FF_PROGRESS_RELISTEN` gates relisten+retry (7.2–7.3). Rubric-version removal (7.1) unflagged.
**Styling:** play button + retry as compact row actions; retry uses the secondary/ghost button style, not the
primary CTA.
**Smoke test:** dev progress page: no "Rubric version" card, grid is 3-up; each recent rep plays its audio
(signed URL, actually audible); Before/After audio now plays too; click Retry → lands in practice with the
right prompt, complete it → new rep links to the parent (`parentRepId` set) and earns retry XP.
**Prod verify checklist:**
- [ ] Progress page no longer shows "Rubric version"; the stat row looks balanced (3 cards).
- [ ] Each recent rep can be replayed (audio actually plays).
- [ ] The Before/After comparison audio plays (previously silent).
- [ ] "Retry" opens the practice flow with the original prompt; the new attempt is linked to the original.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 8 — Library thumbnails + Settings split &
> theme dedupe** (two low-risk surfaces). Library is editorial: make real video thumbnails render, non-text
> fallback only. Settings: split into General/Personalization and remove the duplicate ThemeToggle. Smoke
> test both, `/code-review`, PR, update tracker, give me the Phase 8 prod verify checklist.

---

## Phase 8 — Library thumbnails + Settings split & theme dedupe  ⬜

**Goal (two surfaces):** editorial Library shows real video thumbnails with bigger headers + smaller bubbles;
Settings is organized into General / Personalization with the theme control appearing once.

**Library — files/tasks:**
- [ ] 8.1 **Real thumbnails** — `library/page.tsx`: broaden `thumbnailFor` (`:182`, currently YouTube-only) to
      also handle Vimeo/TED and improve OG fetching (`getOgImageUrl`/`buildOgMap`, `:210-229`,
      `src/lib/library/og-image.ts`). When a real image exists, render it; only use a **visual** fallback
      (brand-gradient card, `LibraryPoster.tsx:22-50`) — never the typographic text hero
      (`LibraryTypographicHero`, `:289`) — per DEC-6. Audit the `SECTIONS` list (`:30-172`) so each item has a
      resolvable thumbnail (add explicit poster URLs where extraction can't).
- [ ] 8.2 **Bigger section headers** — `library/page.tsx:253-264`: bump `<h2>` from `text-xl` to
      `text-2xl md:text-3xl font-extrabold`; keep the icon chip.
- [ ] 8.3 **Smaller bubbles** — shrink the `kind` label pills: over posters `LibraryPoster.tsx:75-78` and
      over fallbacks `page.tsx:295-299` (`text-[10px]` → `text-[9px]`, tighter `px-1.5 py-0.5`).

**Settings — files/tasks:**
- [ ] 8.4 **Split General / Personalization** — wrap `SettingsClient.tsx` sections into two tabbed groups
      (mirror `LeaderboardTabs` `FilterChip`). **General:** Account & data (`:953`), Privacy (`:588`),
      Notifications (`:595`), Appearance/Theme. **Personalization:** Your vertical (`:257`), Training schedule
      (`:328`), Personas (`:391`), Goals (`:491`), Communication stage (`:577`). Preserve the split save model
      (batched dirty-bar for vertical/personas/goals; autosave for the rest) — keep the sticky "Unsaved
      changes" bar working within its tab.
- [ ] 8.5 **Dedupe theme** — remove the second `<ThemeToggle/>` rendered in `settings/page.tsx:70` (and its
      import `:8`); keep the one inside `SettingsClient.tsx:585`, placed under Personalization (or General —
      keep with Appearance). Restyle `ThemeToggle`'s wrapper (`rounded-3xl border … shadow-sm`) to match the
      `surface-card` pattern so it's visually consistent in its tab.
- [ ] 8.6 **Replayable tour hook** — add a "Replay walkthrough" button placeholder in General (wired in P9).

**Flag:** none for Library (editorial). Settings tab split unflagged (no data change) — but keep a fast revert
by isolating the tab wrapper.
**Smoke test:** dev — Library items all show real image thumbnails (no text-only cards), headers larger,
pills smaller; Settings shows General/Personalization tabs, every section reachable, theme appears once and
still switches light/dark/system, saving still works (dirty bar + autosave).
**Prod verify checklist:**
- [ ] Every Library card shows a real video thumbnail (or a visual gradient fallback) — no text-only posters.
- [ ] Library section headers are noticeably larger; the kind pills are smaller.
- [ ] Settings has General and Personalization tabs; all prior settings are present under one of them.
- [ ] The theme control appears exactly once and still changes the theme; other settings still save.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 9 — Onboarding spotlight walkthrough** (the
> final phase). Build a dismissible, replayable interactive tour of the main sections; wire the "Replay
> walkthrough" button added in P8. Mind that dev bypasses onboarding — the tour needs its own gate. Smoke
> test a fresh-user run, `/code-review`, PR, update tracker, then run the wave-wide prod verification.

---

## Phase 9 — Onboarding spotlight walkthrough ("How to / What this is")  ⬜

**Goal:** a guided, interactive product tour that spotlights the real UI (Dashboard, Application Lab, Build a
Rep, Progress, Library, Leaderboard, Friends) with tooltips explaining "what this is / how to use it";
dismissible and replayable from Settings.

**Files/tasks:**
- [ ] 9.1 **Tour engine** — add `src/components/onboarding/WalkthroughTour.tsx`: a lightweight spotlight
      overlay (dim backdrop + cutout around a target ref/selector + tooltip card with Next/Back/Skip). No
      external dep required; if one is desired, keep it self-contained and CSP-safe. Steps defined in a config
      array (`{ selector, title, body, placement }`).
- [ ] 9.2 **Steps** — one step per primary nav destination + the key in-page controls (start a rep, the
      Suggested Framework, abort, rank card, friends feed). Copy is plain-language "What this is / How to".
- [ ] 9.3 **Trigger + gate** — auto-launch once for a new user after onboarding completes
      (`onboarding/done/page.tsx` → land on dashboard with `?tour=1`). Because dev bypasses onboarding
      (`(app)/layout.tsx:49-61` forces onboarded=true in non-prod), give the tour its **own** persisted
      "seen" flag (user setting or localStorage `cognify:tour-seen-v1`) independent of the onboarding gate, so
      it shows in dev too and never re-nags after completion/skip.
- [ ] 9.4 **Replay** — wire the "Replay walkthrough" button added in Settings General (P8, task 8.6) to
      relaunch the tour.
- [ ] 9.5 **A11y** — focus trap in the tooltip, ESC to skip, `aria-live` step announcements, keyboard
      Next/Back. Respect `prefers-reduced-motion` for the spotlight transitions.

**Flag:** new `FF_ONBOARDING_TOUR` (default ON outside prod). Lets us ship dark and promote when polished.
**Styling:** tooltip card = `surface-card` + `brand-gradient h-1`; primary "Next" = brand CTA; "Skip" = ghost.
Onboarding pages are light-only, but the tour runs **inside the app** so it must support dark mode.
**Smoke test:** dev — trigger the tour (fresh `cognify:tour-seen-v1`): it spotlights each section in order,
Next/Back/Skip/ESC work, it doesn't reappear after finishing; replay from Settings relaunches it; the
spotlight aligns to the real elements at desktop and mobile widths; reduced-motion disables the animation.
**Prod verify checklist:**
- [ ] A new user is offered the walkthrough after onboarding; it highlights each main section with clear copy.
- [ ] Next/Back/Skip and ESC all work; keyboard-only completion is possible.
- [ ] The tour does not reappear after being completed or skipped.
- [ ] "Replay walkthrough" in Settings relaunches it any time.
- [ ] Spotlight positions correctly on mobile and desktop; works in dark mode; respects reduced motion.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. All phases are built. Run the **wave-wide prod verification**
> (the section-by-section checklist at the bottom) on cognifygym.com, then flip the new `FF_*` flags on in
> prod one at a time, smoke-testing each. Report any failures back with the phase number.

---

## Phase 10 — Daily Workout: general-only prompt mode (temporary)  ⬜

**Added by Max 2026-07-22 (ask #23).** Temporarily hide the Daily Workout **General | Personalized** switch and
force **General** for everyone in prod, "until we dial more into vertical-specific." This is a **reversible
gate, not a deletion** — the personalization pipeline stays intact; we just stop exposing the toggle to users
and stop defaulting onboarded users into Personalized. Flip one prod env var to bring it back. Independent of
P2–P9; can be **pulled forward** ahead of the remaining phases if Max wants it live sooner.

**Where it lives (from the codebase):**
- `PersonalizeSwitch` (the General|Personalized segmented control) + the `personalize` state are in
  `src/components/product/workout-shell/WorkoutShell.tsx` (`:302-327` state, `:398-401` the switch render,
  `:449` where `personalize` is passed down into prompt selection). Default today = `payload.hasPersonalizationProfile`
  (ON for onboarded users), no localStorage persistence.
- The `personalize` boolean flows into prompt/rep selection; forcing it `false` makes the workout use the
  **general** prompt bank (see `prompt-gen.ts` vertical-bias block `:283`, gated on the vertical context that
  General mode omits).

**Files/tasks:**
- [ ] 10.1 **Add a server-resolved flag** — `FF_WORKOUT_PERSONALIZE_SWITCH` in `src/lib/flags.ts` via
      `defaultOnOutsideProduction(...)` (switch **visible in dev/preview** so we can still test vertical
      prompts; **hidden in prod** = general-only now). Resolve it server-side and thread a
      `personalizeSwitchEnabled: boolean` into the workout `payload` (the shell is a client component and must
      not read env directly — PRD/CLAUDE convention).
- [ ] 10.2 **Force General + hide the switch when the flag is off** — in `WorkoutShell.tsx`: seed
      `useState(personalizeSwitchEnabled ? payload.hasPersonalizationProfile : false)`, and render
      `PersonalizeSwitch` only when `personalizeSwitchEnabled`. When hidden, `personalize` stays `false` for
      the page lifetime and cannot be toggled. Keep the "Prompt mode" eyebrow + summary hidden too so the
      landing chrome doesn't leave an empty slot.
- [ ] 10.3 **Confirm downstream is truly general** — verify that with `personalize=false` the prompt-selection
      path (`:449` → selection/prompt-gen) receives no vertical context, so the reps are vertical-neutral. No
      change to the personalization *storage* (profile/vertical stay saved for when we re-enable).
- [ ] 10.4 **No regression to the rest of the workout** — the full fake-mic day loop still runs; only the
      prompt source changes. Abort/retry/advance unaffected.

**Flag:** `FF_WORKOUT_PERSONALIZE_SWITCH` (new; `defaultOnOutsideProduction`). To restore the switch in prod
later, set the prod env var truthy — no code change.
**Calibration:** no scoring prompt/model change — prompt *selection* only. XP/rank ≠ score. No calibration re-run.
**Smoke test:** dev with the flag OFF (simulate prod): the workout landing shows **no** General/Personalized
switch; an onboarded user's day uses general prompts; a full fake-mic day loop completes. Flip flag ON → switch
returns and Personalized works as before.
**Prod verify checklist:**
- [ ] On cognifygym.com the Daily Workout landing shows **no** General/Personalized switch.
- [ ] An onboarded user's workout prompts read as general (not vertical-tuned).
- [ ] A full workout day still completes normally (rep → coaching → retry → review).
- [ ] Personalization data is untouched (vertical still set in Settings) so it can be re-enabled by env flip.
**Handoff prompt:**
> Read `plans/ui-feature-overhaul-progress.md`. Execute **Phase 10 — Daily Workout general-only prompt mode**.
> Gate the `PersonalizeSwitch` in `WorkoutShell.tsx` behind a new server-resolved `FF_WORKOUT_PERSONALIZE_SWITCH`
> (default ON outside prod, OFF in prod so it's general-only now), forcing `personalize=false` when hidden.
> Smoke test the workout with the switch hidden, `/code-review`, PR, deploy, update tracker, give me the Phase
> 10 prod verify checklist.

---

## Wave-wide prod verification — section by section

Run on cognifygym.com with a real account once all phases ship and flags are promoted. (Consolidated from
the per-phase checklists for a single end-to-end pass.)

**Application Lab (P1)**
- [ ] Nav + all surfaces say "Application Lab"; `/skill-lab` redirects to `/application-lab`.
- [ ] 1–5 rep stepper (default 3) drives session length; 5 app cards are symmetric on desktop.

**Dashboard (P2, P3, P4)**
- [ ] "Last 5 reps average" + "X from your baseline"; Communication Score reads as all-time average.
- [ ] No "Last sessions" section; activity heatmap fills its box with minimal dead space.
- [ ] Rank card shows XP-in-rank + XP-to-next; progress bar matches; higher tiers cost more per division.
- [ ] Friends activity section shows real names + varied strongest skill; empty state = Find friends CTA.

**Rep flow (P5)**
- [ ] Abort discards a rep with no grade/XP/streak; re-record works; framework is "Suggested" + editable/shuffle.

**Blind ranking (P6)**
- [ ] Logged-out link plays all audio; ranking submits once; sender notified + sees results; closed links reject.

**Progress (P7)**
- [ ] No rubric version; recent reps + Before/After audio play; Retry re-runs a past rep with lineage.

**Library + Settings (P8)**
- [ ] Real thumbnails everywhere, bigger headers, smaller pills; Settings split into General/Personalization,
      theme shown once and working.

**Leaderboard (P4) & Onboarding (P9)**
- [ ] "My team" empty state centered; walkthrough tour runs for new users, replayable from Settings.

**Progression / XP (P3)**
- [ ] Bug report grants +10 XP when signed in.

---

## Risks & cross-cutting notes

- **P3 rank re-floor** is the one data-affecting change (re-labels ranks at the same XP). Validate against the
  prod XP distribution before merge; avoid visible demotions.
- **P5 abort** is the highest-risk code path (save/grade). Assert via test that abort writes nothing.
- **P6 audio route** must scope by token + `repId ∈ validation.repIds` and use signed URLs — do not expose an
  unauthenticated route that can fetch arbitrary reps.
- **P7 relisten** must sign every `audioUrl` server-side; raw storage paths won't play and would leak bucket
  structure. Fix `BeforeAfterAudio` at the same time.
- **Calibration guardrail unaffected:** nothing in this wave changes scoring prompts/models. XP/rank ≠ score.
  No calibration re-run required — note this explicitly in each PR so review doesn't block on it.
- **Flags added this wave:** `FF_DASHBOARD_SOCIAL`, `FF_REP_FRAMEWORK_EDIT`, `FF_PROGRESS_RELISTEN`,
  `FF_ONBOARDING_TOUR`, `FF_WORKOUT_PERSONALIZE_SWITCH` (+ reuse `FF_SKILL_LAB_APPS`, `FF_RANK_SYSTEM`). Default
  ON outside prod, OFF in prod until Max promotes. **Note the inversion for P10:** `FF_WORKOUT_PERSONALIZE_SWITCH`
  OFF-in-prod is the *intended shipped state* (general-only now) — restoring the switch means flipping it ON,
  the opposite direction from the other new flags.

## Session log

- 2026-07-22 — Plan authored from a 4-agent codebase map. Decisions DEC-1…7 confirmed by Max. No code yet.
- 2026-07-22 — **Phase 0 done** on `feat/overhaul-p0-primitives`. Docs synced: PRD §10.5.2 amended (rank XP
  visible, DEC-2), Skill Lab→Application Lab noted in PRD + terminology map (DEC-4), D25 added to the
  system-change-v2 decision log. Built `Stepper` primitive (+ pure `clampToRange`/`clampStep`, 14-assertion
  test) and extracted shared `ActivityFeedRow` (verbatim, byte-identical). Local gate green (lint ✔ / test ✔
  incl. new stepper suite / build ✔ exit 0). Smoke: `/friends` renders 200 with Live-feed section intact on a
  fresh dev server (browser extension was offline, so verified at the HTTP/structural level + byte-identical
  diff rather than a pixel screenshot). `/code-review` (high): no findings. No calibration impact — XP/rank ≠
  score, no scoring prompt/model touched. Deviation: stepper test lives at `tests/stepper.test.ts` (repo
  harness convention), not the doc's `__tests__/*.test.tsx` path.
- 2026-07-22 — **Phase 1 done** on `feat/overhaul-p1-application-lab`. (1.1) Renamed every user-visible "Skill
  Lab" to "Application Lab" (nav, hub, session header, ModeBadge, marketing ModesSection, pricing, OG image,
  library + workout CTAs, DayCompleteSummary, exemplars metadata, and the bug/quest/weekly-challenge/achievement
  engagement copy); operator-only `/ops/calibration` internal DB-jargon left as-is (not end-user copy). (1.2)
  Moved `src/app/(app)/skill-lab/` to `application-lab/` (git rename preserved) + a **308** redirect in
  `next.config.ts` for `/skill-lab` and `/skill-lab/:path*` (query strings carried through); updated every
  internal href/redirect/router.push including `?focus=` deep-links, robots.ts, root-layout theme-prefix list,
  and the `TrainingStackRow` href union. DB `mode='skill_lab'` + all code identifiers (`FF_SKILL_LAB_APPS`,
  `skill-lab-v2`, `@/lib/skill-lab/*`) untouched. (1.3) Replaced the fixed 3/5/10 `LengthPick` buttons with the
  Phase-0 `Stepper` primitive (range 1-5, default 3, "How many reps?" + "3 · recommended") plus a Start CTA;
  widened the server guard from `SESSION_LENGTHS` {3,5,10} to `isValidSessionLength` integer [1,5]. (1.4) App
  grid to `lg:grid-cols-6` with `col-span-2` cards and `col-start-2` on the 4th so Interviewing + Persuasion
  center under the top three (sm 2-col unchanged). Local gate green (lint / 27-suite unit tests incl. stepper /
  build exit 0; routes register as `/application-lab*`, no `/skill-lab` route). Smoke (full, live authed): curl
  confirms `/skill-lab` 308 to `/application-lab` (+ subpath); hub renders "Application Lab" x6, 0 stray "Skill
  Lab", both grid-symmetry classes present, desktop screenshot shows the trailing pair centered; the authed
  fake-mic loop (`skill-lab-loop.spec.ts`) **passed for stepper=1 AND stepper=5** — full route to stepper to
  Start to prompt to insight to First Rep to Retry to Improvement Review to banked Session Complete.
  `/code-review` (high): 2 low findings (grid index hardcoded to 5 apps; stepper resets to 3 after a rare start
  error), both consciously accepted (no cleaner Tailwind fix; non-regression rare path), no correctness bugs.
  No calibration impact — XP/rank is not score; no scoring prompt/model touched. Deployed to prod via
  `vercel deploy --prod` (cognifygym.com). Prod verify checklist handed to Max; Phase 2 gated on his sign-off.
- 2026-07-22 — **Phase 1 prod verify PASSED** — Max confirmed all 5 boxes on cognifygym.com (nav copy, 308
  redirect, 1–5 stepper drives length, centered 5-card grid, no stray "Skill Lab"). Phase 1 fully closed.
- 2026-07-22 — Added **ask #23 → Phase 10** (Max): temporarily hide the Daily Workout General/Personalized
  switch and force general-only in prod until vertical-specific is dialed in. Reversible env-flag gate
  (`FF_WORKOUT_PERSONALIZE_SWITCH`, OFF-in-prod = shipped state), independent + pull-forward-able. No code yet.
- 2026-07-22 — **Phase 2 done** on `feat/overhaul-p2-dashboard-polish` (PR #36, squash-merged to main). (2.1)
  Last-5 tile relabeled "Last 5 reps average" + footnote "±N points from your baseline / Even with your
  baseline / No baseline yet" (grammatical point/points). (2.2) Communication Score default footnote → "Your
  all-time communication average", benchmarkNote override preserved. (2.3) Removed the "Last sessions" block
  (+ its `LastSessions`/`SessionCard`/`RecentRep`/`Mic`), kept `getRecentReps` for avgRecent/totalSessions.
  (2.4) Heatmap cells scale to fill columns (`aspect-square w-full`, larger check) + centered `mx-auto
  max-w-lg` band. Local gate green (lint ✔ / test ✔ 27 suites / build ✔). Smoke (authed, live 3333): populated
  dashboard desktop+mobile shows all four changes + no "Last sessions" + no app error; a fresh **0-rep** user
  renders the empty state cleanly (`FRESH_EMPTY_STATE=YES APP_ERROR=0`). `/code-review` (high): 1 low finding
  (±1 delta pluralization) — **fixed** before merge. No calibration impact — XP/rank ≠ score, no scoring
  prompt/model touched. Deployed to prod via `vercel deploy --prod` (dpl_DVvboazbxjxoYfNHvxPT2exUjkdC, aliased
  www.cognifygym.com, 200 OK). **Prod verify checklist handed to Max; Phase 2 gated on his sign-off before
  any further phase closes.**
