# Post-Wave-2 Roadmap

Sequenced plan for the 9 follow-ups Max captured during Wave 2 personalization shipping (tasks #5–#12, plus the P0 added below). Built to be executed in order — earlier phases unblock later ones. Each phase has a goal, files to touch, risk profile, and acceptance criteria so we can ship incrementally and revert cleanly if anything goes sideways.

**Scope discipline:** every change is flag-gated where it changes existing user-visible behavior. Telemetry events go in everywhere a new product mechanic decides something so we can see what's actually happening.

---

## ⚠️ Phase 0 — P0: Personalize toggle doesn't actually personalize (#14)

**Symptom (Max, 2026-05-23):** Personalize toggle is ON, vertical change in `/settings` made no difference, /workout still shows general prompts.

**What we've verified:**
- DB has 35 vertical+goal prompts for Max's current exercise (probe-picker-live.mjs run against his user → healthcare prompts about smoking cessation, medication adherence, ICU transfers, etc. — clearly clinical).
- Server picker logic is correct: when called with `personalize=true` and a valid user, it would return the healthcare bank.
- Client wiring looks intact: `WorkoutShell.tsx` `useState(payload.hasPersonalizationProfile)` → `RepControls` `personalize` prop → `PromptPicker` `fetchPromptCandidates({exerciseId, personalize})`.

**Remaining suspects:**
1. **`currentUser()` returns null inside the server action** — session cookie not propagating to server-action context. Would result in `user=null`, the `if (input.personalize && user)` branch skipped, no vertical filter applied, cascade falls through to general.
2. **Toggle isn't actually flipping the state** — `PersonalizeSwitch` component might be displaying ON visually but not invoking `onChange`. Or it's display-only because `hasProfile=false` for some reason.
3. **Stale results** — picker fires correctly but the rendered cards are from an earlier call (race condition in the `useEffect` cleanup, or React 18 concurrent mode dropping the second response).
4. **Cache layer** — Next.js or browser cache returning a stale action response.

**Diagnostic in place:**
Added temporary file-trace to `fetchPromptCandidates` (dev-only) that writes every call to `scripts/picker-trace.log` with `{userResolved, userId, inputPersonalize, userVertical, userGoalsCount, tiersConsidered, bankTier, bankSize}`.

**Next action — needs Max:**
1. Hard-refresh `localhost:3333/workout` (Ctrl+Shift+R).
2. Tap **Shuffle** once on any exercise.
3. Tell me when done — I'll read the log and diagnose in one turn.

**Likely fixes by hypothesis:**
- If H1 (currentUser null): the page-level `currentUser()` is fine but server actions need session passed through. Check `src/lib/session/current-user.ts` for server-action vs page-render branching. Fix: ensure cookies are read inside the action via `headers()` / `cookies()` from `next/headers`.
- If H2 (toggle broken): inspect `PersonalizeSwitch` `onChange` wiring. One line.
- If H3 (race): add `cancelled` flag check before dispatch (already there at line 80) — investigate why it isn't catching.
- If H4 (cache): server actions are POST → should not be cached, but check `next.config.ts` for any rewrites.

**Acceptance:**
- Toggle ON → shuffle → cards are vertical-flavored. Toggle OFF → shuffle → cards are generic.
- Change vertical in `/settings` → return to `/workout` → reload → cards immediately reflect new vertical.
- Telemetry confirms `bankTier=vertical+goal` for any user with hasPersonalizationProfile=true.
- **Backfill for every user:** any user with a vertical set should default to personalized on every page load — that's already the design (`useState(payload.hasPersonalizationProfile)`), but verify it works for users beyond Max. Add a server-side data audit: how many users have vertical set, how many sessions in the last 7 days fetched prompts at tier vertical+goal vs general/any?

**Remove the diagnostic once fixed.** The temp file-trace logging in `prompt-selection.ts` is dev-only but should be deleted post-fix to keep the file clean.

---

## Sequencing principle

```
       Phase 0 — Personalize toggle dark (#14)  ◀── BLOCKS EVERYTHING
                    │  All Wave 2 work is dark until this is fixed
                    ▼
       Phase A (critical bugs, parallel)
        ┌──── A1 rotation bug (#8)  ◀─── unblocks D
        ├──── A2 next-station (#5)
        └──── A3 record contrast (#7)
                    │
                    ▼
       Phase B — layout polish (#6)
                    │
                    ▼
       Phase C — schedule + streaks foundation (#10, #11)
                    │           shared data model (users.committed_days)
                    ▼
       Phase D — weekly weakness day (#9)   ◀─── needs A1 + C
                    │
                    ▼
       Phase E — pre-rep scenarios (#12)     ◀─── independent, can run parallel anytime
```

Phase A bugs are P0. Phase C is foundation for the new product mechanic (D + #11). Phase E is content-heavy but architecturally simple.

---

## Phase A — Critical bug fixes

### A1. Daily skill not rotating per-user (#8)

**Symptoms:**
1. Workout serves the same dimension day-over-day (yesterday clarity, today clarity).
2. Dashboard "Today's focus" widget is desynced from what the workout actually picks (e.g. dashboard says "structure", workout serves "clarity").

**Root-cause hypotheses (need to verify):**
- Two different sources of truth feed the two surfaces:
  - **Workout** → `selectMuscleGroupForToday()` in `src/server/lib/workout/assignment.ts`. Picks dim via cold-start → sharp-regression → 6-day-floor → weakest-recent → oldest-fallback. Persists to `cognify_v2.muscle_group_days` per (user, day_date).
  - **Dashboard "Today's focus"** → `getWeakestDimension()` in `src/lib/db/queries/progress.ts`. Returns the user's all-time weakest dim. Completely separate code path.
  - These will visibly disagree the moment the workout picks anything other than "weakest overall".
- Rotation pinning hypotheses:
  - `startMuscleGroupDay()` is idempotent per (user, day_date). If yesterday's `day_date` was stamped wrong (timezone math), today's call returns yesterday's row → same dim shows.
  - The weakest-recent path could pin a dim that consistently scores low; the 6-day floor *should* break the loop, but only if other dims have any `lastTrainedAt`. For a brand-new user with one trained dim, the unfloor case can hold.

**Plan:**
1. **Inspect first, don't guess.** Run a one-off SQL pull for Max's user:
   ```sql
   SELECT day_date, dimension, created_at
   FROM cognify_v2.muscle_group_days
   WHERE user_id = '1cdb5187-…'
   ORDER BY day_date DESC LIMIT 10;
   ```
   Confirms whether rows are being created per-day or stuck.
2. **Unify the "today's skill" source of truth.** Dashboard hero should read from the *actual* muscle-group day (or its prospective dim if not yet created), not from `getWeakestDimension()`. New server query: `getOrPreviewTodaysMuscleGroup(userId)` — returns `{ dim, source: "persisted"|"preview" }`. Wire it into `DashboardHero` in place of `focus.dim`.
3. **Fix rotation if step 1 confirms a pinning bug.** Most likely fix is either:
   - Fix the day_date stamping to use the user's TZ (see Phase A from the muscle-group-pivot launch-prep — TZ patch already shipped; verify it's being read on the read path too).
   - Add a "minimum diversity" guarantee to `selectMuscleGroupForToday` — never return the same dim two days in a row unless there are no other eligible dims.
4. **Add telemetry.** Log `assignment.selected` with `{ userId, dim, rationaleCode, suggestedYesterday, persistedYesterday }` so we can see drift in production.

**Files:**
- `src/server/lib/workout/assignment.ts` (selection logic)
- `src/server/actions/workout-day.ts` (read path + telemetry)
- `src/lib/db/queries/progress.ts` (rename `getWeakestDimension` use or add `getTodaysScheduledDim`)
- `src/app/(app)/dashboard/page.tsx` (swap data source)
- `src/components/product/DashboardHero.tsx` (label copy stays)

**Risk:** Medium. Touching the assignment algorithm risks regressing existing users mid-week. Mitigate with a feature flag `FF_ASSIGNMENT_V2` that defaults off; flip on for Max's user first.

**Acceptance:**
- For Max's user across 3 consecutive days, dim varies (clarity → structure → conciseness or similar) unless explicit weakness-day kicks in.
- Dashboard hero "Today's focus" matches what `/workout` serves, every time.
- Telemetry event written per day creation.

---

### A2. "Next station" button no-op (#5)

**Trace path:**
- Button lives in `RepControls.tsx` (line ~302: `nextLabel={graduation ? "Finish workout" : "Next station →"}`) → calls `onNext` → calls `onAdvanceNow` → sends `{ type: "ADVANCE" }` to the session-machine reducer.
- The reducer in `src/lib/workout/session-machine.ts` must handle `ADVANCE` in the user's *current* phase. If the user is in `done` (final feedback shown) but the reducer only handles `ADVANCE` from `score-reveal`, the tap is a silent no-op.

**Plan:**
1. Read `session-machine.ts` reducer cases for `ADVANCE`. List every phase that handles it.
2. Cross-check the phases when "Next station" is rendered in `RepControls`. Find the mismatch.
3. Either (a) add an `ADVANCE` case in the missing phase or (b) gate the button's `disabled` so it only renders when an `ADVANCE` will actually do something.
4. Add a dev-mode `console.log` (already present in `onAdvanceNow`) — verify Max can see whether the tap registers at all when he repros.

**Files:**
- `src/lib/workout/session-machine.ts`
- `src/components/product/workout-shell/RepControls.tsx`
- Maybe `src/components/product/workout-shell/WorkoutShell.tsx` (handler wiring)

**Risk:** Low. State-machine fix, contained.

**Acceptance:**
- Tap "Next station" after a station's feedback shows → walking → next prompt-selecting, every time.
- After the 4th station → tap "Finish workout" → day-complete page.
- Console log records `workout_shell.advance_now` on every tap (already there, just verify).

---

### A3. Record button contrast (#7)

**Investigation needed:** Multiple "purple gradient" surfaces exist in the workout shell. The actual mic record button (`RecordButton.tsx` line ~309) uses a white `<Mic />` icon on a gradient — high contrast. The candidates for "grey on purple" complaint:
1. The "Tap the mic to start. You'll get a 3-second countdown…" copy below the button (currently `text-ink-500` on a white background, not on purple — but visually adjacent to the purple gradient mic).
2. The `<ActionTile />` primary tile (line ~426): `brand-gradient text-white` plus a `subLabel` rendered as `text-white/85` — could read as grey on purple.
3. The "score reveal" CTA or graduation button — different button, also gradient-styled.
4. The retry/proceed CTAs at line 763 in `RepSurface.tsx` — those use `text-white` though.

**Plan:**
1. **Ask Max for a screenshot** OR confirm which button by description ("the big circle with the mic? the row of three tiles? the one that says 'Submit'?"). One question saves us guessing.
2. Whichever button it is, the fix is a single Tailwind class swap: replace `text-white/85` or `text-ink-500` (on a gradient parent) with `text-white` or a higher-contrast token.

**Files:** one of `RecordButton.tsx`, `RepSurface.tsx`, `RepControls.tsx`.

**Risk:** None — pure CSS.

**Acceptance:**
- Lighthouse / WCAG AA contrast on the offending button.
- Max eyes-on confirms.

---

## Phase B — Rep page layout: symmetric from first load (#6)

**Symptoms:** The rep-recording page reads asymmetric until the user dismisses every popup (hints, example, tips). Once dismissed, it balances. The product should look composed *before* the user touches anything.

**Likely culprits:**
- `RepHintsBar.tsx` (collapsible hints) — when expanded, takes more vertical space than its collapsed state.
- `RepFrameworkStrip.tsx` (two-column cheat sheet, recently added) — may push the record button below the fold or off-center.
- Modal/popover state that defaults to "open" on first render.

**Plan:**
1. View the page in dev mode at `localhost:3333/workout` mid-rep. Take notes on the asymmetry.
2. Audit each child surface in `RepSurface.tsx` / `RepControls.tsx`:
   - What's its default open/closed state?
   - Does it reserve space when closed or collapse to zero?
3. Redesign the layout as a stable 2-column or 3-row grid where every panel has a fixed slot (open or closed). Use `min-h-[…]` placeholders so dismissing a panel doesn't shift layout.
4. Default the "first-rep" experience to show all panels in *steady-state* (compact, not full), not expanded.
5. Optionally: an opt-in "tour" overlay for first-ever users instead of stacked popups.

**Files:** `src/components/product/RepSurface.tsx`, `src/components/product/RepHintsBar.tsx`, `src/components/product/RepFrameworkStrip.tsx`, `src/components/product/workout-shell/RepControls.tsx`.

**Risk:** Medium — layout work is iterative. Will need Max eyes-on multiple times.

**Acceptance:**
- Open `/workout` mid-rep on a fresh session → layout looks symmetric / balanced at first paint.
- Dismissing any panel maintains the visual balance (no jarring shift).

---

## Phase C — Custom schedule + committed-day streaks (#10 + #11)

These ship together because they share the same new data column: **`users.committed_days`** — a 7-bit int (Mon=1, Sun=64) or a `text[]` of day names. Both the schedule and streak logic read from it.

### C1. Onboarding: pick training days

**UX:**
- New onboarding step "When do you want to train?" Trainer voice: *"Most people see results training 4–5 days a week. Pick what works for you — you can change this later."*
- 7-day grid Mon–Sun. Default selection: Mon/Tue/Wed/Thu/Fri (5 days). User can toggle.
- Validation: minimum 3, maximum 7. Below 3 → soft warning "Consistency matters — we recommend 3 or more days."
- Add to `/settings` as an editable section so users can change anytime.

**Schema:**
```sql
ALTER TABLE cognify_v2.users
  ADD COLUMN committed_days int NOT NULL DEFAULT 31; -- bitmask Mon..Sun, default M-F
```
Bitmask wins because it's compact, easy to test (`days & (1<<dayOfWeek)`), and serializes cleanly in JSON. Helper utilities in `src/lib/onboarding/committed-days.ts`.

**Files:**
- `db/schema.ts` + migration
- `src/lib/onboarding/committed-days.ts` (helpers + constants)
- `src/app/(app)/onboarding/days/page.tsx` (new step)
- `src/app/(app)/settings/SettingsClient.tsx` (editable section)
- `src/app/api/me/committed-days/route.ts` (PATCH endpoint)

### C2. Streaks count only committed days

**Current behavior:** A streak breaks any day the user doesn't train (and isn't covered by a freeze).

**New behavior:**
- A *streak day* is any committed day. Non-committed days are "rest days" and don't affect the streak either way.
- Missing a committed day still breaks the streak (subject to freezes).
- The streak counter shows "5 days" but tooltip explains "5 of your committed days in a row."

**Implementation:**
- Locate the streak query: `src/lib/db/queries/streak-freeze.ts` (or wherever `getStreakStatus` lives — referenced in dashboard).
- Refactor `computeStreak(userId, committedDays)` to walk back from today through committed days only, breaking on the first missed committed day without a freeze.
- Migrate existing streaks: backfill once at deploy by recomputing every active user's streak under the new rules. Net effect for most users: longer streaks (they get credit for rest days they never had to honor).

**Risk:** Streaks are a beloved mechanic — getting this wrong demotivates users. **Wrap in feature flag `FF_COMMITTED_STREAKS`. Backfill in a transaction. Make the rollout reversible.**

**Files:**
- `src/lib/db/queries/streak-freeze.ts`
- `src/lib/db/queries/progress.ts` (any streak read)
- `src/components/product/dashboard/LevelStreakCard.tsx` (tooltip copy)
- Backfill script `scripts/backfill-committed-streaks.mjs`

**Acceptance:**
- A user with Mon/Wed/Fri committed who trained M+W+F last week shows streak = 3 (today is Fri).
- Skipping a non-committed Tue does *not* break the streak.
- Skipping a committed Wed without a freeze *does* break it.
- Flag-off path is byte-identical to today.

---

## Phase D — Weekly weakness day (#9)

**Mechanic:** Across the user's weekly training cycle, track per-skill composite. On the *final committed day* of the week (or after N distinct skill-days, whichever comes first), the assignment engine picks the **weakest** skill instead of cycling.

**Key design decisions (need Max input):**
1. **What's a "week"?** Three options:
   - **Calendar week** (Mon–Sun). Simple but breaks for users with non-traditional schedules.
   - **Trailing 7 days from first committed day.** Personalized.
   - **First N committed days form one cycle.** Most flexible, matches "4 normal + 1 weakness = 5 days" framing best.
   
   Recommend: **option 3.** A "cycle" = the user's committed days. Last day of the cycle = weakness day. Most natural framing.
2. **Tie-breaking when scores are close.** Within 5 pts → fall back to least-recently-trained-of-the-weakest-tier so users don't get stuck on the same "weakness" forever.
3. **What if a skill wasn't trained at all this cycle?** Treat un-scored skill as the weakest (most-needed) — same precedent as the cold-start path.

**Implementation:**
- Extend `selectMuscleGroupForToday` with a `mode: "normal" | "weakness"` parameter.
- New helper `isWeaknessDay(userId, committedDays, today)` — returns true if today is the user's Nth committed day this cycle.
- New telemetry event `assignment.weakness_day` with the cycle's per-dim scores and the chosen weakest.
- Copy update on `DashboardHero` and the workout start card: *"Today's a recovery rep — we're going back to your weakest skill (Conciseness) to top off the week."*

**Files:**
- `src/server/lib/workout/assignment.ts` (mode param + weakness scoring)
- `src/server/actions/workout-day.ts` (decide mode based on cycle position)
- `src/lib/workout/weekly-cycle.ts` (new — cycle position helpers)
- `src/components/product/DashboardHero.tsx` + copy
- `src/components/product/workout-shell/StartCard.tsx` (start-day framing)

**Risk:** Medium-high. Touches the core assignment algorithm. Wrap in `FF_WEAKNESS_DAY`. Roll out to Max first.

**Acceptance:**
- A 5-day-committed user who trains Mon–Thu → Friday workout serves their lowest-composite skill across Mon–Thu.
- If all 5 days got equal scores → falls back to oldest-trained or cold-start logic.
- Telemetry event written with full cycle context.
- Copy on dashboard explains *why* this is a weakness day.

---

## Phase F — Recalibrate vertical prompts: repeatable, mechanic-aligned, vertical-flavored (#15)

**Trigger 1:** Max 2026-05-23 after the Drizzle fix unblocked the personalized cascade: *"these prompts are way too intense for the most part, for vertical specific we shouldnt try to make it impossible, we want the prompts to make sense for most people in those positions and not feel like extra work."*

**Trigger 2:** Max 2026-05-23, deeper second-look: *"our prompts are partially overly specific and professional, id say in every vertical ive checked so far, they are not repeatable and not always possible in the moment, like we cant be overly grounded to like scenarios because its hard to do that without something in mind and if too many prompts do that it makes you need to regfresh too often. also we should try to have some prompts match our existing exercise styles."*

The second trigger reframes the problem from "too senior" to **three real design defects**:

1. **Not repeatable on demand** — too many prompts require imagined audience, imagined situation, or domain context the user has to invent before they can start speaking.
2. **Mechanic-blind** — the exercise (Cut by Half, Headline First, Steel Man, etc.) trains a specific skill move; many Wave 2 prompts don't invite that move, so the user has to fight the prompt to perform the exercise.
3. **Over-grounded scenarios** — when half the bank is "walk your CFO through…", users hit Shuffle to find something they can actually do right now.

**Authoring canon written:** `docs/prompt-design-canon.md` — the source of truth for every future authoring run. Articulates the three rules (repeatable / mechanic-aligned / vertical-flavored), the three-archetype mix (universal craft / vertical-lensed universal / light scenario at 1/1/1 per triple), tone guidance, difficulty redefinition (50/40/10 with "intro = universally repeatable"), and an author checklist.

### What went wrong with Wave 2 / R3

Briefings pushed sub-agents to use **insider vocabulary** as a role-realism gate:
- Healthcare → SBAR, M&M, sepsis bundle, peer-to-peer prior auth, NSTEMI, Joint Commission
- Law → motion in limine, voir dire, Daubert, FRCP 30(b)(6), Brady, Markman
- Finance → EBITDA bridge, MOIC, IC memo, covenant trip, LBO, continuation vehicle
- Sales → MEDDPICC, ACV, multithreading, security review, deal slippage

That voice IS authentic — to **senior practitioners**. It excludes the actual median user of the app. Concretely:

| Vertical    | Who Wave 2 spoke to       | Who the median user really is                              |
| ----------- | ------------------------- | ---------------------------------------------------------- |
| Healthcare  | Attending physicians      | RNs, NPs, PAs, MAs, RTs, PTs, social workers, residents    |
| Law         | BigLaw partners, AUSAs    | Junior associates, in-house counsel, paralegals, defenders |
| Finance     | CFOs, PE deal teams       | FP&A analysts, controllers, accountants, treasury          |
| Sales       | Sales VPs                 | SDRs, AEs 1-3 yrs in                                       |
| Consulting  | McKinsey partners         | Associates / senior associates                             |
| Education   | Veteran teachers, deans   | Newer K-12 teachers, instructional coaches, TAs            |
| Leadership  | C-suite, founders         | First-time managers, sr. ICs running 1:1s                  |
| Other       | (was broad already)       | (was broad already — fewest gaps)                          |

A 2-year nurse opening Cognify and getting "Defend the sentinel event at M&M" doesn't feel personalized — they feel locked out.

### Two-axis problem

1. **Scenario specificity** — current bank skews toward edge cases (sentinel events, covenant trips, IC defenses). Need MORE everyday situations (shift handoff, status update to manager, explaining a decision to a peer).
2. **Vocabulary accessibility** — even the right scenario gets walled off by acronyms only senior folks know. Need vocab that's universally taught/used in the vertical (e.g. SBAR is fine — every healthcare worker learns it. M&M is not — physicians only).

### Approach options (analyzed)

| Option | Cost | Payoff | Trade-off |
| ------ | ---- | ------ | --------- |
| **A**: Replace existing prompts | ~$30 tokens, 90 min, big | Highest — clean bank | Loses senior-flavored prompts entirely; some users WANT them |
| **B**: Author 3 accessible prompts per (vertical × exercise × goal) on top | ~$15 tokens, 30 min | High — mix improves immediately | Bank grows by 12,960 prompts; picker shuffle averages to "accessible-ish" |
| **C**: Picker bias `preferEasier=true` always when no signal | Free, instant | Low — intro tier of current bank still uses jargon | Doesn't fix root cause |
| **D**: User setting "comfortable / challenging / stretch me" | Medium dev cost | Medium — opt-in tuning | Doesn't help defaults |
| **E**: Smart calibration based on rep performance | Already exists (`preferEasier` when composite < 60) | Marginal until content gap fixed | — |

### Recommendation: **B + E (immediately) → A (later if needed)**

- **Phase F1 — Layer accessible prompts (NOW):** dispatch 8 parallel agents (one per vertical) authoring 3 fresh "median practitioner" prompts per (exercise × goal) triple. ~12,960 new prompts. Each agent gets a sharper briefing that explicitly names the median user, bans jargon walls, and biases toward weekly-everyday situations. Difficulty shifts to **45% intro / 45% core / 10% stretch** (was 30/50/20).
- **Phase F2 — Picker bias (cheap follow-up):** when `recentDimComposite` is null (new user) or `preferEasier` isn't explicitly set, sort the bank `intro → core → stretch` so first 5 candidates lean accessible. This is a 4-line change in `pickPromptCandidates`.
- **Phase F3 — Audit + prune (later):** once the new bank lands, audit which existing Wave 2 prompts are dead weight (no one picks them, or they're too specialist). Prune in a follow-up pass if needed.

### Pilot strategy — TINY first

Max is currently testing on `healthcare` and his feedback is the calibration signal. After two course-corrections (too-senior → too-grounded), we burn one more small pilot to lock the voice before fan-out:

**TINY pilot (NOW):** healthcare, **6 exercises** (one per dimension) × all 10 goals = 60 triples × 3 prompts = **180 prompts**. Quick to author (~5-10 min), quick for Max to spot-check (5 min).

**Healthcare full recalibration:** if pilot voice is right → dispatch the FULL healthcare run (54 exercises × 10 goals = 540 triples × 3 = 1,620 prompts).

**Fan-out to 7 verticals:** if healthcare full voice is also right → dispatch sales / consulting / finance / law / education / leadership / other in parallel, each authoring ~1,620 prompts.

The in-flight Wave 2-style pilot is irrelevant now — its output will be ignored.

### Agent briefing — uses the canon

Every recalibration agent gets the same skeleton:

```
You are authoring Cognify speaking prompts for the [vertical] vertical.

REQUIRED READING (do this first, then refer back constantly):
  docs/prompt-design-canon.md

That doc is the source of truth. Re-read it after every 10 prompts you
author. If a prompt you wrote fails the canon's checklist, rewrite it.

Three rules (from the canon):
  1. Repeatable on demand — no required setup, audience, or context
  2. Exercise mechanic is the path of least resistance — invite the move
  3. Vertical-flavored, not vertical-locked — subject matter not scene

Three-archetype mix per (exercise × goal) triple — write 3 prompts, one of each:
  A. Universal craft — exercises the mechanic, no scenario
  B. Vertical-lensed universal — universal kind of moment, vertical theme
  C. Light scenario — situation kind anyone in vertical encounters daily

Difficulty mix across your run: ~50% intro / ~40% core / ~10% stretch.
"intro" means universally repeatable, no jargon, mechanic is the only challenge.

Length ≤180 chars. Conversational tone. Second-person speech-pulling shape.

For each (exercise × goal) in scripts/gaps/<vertical>.json:
  - Read the exercise's name carefully (it IS the mechanic — e.g.
    "Cut by Half" wants prompts that naturally invite a long answer
    you then cut; "Headline First" wants yes/no or decision questions).
  - Author exactly 3 fresh prompts following the A/B/C archetype mix.
  - Append to the matching exercises[].prompts array in
    scripts/exercise-catalog/v1/vertical/<vertical>.json.
  - Append-only. Don't reorder or rewrite existing prompts.

Validate: no duplicate text within the file. Fix any duplicates.
Write the updated file once at the end (rate-limit hygiene).

Report (≤300 words):
  - Triples covered
  - Prompts authored
  - Difficulty distribution
  - 9 examples (3 of each archetype) so Max can spot-check voice
  - Any triples where the exercise mechanic + goal combo was hard
    to mate (and how you resolved it)
```

### Acceptance

- Healthcare pilot ships, Max spot-checks 5 Shuffle pulls → at least 4 of 5 feel "I'd actually do this at work."
- After full F1 rollout: 8/10 sampled prompts per vertical pass the median test.
- Picker bias F2 lands: new users see intro-first.
- No regression in cascade smoke (still 918/918) or sparse-goals smoke (still 4320/4320 at v+g≥5).

### Files touched
- `scripts/exercise-catalog/v1/vertical/*.json` (data only, append-only)
- `src/server/lib/workout/assignment.ts` → `pickPromptCandidates` (picker bias, F2 only)
- `scripts/seed-vertical-prompts.mjs` (idempotent — reuse)

---

## Phase E — Pre-rep skill scenarios (#12)

**Mechanic:** Before a user starts their first rep on a given skill (per session), show 6–10 real-life scenarios where that skill matters. Anchors *why* they're training this thing.

**Design decisions:**
1. **When to show?** Three options:
   - **First-ever encounter with the skill.** Sticky one-time intro.
   - **First rep of every session on that skill.** Mild repetition; reinforces.
   - **Always available, never forced.** "Why this skill matters →" link on the workout start card.
   
   Recommend: **option 1 + option 3.** Show on first-ever, then keep accessible behind a link for the curious.
2. **Vertical-aware or generic?** Generic V1 (60 scenarios, 10 per skill). Vertical-aware V2 if it lands well (480 scenarios). Start generic.
3. **Surface:** Modal carousel? Vertical scroll on a dedicated `/skill/:dim/why` page? Inline card on the workout start?
   
   Recommend: **inline expandable card on `StartCard.tsx`** the first time the user starts a day for a given dim. Cheap, native to the workout flow, easy to dismiss.

**Content:**
- 10 scenarios × 6 skills = 60. Author in `src/content/skill-scenarios/<dim>.ts` (static TS array — no DB needed).
- Format: `{ title: "Crisis call at 9pm", body: "Your manager calls Sunday night, the launch is broken, and you have 30 seconds to triage." }`.
- Either Max writes these or we dispatch a 6-vertical sub-agent flight (1 per skill, ~10 scenarios each). 1-shot.

**Files:**
- `src/content/skill-scenarios/{clarity,structure,conciseness,thinking_quality,delivery,tone}.ts` (new)
- `src/components/product/workout-shell/SkillScenariosCard.tsx` (new)
- `src/components/product/workout-shell/StartCard.tsx` (mount scenarios card)
- `db/schema.ts` (add `users.scenarios_seen jsonb` to track "shown for dim X")
- `src/server/actions/scenarios.ts` (`markScenariosSeen`)

**Risk:** Low — additive content surface. No existing flow changes.

**Acceptance:**
- First time a user lands on a workout for skill X → scenarios card appears between the start card and the prompt picker.
- After acknowledging once, never blocks again — accessible as a small "Why this skill?" link.
- Telemetry `scenarios.viewed` and `scenarios.dismissed`.

---

## Cross-cutting concerns

- **Feature flags** (`src/lib/flags.ts`): `FF_ASSIGNMENT_V2`, `FF_COMMITTED_STREAKS`, `FF_WEAKNESS_DAY`, `FF_SKILL_SCENARIOS`. Each defaults off in prod, on for Max's user via the flags allowlist.
- **Telemetry:** every new decision/branch writes a structured log via the existing `console.log(JSON.stringify(…))` pattern used in `workout-day.ts`.
- **Tests:** every new pure helper (`isWeaknessDay`, `computeStreakCommitted`, `committedDaysBitmask`) ships with vitest unit tests. The assignment engine already has good unit coverage — extend it for mode=weakness.
- **TZ correctness:** weekly cycle math must honor the user's `users.tz`. Reuse `Phase HC-1`'s TZ groundwork (already shipped per memory: `PATCH /api/me/tz` + client TZ detection).

---

## What we need from Max before executing

These are decisions only Max can make:

1. **A3 contrast:** which button specifically? (screenshot or description.)
2. **D week definition:** calendar week, trailing 7d, or N committed days = cycle? (recommend cycle.)
3. **E surface:** inline card on workout start, modal carousel, or `/skill/X/why` page? (recommend inline.)
4. **Migration of streaks (C2):** are we willing to do a one-time backfill that gives existing users longer streaks (their non-committed-day "misses" are forgiven retroactively)? Almost certainly yes but worth confirming.
5. **Sequencing:** ship Phase A bugs alone first (small PR), or bundle A+B as a "polish" PR before tackling the big mechanic phases?

---

## Suggested execution order

| Order | Phase | Why first |
| ----- | ----- | --------- |
| 1 | A2 (next station) + A3 (contrast) | Lowest risk, smallest PRs, ship same day |
| 2 | A1 (rotation + dashboard label) | Foundation for D, but needs investigation first |
| 3 | B (layout) | Polish — visible, independent |
| 4 | C1 (onboarding days) + C2 (committed streaks) | Foundation for D |
| 5 | D (weakness day) | The big payoff |
| 6 | E (scenarios) | Independent — can be threaded earlier if a sub-agent flight is cheap |

Each phase is its own PR. Flag-gated where it changes existing user behavior. Reversible.
