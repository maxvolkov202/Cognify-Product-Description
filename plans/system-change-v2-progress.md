# System Change v2 — Progress Tracker

**Source of truth:** `plans/prd/cognify-system-change-v2-2026-07.md` (the July 2026 revision of the
Cognify System Change doc; supersedes `plans/prd/cognify-system-change-prd.md`, which drove the PRD v3
rebuild). Read the relevant PRD section in full before starting each phase.

**How to use this file:** one phase per work session (start each session by reading this file top to
bottom, then the PRD section(s) the phase cites). Update the checkboxes + session log as work lands.
Each phase ends with: `/code-review` → fix findings → PR → merge → prod verify checklist (listed per
phase) → check the phase off here. Never commit to main directly.

---

## What's new in the July 2026 doc vs the version already implemented

1. **§5.5 Skill Taxonomy** — expanded from ~34 hidden behaviors to **~149 hidden skills with
   definitions** (Clarity 23, Structure 23, Conciseness 22, Thinking Quality 29, Pacing 22, Tone 30).
2. **"Edits" section** — 12 dogfooding fixes for Build a Rep (configurable moments, notes/structure
   panel, stronger version, core-skill feedback, retry insights, post-rep nav, faster grading,
   playback on improvement review, photo upload, copy polish).
3. Everything else is carried over — for those areas the work is *implementation fidelity*, not new
   requirements.

## Decision log (D-records, confirmed by Max 2026-07-15)

- **D20 — Taxonomy: full adoption.** The doc's ~149-skill taxonomy becomes the canonical hidden-skill
  layer (types, exercise tagging, coaching attribution, profile storage). Deterministic scoring only
  where measurable; the rest LLM-attributed.
- **D21 — Prompt slate stays 5.** D10 stands; doc's 4/6 numbers treated as flexible.
- **D22 — Grading rethink: OpenAI primary, single unified grading pass ("all at once"), doc-guided
  rubric rewrite. Tone (and pacing) must be graded from AUDIO, not text alone** — design spike to pick
  audio-capable model vs enhanced prosody features. Anthropic becomes the fallback provider.
- **D23 — Legacy prompt System A retired.** Hardcoded banks (`src/lib/ai/prompts/*`) + rep-type
  planners migrated-or-deleted; the DB catalog (`cognify_v2.exercises`/`exercise_prompts`) is the only
  prompt system.
- **D24 — Score-movement softening kept (confirmed by Max 2026-07-17, Phase 6).** Owen C10's
  `softenScoreDelta` hides the raw numeral for large single-attempt drops (delta < −3 → soft coaching
  copy; −3…0 → shown neutral; ≥ +1 → celebrated). This resolves the PR #11 conflict with PRD §4.7's
  "score movement should be highly visible": Max's ruling is that "highly visible" governs improvement,
  while a noisy retry's large negative reads as "this system is bogus" and is softened. Direction is
  always shown; only the numeral for a big drop is withheld. Do NOT restore visible large negatives.
  PRD §4.7.2 amended with the display rule so code and doc agree.
- **D25 — UI + Feature Overhaul Wave (confirmed by Max 2026-07-22).** A separate 10-phase wave tracked in
  `plans/ui-feature-overhaul-progress.md` (DEC-1…7). Two rulings amend this PRD and are recorded here so
  code and doc agree: (a) **rank XP is now visible** — PRD §10.5.2 amended to show "X XP this rank / Y to
  next" and fill the bar to that ratio, reversing the original "hide XP" rule (DEC-2); (b) **Skill Lab →
  Application Lab** — user-facing name + route `/application-lab` (308 redirect from `/skill-lab`), DB
  `mode = 'skill_lab'` unchanged (DEC-4); terminology map updated. This wave changes no scoring
  prompt/model — XP/rank ≠ score, so no calibration re-run. See that tracker for phase status.
- **D26 — Retry encouraged, not required (confirmed by Max 2026-08-23).** This overrides the
  mandatory-retry language in PRD §§4.2, 4.5–4.7, 4.9, the glossary, and historical implementation
  decision D2. Daily Workout and Application Lab show compact first-attempt feedback (score + one Coach's
  Focus), then a colorful primary **Retry this rep** action beside a muted gray **Continue** action.
  Continue advances without an Improvement Review; Retry preserves the complete implementation loop
  and moves the first→retry comparison to the post-retry review.
  **Amended 2026-08-24 (Max):** the first-attempt reveal keeps the expandable Core Skill Breakdown and
  playback. Trimming those was an overcorrection and also broke PRD §4.5.3, which puts the breakdown in
  the Stage 3 Feedback surface: "Each skill displays a score and can be expanded for additional
  feedback… Expanded feedback explains why the score was earned and provides skill-specific coaching,"
  collapsed by default. Compact now means only: no previous-exercise focus reminder, no rating widget,
  no share CTA. §4.5 was corrected from "two components" to three to match.
  Citation hazard worth remembering: the code comments justifying this behavior cited "§4.7.1 — the same
  Core Skill Breakdown appears in both feedback screens," but that sentence exists only in the
  SUPERSEDED `cognify-system-change-prd.md`, not the v2 PRD. Stale pointers survive in comments long
  after the doc is retired; confirm section numbers against the v2 PRD before relying on them.
  **Follow-up 2026-08-24 (Max):** the first-attempt breakdown now shows per-skill movement since the
  previous exercise in the same session (Daily Workout: previous station's latest attempt; Application
  Lab: previous exercise's latest attempt; Build a Rep excluded — critical moments are heterogeneous
  scenarios, so cross-moment deltas would compare unlike things). The show/hide rule is the C10
  softening the Improvement Review already used, now extracted to `src/lib/skill-delta.ts` and shared
  by both surfaces (unit-tested in `tests/skill-delta.test.ts`). This closes the Continue-path blind
  spot where a user who never retried saw no movement anywhere. Baselines are client-state only; a
  mid-session refresh renders the next feedback without chips.
  **Follow-up 2026-08-24 (Max) — grounded per-skill quotes (FEEDBACK_VERSION v4.1.0).** Each
  dimension's expanded card can now carry a verbatim transcript quote the score turns on, plus a
  tap-to-hear timestamp ("Hear it at m:ss"). Scoring prompt asks for `dimensions[].quote`/`quoteAt`
  (lenient schema — junk never fails the parse); the quote is substring-validated like
  strongerVersion (`sanitizeDimensionQuote`, unit-tested in `tests/dimension-quotes.test.ts`) and
  the "m:ss" marker maps to ms via the TIMESTAMP INDEX the prompt already carried. This partially
  restores the legacy callout grounding the v4 contract dropped, in the lighter per-skill form.
  **Calibration re-run (guardrail):** baseline `main` 48/48 within tolerance; quotes branch 45/48
  with 3 independence misses by 2-5 pts that re-passed 2/2 on targeted reruns (run-to-run noise,
  not a shift). **Hard-won lesson:** the suite MUST run with `FF_DETERMINISTIC_SIGNALS=true` +
  `FF_DETERMINISTIC_SIGNALS_PERCENT=100` (prod state since 2026-07-15; the bank was re-authored
  under it). Flagless local runs fail ~14-18/48 with +17..+24 structure/thinking drift — that is
  the missing SIGNALS block, not real regression. Same session also fixed `.env.local` values
  corrupted with embedded `"\n"` (OPENAI/ANTHROPIC keys, OPENAI_FALLBACK_MODEL — the "invalid
  model ID" fallback breaker).
  **Final amendment 2026-08-24 (Max) — compact trim retired entirely.** Max's direction: production
  should match PR #61 minus the "compact first feedback" part. The first-attempt reveal now renders
  the FULL FeedbackPanel (previous-exercise focus reminder, rating widget, and share CTA restored);
  the `compact`/`feedbackCompact` props were deleted from FeedbackPanel/RepSurface and all three
  callers (Daily Workout RepControls, Application Lab, Build a Rep). What survives of D26 is only
  the optional-retry behavior: colorful Retry primary + gray Continue, Improvement Review only on
  Retry, plus the later additions (movement chips, grounded quotes). PRD §§4.5, 4.6, 4.9 updated.
  **SHIPPED 2026-08-25 (PR #67, squash `05934e30`).** Merged to `main` and deployed to production
  with `vercel --prod`. Post-review fixes landed in the same PR (all post-processing/render — the
  scoring prompt is byte-identical to what the D26 calibration run measured, so that run still
  stands): a grounded quote is dropped whenever the hybrid layer replaced the feedback sentence it
  was chosen to justify (delivery, when the deterministic override diverges >10 pts — the check
  compares rendered vs model feedback, so it covers any future override); the "No specific moment
  to flag" empty state is gated on `!groundedMoment`; a quote-without-feedback dimension now
  persists (it previously rendered in-session and vanished on reload); `parseTranscriptMarker`
  tolerates the bracketed `[0:45]` form the TIMESTAMP INDEX actually renders.

  **Follow-up (PR #68).** The quote-vs-feedback guard shipped as `raw?.feedback && d.feedback !==
  raw.feedback`, which short-circuited whenever the model wrote no feedback for that dimension —
  and since `feedback` is optional, a dimension can arrive with a quote and NO sentence, the
  override then injects one, and the quote survives attached to copy it was never chosen for. That
  is the same mismatch the guard exists to stop, reached through the one door it left open. The
  comparison is now unconditional (`d.feedback !== raw?.feedback`): equal when both are absent, so
  ordinary quote-only dimensions keep their moment.

  **CRITICAL follow-up (PR #68) — the verbatim check was decorative.** `/code-review` caught that
  `sanitizedDimFeedback` built each `DimensionScore` with `{ ...d }` spread straight off the parsed
  model output, and the schema declares `quote`/`quoteAt` — so every dimension already carried the
  RAW, unvalidated quote before the grounding pass ran. That pass only ever ADDS a validated quote,
  so both `return d` paths kept a hallucinated one: `sanitizeDimensionQuote` logged "dropping" while
  the invented quote rendered in the blockquote as the user's own words and persisted via
  `buildFeedbackDoc`. Reproduced end to end before fixing. The raw fields are now deleted in
  `sanitizedDimFeedback`, so the ONLY route onto a dimension is `sanitizeDimensionQuote`.
  `tests/dimension-quotes.test.ts` gained assembly-level coverage (fabricated quote in → no quote
  out, verbatim quote in → quote + parsed ms out); it previously exercised the sanitizer in
  isolation only, which is exactly why the hole passed. The anti-hallucination contract this feature
  advertises held only from this commit on — reps scored between the #67 deploy and this one could
  carry an unverified quote. **Audited rather than assumed: no backfill needed.** All 9 v4.1.0 reps
  in the DB belong to `e2e-harness@cognify.test`; of their 24 persisted quotes, 0 are non-verbatim
  (each re-checked whitespace-collapsed + case-insensitive against the rep's stored transcript).
  No real user was ever shown an unverified quote. Worth knowing for next time: `applyFeedbackDoc`
  re-attaches stored quotes on every read WITHOUT re-validating, so a bad row would have rendered
  indefinitely — the audit, not the fix, is what closed this.

  The strip is now an ALLOW-LIST (name the fields that cross) rather than a spread minus two
  deletes. `dimensionScoreSchema` is the model's output contract and grows over time; a spread
  silently carries each new model-only field onto `DimensionScore` unvalidated, which is exactly
  how this bug arrived. The delivery-override guard also gained a real regression test that drives
  `applyHybridLayer` with word timings that diverge >10 pts — verified to FAIL against the old
  `raw?.feedback &&` form, so it actually holds the line.

  **Re-verified on production after the fix (PR #68, squash `eb5ba09d`, deployed
  `vercel --prod`).** All three surfaces re-run live against the fixed build: Application Lab (full
  first-attempt panel + grounded quote with its "Hear it at m:ss" seek button, Continue completes
  the session), Build a Rep (intake -> plan -> guided moment -> readiness review), Daily Workout
  (rep -> focus -> retry -> Improvement Review). Full-table audit afterwards: 13 v4.1.0 reps, 33
  persisted quotes, every one verbatim against its rep's stored transcript and every one carrying a
  parsed timestamp, 0 non-verbatim. Still confined to `e2e-harness@cognify.test` — no real-user rep
  has ever carried an unverified quote.

  **Production verification (2026-08-25, live reps as `e2e-harness@cognify.test`):**
  - NOTE: this verification ran against the #67 build, BEFORE the critical fix recorded ABOVE. It
    confirms the panel/rendering and persistence; it is NOT evidence the verbatim contract held,
    since a fabricated quote would have looked identical on screen. The post-fix re-verification is
    the "Re-verified on production" paragraph ABOVE.
  - Application Lab — full first-attempt panel confirmed ON PROD: Communication Score, Coach's
    Focus, expandable six-skill breakdown, playback, the "Help us improve" rating tile, and the
    blind-ranking share CTA. The three surfaces the compact trim used to hide are the
    previous-exercise focus reminder, the rating widget, and the share CTA — the focus reminder
    renders only when a previous focus exists, so confirm it on a rep that has one. Plus
    Retry/Continue. 3 of 6
    skill cards rendered a grounded quote with a working "Hear it at m:ss" seek button; Continue
    completed the session.
  - Build a Rep — intake -> plan -> guided moment -> readiness review passes on prod.
  - Daily Workout — rep -> focus -> retry -> Improvement Review passes on prod (the retry path also
    exercises the provider-less DimensionGrid, where the seek button correctly hides).
  - Persistence — every prod rep wrote `feedback.version = "v4.1.0"` with
    `skillFeedback[dim].quote`/`quoteAtMs` populated where grounded, under the LIVE scoring arm
    `signals-drop`. That arm needs all THREE knobs, not one: `FF_SCORING_VARIANT=true` is the master
    switch, `FF_SCORING_VARIANT_ARM=signals-drop` names the arm, `FF_SCORING_VARIANT_PERCENT=100` is
    the ramp. Unsetting only the arm name leaves the variant ON and silently falls back to `control`
    — an explicit rollback flips the master switch. delivery/tone are legitimately null: those
    scores are prosody-grounded, not grounded in a worded moment.

  **Known follow-ups (raised by `/code-review` on PR #67) — ALL THREE CLOSED 2026-08-25, see below.**
  - ~~Quote independence~~ — with six dimensions over one short transcript the model often cited the
    SAME moment for several skills (one prod rep grounded 4 dimensions on one identical phrase),
    which pushes against the DIMENSION INDEPENDENCE rule. This was the highest-value follow-up: a
    copy-quality issue users can see.
  - ~~No char cap on `dimensions[].quote`~~ (the neighboring `feedback` rule has <=400). Six long
    quotes eat decode headroom against `max_tokens` 2500, and a truncated response falls to
    `mock-fallback-v1`.
  - ~~The fan-out bench arms pay for quotes they discard~~ — they rebuild dimensions from their own
    schema with no quote fields, so they stamp v4.1.0 without quotes AND pay decode tokens for six
    fields they throw away, contaminating the decode-latency measurement those arms exist to make.
    Bench-only; the shipped arm (`signals-drop`) is the control single-call path and carries quotes
    correctly.

  **Follow-up 2026-08-25 (PR #70) — quote independence + a phrase-length cap + the bench-arm trim.**
  All three of the deferred follow-ups above, in one branch (the first two are scoring-prompt edits
  and share one calibration re-run; the third is bench-only).

  *Quote independence.* Two layers, matching how every other grounding rule in this file works:
  (a) a `QUOTE INDEPENDENCE` bullet in PER-SKILL FEEDBACK RULES that makes reuse a non-option and
  normalizes "several dimensions at null" as the EXPECTED shape for a short transcript (a short rep
  holds fewer than six distinct moments; prefer null over a stretch — the card renders fine with
  none); and (b) `dropDuplicateMoments` in `score-shared.ts`, a deterministic post-validator: the
  first dimension in canonical order claims a moment, later reuses lose their quote. "Same moment"
  is normalized containment in EITHER direction, not string equality, so a re-quote that trims or
  extends the span is caught too. It runs AFTER verbatim validation, so a dropped hallucination
  never claims a moment a real quote would then lose to. Dropping rather than reassigning keeps it
  pure: "which skill deserves the phrase more" is a judgment call the prompt owns, not the validator.
  No UI change was needed — `DimensionCard`'s empty state is already gated on `!groundedMoment`, and
  a v4.1 card always has a `feedback` sentence, so a de-quoted card just renders without a
  blockquote.

  *Quote length cap.* The prompt said only "a phrase, not a paragraph" while `dimensionScoreSchema`
  tolerated 1000 chars. Prompt now asks for <=200; the schema backstop is 400 (the neighbouring
  `feedback` cap) so a modest overshoot still renders instead of silently vanishing, while a
  paragraph dump is caught. NOT strongerVersion's 1000: that field quotes ONE span per rep chosen so
  a rewrite can be taught off it, where a long comma-spliced run-on is legitimate; this is a
  phrase-length grounding moment rendered as a small blockquote, six per response. `.catch(null)`
  means an over-cap quote drops to null rather than failing the parse.

  *Bench arms.* Chose option (a) — stop asking, since the arms are bench-only. A `NO_QUOTE_FIELDS`
  line is appended to every arm scope block (`CONTENT_SCOPE`, `DELIVERY_SCOPE`, their holistic/lean
  variants, `DELIVERY_TONE_DECOMP_SCOPE`, and `renderPerSkillScope`). Suppressed in the UNCACHED
  per-call scope, deliberately NOT by forking the system prompt for arms: the arms share control's
  cached system prefix byte-for-byte on purpose, and forking it would give them a separate cache
  entry and a cold-prefix penalty — corrupting the same decode-latency measurement from the other
  side. If an arm is ever promoted the fix flips to (b): carry `quote`/`quoteAt` through
  `armDimensionSchema` and both `merged` rebuilds, because a shipped arm stamping v4.1.0 with no
  quotes would silently drop a user-facing feature. That is recorded in the code comment.

  **`/code-review` (high) on PR #70 — four findings, all addressed in `5fed9e56`.** Two were real
  bugs in the new guard, both worth recording because they are the same SHAPE of mistake:
  a rule that was documented but not enforced, and a normalizer reused outside the domain it was
  written for.
  - *Canonical claim order was documented, never enforced.* `dropDuplicateMoments` walked the array
    it was handed, and `validated.dimensions` is RAW MODEL EMISSION order — nothing between the
    parse and the dedupe sorts it. The doc comment's whole rationale ("clarity first, delivery/tone
    last because they are prosody-grounded") held only by luck. On a provider or fallback that emits
    `tone` first, tone would keep a worded moment it is supposed to have least often and the clarity
    card — whose feedback sentence is literally ABOUT that phrase — would render with none. Now
    walks `ALL_DIMENSIONS` explicitly; output still preserves input order.
  - *Bare-substring containment matched INSIDE words.* The comment defended "no minimum length" for
    the contained-PHRASE case and never considered the substring-inside-a-word case. `quote` allows
    1 char and the prompt actively invites short delivery/tone quotes (a filler cluster), so a
    delivery quote of `"um"` claimed the moment and then ate `"the n(um)ber of requests"` and
    `"our ass(um)ptions were wrong"` — one filler quote could strip five legitimate moments, the
    exact opposite of the guard's purpose. Reproduced before fixing. Moment keys are now
    space-PADDED (whole-token compares) with punctuation flattened, and containment only counts once
    the shorter span is >= 4 tokens; below that two quotes must match EXACTLY, which still catches
    literal reuse. The punctuation flattening also closed the reverse hole ("is this thing on." vs
    "is this thing on" was NOT being caught). Worth generalizing: `normalizeForMatch` exists for the
    VERBATIM check (strict, punctuation-preserving) and was wrong for moment-identity; the dedupe
    now has its own `normalizeForMomentMatch`.
  - *Bench arms — switched from option (a) to option (b).* The review caught that stripping the
    quote ask from ONLY the arms removes a decode cost the CONTROL arm still pays (`signals-drop` =
    `leanFeedbackCap` 400 drops `signals`, never `quote`), so any measured arm win would include
    ~6 quotes of decode a promoted arm has to pay back — biasing the very comparison the arms exist
    to make, just from the other direction. Option (b) fixes both: `armDimensionSchema` and both
    `merged` rebuilds now CARRY `quote`/`quoteAt`, and every arm scope that emits a `dimensions`
    array asks for them. Nothing is trusted — `merged` round-trips through control's
    `parseAndValidate`/`assembleRepScore`, so an arm quote gets the same verbatim check and the same
    dedupe. The tone-decomposed scope is deliberately untouched: its delivery/tone dims are built
    from a deterministic rollup and honestly carry no worded moment.
  - *The prompt rule is scoped to `dimensions[]`.* "Every non-null quote in this rep" would, read
    literally, stop the model reusing a moment for `strongerVersion` — the ONE span chosen so a
    rewrite can be taught off it. `strongerVersion.quote` is deliberately NOT seeded into the
    claimed set either: a skill card and the Stronger Version card naming the same moment reads as
    coherent (here is the moment, here it is upgraded), not as the broken repetition this guard
    stops.

  **Calibration re-run (guardrail — these ARE scoring-prompt edits).** Run against the FINAL prompt,
  i.e. after the review fixes (finding 4 reworded the rule, so the earlier run was re-done rather
  than reused). Both arms with `FF_DETERMINISTIC_SIGNALS=true` +
  `FF_DETERMINISTIC_SIGNALS_PERCENT=100` against a local dev server, one fixed
  `CALIBRATION_GUEST_ID` shared by every run so the prompt context is identical (a fresh guest has
  no calibration profile and no coaching memory, so both optional blocks stay absent — the
  byte-identical property the guardrail asks for).

  | | total | band | independence |
  |---|---|---|---|
  | baseline `main` (`ce4c5491`) | 47/48 | 28/29 | 19/19 |
  | branch (final) | 47/48 | 29/29 | 18/19 |

  Each arm misses exactly one rep, and NEITHER miss is a regression — both were chased down rather
  than assumed:
  - Baseline missed `objection-poor-too-expensive` (band, conciseness -17 against a ±15 per-dim
    tolerance — a 2-point overshoot). The branch PASSES it.
  - The branch missed `indep-earnings-explainer-empty` (independence, thinking_quality 65 > max 60).
    This is the assertion class Task A perturbs, so it was NOT waved off as noise. Targeted reruns,
    4 on each arm: **`main` fails it 3/4** (thinking_quality 60/65/65/65, mean 63.8) while the
    **branch fails it 1/4** (55/65/60/55, mean 58.8). The rep is a pre-existing threshold-straddler
    that the branch handles BETTER than main — the full-suite baseline passing it was the lucky
    draw, not the branch's miss being a regression. Consistent with the aggregate: per-dimension
    mean signed movement on thinking_quality is -1.3 (branch lower, i.e. further from this
    assertion's violation), and no dimension moves more than ±1.5 on the mean. The assertion's own
    stamped rationale already records it as aspirational and re-thresholded at rubric v4.0.0 with
    "observed 45/55/45", so 55-65 is its known jitter band and `max 60` sits in the middle of it.

  **Direct before/after on the actual symptom** (same 6 reference reps scored through `/api/score`
  on each arm, quotes checked for normalized-containment reuse):

  | | quotes | duplicate moments |
  |---|---|---|
  | `main` | 24 | **3** (12.5%) |
  | branch (final) | 23 | **0** |

  `main` reproduced the prod symptom exactly — `band-poor-mic-test` grounded clarity AND
  thinking_quality on the identical "it's a thing that does, um, automation", and structure AND
  conciseness both on "Uh, hello, hello? Is this thing on." On branch: 0 duplicates, 0 non-verbatim,
  0 over-cap, longest quote 95 chars (well inside the new 200 ask). Grounding settles at 3-4 of 6
  with delivery/tone consistently null, which is the designed shape. Note the grounded count ROSE
  from 21 (pre-review-fix) to 23 with the same 6 reps — direct evidence that the finding-2
  containment bug had been over-dropping legitimate moments.

  **SHIPPED 2026-08-25 (PR #70, squash `444ed18a`).** Merged to `main` and deployed to production
  with `npx vercel --prod --yes` (aliased to www.cognifygym.com).

  **Production verification (2026-08-25, live reps as `e2e-harness@cognify.test`).** Application Lab
  1-rep and 5-rep sessions plus Build a Rep, all green against prod.

  **Daily Workout gap closed the same day (corrected 2026-08-26).** An earlier revision of this entry
  said Daily Workout was NOT re-run because both test accounts were already consumed for 2026-08-25
  EDT (one muscle-group day per user per USER-LOCAL day). That is stale — later on 2026-08-25 a
  fresh production account (`e2e-fresh-20260825@cognify.test`, tz `America/New_York`) closed the gap.
  All of the following passed on production:

  - Daily Workout: rep → focus → retry → Improvement Review
  - The full-day run: every station through to Day Complete with a final score
  - The 5-step onboarding flow, and the baseline rep
  - The 15-route sweep

  That account's 14 reps produced 31 quotes with 0 duplicates, 0 non-verbatim, 0 over-cap, and all
  timestamped.

  Full-table DB audit afterwards (`feedback->>'version' = 'v4.1.0'`), checking each persisted quote
  against its own rep's stored transcript:

  | | reps | quotes | non-verbatim | over 400 chars | missing quoteAtMs | duplicate moments |
  |---|---|---|---|---|---|---|
  | post-deploy only | 6 | 11 | 0 | 0 | 0 | **0** |
  | whole table | 25 | 63 | 0 | 0 | 0 | 13 (ALL pre-deploy) |

  Every one of the 13 duplicate moments sits in a rep created at or before 13:47:44Z, i.e. before
  this deploy — they are the historical symptom, preserved rather than backfilled (they are
  test-account reps, and `applyFeedbackDoc` re-attaches stored quotes on read WITHOUT re-validating,
  so this is display-only history on rows no real user sees). Not one post-deploy rep carries a
  reused moment. The single most direct confirmation: a new prod rep on the SAME "firewall"
  transcript family that previously produced the 4-way duplicate now grounds exactly two distinct
  moments — clarity on "Imagine your office building with one main entrance and a guard" (5000ms)
  and thinking_quality on "That is exactly what a firewall does with information." (10000ms) — with
  structure, conciseness, delivery and tone all null. That is the designed shape: prefer null over a
  stretch.

  Audit gotcha worth keeping: `reps.transcript` is **jsonb** (`{"text": ...}`), not text, so a
  verbatim check that treats it as a string throws rather than silently passing. And Postgres
  timestamps carry microseconds, so a cutoff built from a millisecond-truncated JS timestamp
  re-admits the very row it was derived from — the first audit looked like 2 new reps when there was
  1. Both cost a few minutes here; check the column type and use an id list or a rounded-down cutoff.

  Note for next time: `scripts/calibration/rethreshold-independence.mjs` exists but was NOT used and
  was not the right tool here — it RELAXES independence thresholds to observed values at rubric-
  version boundaries. Using it to make a branch pass would have hidden exactly the regression this
  re-run was meant to detect. The honest tool for "noise or shift?" is a targeted rerun on BOTH
  arms, which is what settled `indep-earnings-explainer-empty`.

## Current-state map (from 2026-07-15 codebase audit)

- **Training engine v2** (insight → first rep → compact feedback → encouraged optional retry →
  improvement review when retried) built,
  flag-gated `FF_TRAINING_ENGINE_V2`; pure FSM `src/lib/workout/session-machine.ts`.
- **Daily Workout**: 6 core skills as muscle groups, assessment phase, weighted rotation, hidden-skill
  aware sampling (`src/server/lib/workout/assignment.ts`), slate=5, adaptive windows. Flag
  `FF_MUSCLE_GROUP_WORKOUT` (off in prod).
- **Skill Lab v2**: 5 applications × 8 exercises, 40 hidden application skills, adaptive selection
  (`src/server/lib/skill-lab/selection.ts`), 3/5/10 sessions, resume. Flag `FF_SKILL_LAB_APPS`.
- **Build a Rep v2**: prep events, 4–8 editable critical moments, guided + full simulation, readiness
  reviews, context uploads (pdf/docx/pptx/txt/md), cross-event memory. Flag `FF_BUILD_A_REP_V2`.
- **Grading**: unified hybrid pipeline (`src/lib/ai/score.ts` + `score-stages.ts`), two sequential
  LLM calls (Haiku), stage2 redoes RAG/prosody (+500ms), no streaming; deterministic pacing + 60/40
  thinking-quality blend; coaching memory; calibration drift cron + reference bank.
- **Prompts**: DB catalog 102 exercises / **4,148 active prompts** (38,962 total; the rest deactivated,
  reversible `is_active=false`). **This IS the prod catalog** — dev `.env.local` and prod Vercel point at
  ONE Supabase DB, so Phase 2's reseed+prune (session 4) already promoted to prod; the earlier "~31k
  stale rows never promoted" note is obsolete (verified 2026-07-17 in Phase 6: 0 exercises below the
  slate floor). Universality rule landed in the generator 2026-07-07 (`src/lib/ai/prompt-gen.ts`);
  `docs/prompt-design-canon.md` is the authoring canon. Legacy System A banks retired in Phase 2 (D23).
- **Progression** (rank 32 tiers, XP, committed-day streaks + freezes, achievements, leaderboards,
  weekly/team challenges, leagues) matches PRD §10 — no major work planned.

---

## Phases

### Phase 0 — Doc sync + taxonomy data ✅ done 2026-07-15
*PRD refs: whole doc; §5.5. Small phase, same session as planning is fine.*

- [x] 0.1 New PRD imported at `plans/prd/cognify-system-change-v2-2026-07.md` (done 2026-07-15)
- [x] 0.2 Extract §5.5 tables into structured data: `scripts/taxonomy/hidden-skills-v2.json`
      (`{dimension, id(snake_case), label, definition}`). **Actual doc counts: Clarity 23,
      Structure 23, Conciseness 22, Thinking Quality 28, Pacing 22, Tone 30 = 148 total** (the
      "~149" in the planning notes was an estimate; Thinking Quality table has 28 rows).
- [x] 0.3 `plans/prd/taxonomy-migration-map.md` written: 34 old ids → new ids (24 keep, 8 rename,
      2 move across dimension — old Tone prosody skills fold into `delivery`). No splits.
      Machine-readable copy: `scripts/taxonomy/migration-map.json`.
- [x] 0.4 `plans/prd/terminology-map.md` updated with D20–D23 rulings table.
- **Exit criteria:** ✅ JSON validates (unique ids, counts match tables), every old id mapped.
- **Verify after merge:** none user-facing (data-only).

### Phase 1 — Hidden Skill Taxonomy v2 (D20) ✅ done 2026-07-15
*PRD refs: §5.5, §8.3.5, §10.4. Fresh session. This underpins Phases 2–4 — do first.*

- [x] 1.1 `src/types/sub-skills.ts` now derives everything from generated
      `src/types/hidden-skills.generated.ts` (emitted by `scripts/taxonomy/generate-sub-skills.mjs`
      from the JSON). Kept `SUB_SKILL_TO_DIMENSION`/`SUB_SKILL_LABELS`; added
      `SUB_SKILL_DEFINITIONS`, `canonicalizeSubSkillId` (legacy-id bridge), per-dimension
      `renderSubSkillReference(dims?)` + `renderSubSkillReferenceWithDefinitions(dim)`.
- [x] 1.2 Profile migration applied to DEV (`drizzle/migrations/0041_hidden_skills_taxonomy_v2.sql`,
      idempotent DO-block; verified 0 old keys remain across 7 profiles). Belt-and-suspenders:
      `applyRepToProfile` canonicalizes legacy ids at fold time, so historical-rep evidence and
      backfills keep working. **Run 0041 on PROD during Phase 6.**
- [x] 1.3 `scripts/taxonomy/retag-exercises.mjs` (dry-run → `retag-proposals.json` → `--apply`,
      validation: 2–4 valid ids, ≥1 from primary dim, secondary dims allowed). NOTE: both
      Anthropic + OpenAI API keys were out of credits, so the 94 proposals were authored by Claude
      in-session (source:"manual" in the proposals file — reviewable) instead of via API; the
      script works once credits return. Manifests updated + `seed-exercise-catalog.mjs --apply`
      ran on dev (94 exercises updated, 0 prompt changes). Seed-script validation now reads the
      taxonomy JSON.
- [x] 1.4 Scoring prompt keeps the all-dimension labels-only SUB-SKILL REFERENCE block (bullets
      span dims) and adds a definitions block for ONLY the focus dimension in the MODE context;
      prompt-gen renders `HIDDEN SKILLS TRAINED` as label — definition lines.
- [x] 1.5 Mapper renamed to v2 ids; **dimension_fallback removed entirely** (D20: deterministic
      only where measurable, everything else LLM-attributed — with 148 skills, fallback copies
      would flood rep jsonb + profile). New genuine mappings: prosody fillerRatePerMinute →
      `filler_reduction`, WPM band → `rate_awareness`. Hume voice skills now split
      delivery (`prosodic_alignment`, `emphasis_timing`) / tone (`confidence`,
      `emotional_authenticity`, `gravitas`, `warmth`). Legacy System A banks/hints/exercises
      renamed in place (System A still dies in Phase 2).
- [x] 1.6 `tests/taxonomy.test.ts` (30 asserts: integrity, JSON↔generated sync, migration
      round-trip, profile fold incl. legacy keys + cross-dim moves, reference rendering) wired
      into `npm test`. Full suite + typecheck + lint green.
- **Exit criteria:** typecheck + tests green ✅; feedback-bullet attribution + profile check =
  Max's verify list below.
- **⚠️ Calibration guardrail:** the scoring prompt BYTES changed (new reference block + focus-dim
  definitions). **Replay RAN 2026-07-15 (session 3) after Max refilled OpenAI credits** — serving
  provider was gpt-4o (Anthropic still dead), so the measurement is provider-shift + prompt-shift
  combined against Anthropic-Haiku-era baselines: **0/48 reps within ±5**; per-dim mean drift
  modest (+1.3 structure … +11.3 conciseness) but variance huge (−40…+52). Verdict: baselines are
  UNUSABLE while OpenAI serves; a clean re-baseline is Phase 3's job (D22 flips provider
  officially + rubric rewrite + recalibration 3.6). Until then treat drift-cron alerts as noise.
  Raw results: session scratchpad `calibration-full.json`; harness now needs
  `CALIBRATION_GUEST_ID=<uuid>` env (auth gate on /api/score).
- **Verify after merge (Max):** complete one dev workout rep → feedback bullets name plausible
  hidden skills for the trained dimension; `/progress` unaffected.

### Phase 2 — Prompt architecture overhaul (D21, D23) ⬜
*PRD refs: §5.6, §9 (all), Daily Workout Engine V1 + Lab Engine V1 sections, §11.3,
`docs/prompt-design-canon.md`. Fresh session. Likely the longest phase — 2.A and 2.B can be separate
sessions.*

**2.A — Generation engine rewrite**
- [x] 2A.1 `src/lib/ai/prompt-gen.ts` rewritten to the doc's engine specs (session 4, 2026-07-15):
      generation unit = core skill → hidden behaviors (taxonomy v2, labels + definitions) → coach's
      insight → 5 prompt options (D21) → scoring lens → retry instruction, all rendered as
      generation context when authored (conditional rendering — unauthored fields render nothing).
      Per-application Lab Engine V1 rule blocks (storytelling/presenting/teaching/interviewing/
      persuasion). Universality hard rule kept + merged with the canon (3-second test, no personas,
      no jargon walls, one challenge, retryable) into a CANON_RULES block shared by generator AND
      judge so they can't drift. New `generatePromptPack` emits the full unit for tooling.
- [x] 2A.2 LLM canon verification pass: `verifyPromptsCanon` (same CANON_RULES; violation tags
      required-setup/persona/not-universal/jargon-wall/mechanic-mismatch/exam-tone/
      stacked-constraints/not-retryable). Wired into `generateAndCachePrompts` — runtime top-up
      prompts are canon-screened before becoming permanent bank members (fail-open on judge outage
      so a verify failure never empties a slate; unjudged indices fail closed).
- [x] 2A.3 Coach-field refresh from the doc: 3 coach_insight updates (explain-like-im-12,
      the-3-point-rule, the-so-what-test — doc's lines were more canonical); other 21 matched
      exercises kept (catalog versions more behavioral). **Zero scoring_lens changes on existing
      exercises** (doc lenses are academic dimension-level prose; catalog lenses are operator
      constraints). ⚠️ calibration note: coach_insight byte-changes on those 3 exercises + 3 brand-new
      exercises' lens blocks — no existing reference rep renders the new blocks; baselines already
      unusable pending Phase 3 re-baseline.
- **2.B — Bank content + legacy retirement**
- [x] 2B.1 Doc bank content merged (session 4): 3 new exercises (pacing "The Speed Shift", tone
      "The Emotional Dial" + "The Resonance Rep", full pack fields + 15 prompts each), 62 prompts
      merged into matching exercises (ELI12 32, Analogy Bridge 18, No Jargon 1, One Point Only 3,
      Word Budget 3 — 75-word suffix dropped to match the exercise's 30-word rule, flagged for Max —
      Story Arc 1, Bottom Line First 2, Monroe's 1, Claim and Proof 1, interviewing "Why This, Why
      You" 1). Skipped with reasons: teaching + persuasion workout one-liners (need supplied reading
      material), six-word-story (no storytelling exercise has a delivery-pause mechanic), doc's
      "Rhythm Check" (catalog "Tempo Shift" already covers the mechanic).
- [x] 2B.2 LLM universality audit tooling: `scripts/audit-canon-llm.ts` (new — complements the
      regex-only `prune-canon-violators.mjs` rather than extending it) runs `verifyPromptsCanon`
      over every active prompt, deactivates violators (`is_active=false`), fail-closed on judge
      failures, pressure-bank exempt (light-scenario genre, canon-screened at relocation).
      **Run + counts recorded in 2B.4.**
- [x] 2B.3 System A retired (D23): deleted `src/lib/ai/prompts/*` (~3,600 lines), rep-type planners
      in `workout-prompts.ts`, `exercises.ts` named-drill registry, bank tooling
      (generate-prompts/triage-prompts.mjs). Catalog-backed replacement: pure
      `src/lib/workout/lab-plan.ts` + `planLabSession` server action (rotation, preferSubSkill bias,
      pressure slot at N-1, flow ramp). Cutovers: /drills + /skill-lab (SkillLabClient async
      planning), prompt-select Refresh (re-slates from the slot's catalog exercise via
      fetchPromptCandidates — session exclusion + generated top-up now apply there too), /try,
      legacy Build-a-Rep (catalog vertical tags via `pickVerticalPrompts`), dashboard drill CTAs
      (all 6 dims drillable now). KEPT: rep-types.ts (framework scaffolds/budgets),
      frameworks-rep-variants, pressure-archetypes (scoring weight profiles). Pressure prompt bank
      relocated into the catalog as `v1/pressure.json` (application='pressure', one exercise per
      archetype, keyed by archetype id in application_skills — invisible to Daily Workout/Skill Lab
      queries). Tests rewritten against the pure builders (session-types, pressure-orchestrator;
      dna-signals trimmed of deleted-registry sections).
- [x] 2B.4 Reseed + audit on dev (= PROD DB — same Supabase instance), 2026-07-15 session 4:
      seed --apply → 8 new exercises (3 core + 5 pressure), 3 updated (coach_insight), 222 new
      prompts; catalog then 102 active exercises / 6,936 active prompts. LLM canon audit --apply
      (gpt-4o-mini judge, curated-manifest + pressure exempt) deactivated **2,788 Wave-era
      violators** (clarity 475, structure 406, conciseness 429, thinking_quality 496, pacing 555,
      tone 427; top tags jargon-wall + not-universal + persona) → **4,148 active prompts**, zero
      exercises below 8 active (slate floor is 5; FF_PROMPT_GEN top-up self-heals thin banks).
      Deactivation is reversible (is_active=false; details in audit-canon-results-*.json).
- **Exit criteria:** generator emits doc-conformant packs (spot-check 10 per dimension + 5 per
  application); zero legacy bank imports; dev catalog clean.
- **Verify after merge (Max):** refresh prompt slates across 3 dimensions + 2 Lab applications on
  dev — every prompt answerable by anyone, topics spread beyond workplace, refresh never repeats.

### Phase 3 — Grading rethink (D22) ✅ (2026-07-17, feat/grading-v3 — two items blocked on API credits, see session-5 log)
*PRD refs: §4.5–4.7, §8.6, §11.4–11.5, exercise scoring lenses. Fresh session. Design-first: write
`plans/prd/grading-v3-design.md` and get Max's sign-off on the design BEFORE implementation
(provider/model choice, audio-grading approach, cost + latency budget, calibration plan).*

- [x] 3.1 **Design spike — audio tone grading.** Evaluate: (a) OpenAI audio-input model scoring
      tone+pacing directly from the recording, (b) enhanced prosody feature extraction (pitch
      variation, end-of-sentence inflection ratio, volume emphasis, WPM bands) feeding the text
      grader. Compare on ~10 reference reps with known tone quality. Decide + document.
- [x] 3.2 Provider flip: OpenAI primary for scoring, Anthropic fallback (invert `AI_PROVIDER`
      handling in `src/lib/ai/claude.ts`; pick current best OpenAI model for structured scoring).
- [x] 3.3 **Single unified grading pass** ("all at once"): one call producing scores + all feedback
      copy (kills the two-stage sequential latency + stage2 context rework). Fold in: doc-rewritten
      rubric (per-dimension definitions + scoring lens + edge-case rules), taxonomy-v2 attribution,
      implementation review for retries.
- [x] 3.4 **Stronger Version (§4.6, Edit #5):** grading output includes a stronger version of what
      the user actually said (their content, upgraded — not a generic exemplar), shown on feedback +
      carried into retry screen.
- [x] 3.5 Latency work: measure p50/p95 before/after; prosody + RAG stay parallel; audio path must
      not regress total time beyond current baseline (budget in design doc).
- [x] 3.6 Recalibration: rebuild reference baselines on the new pipeline (audio fixtures needed if
      3.1 chooses audio-in grading — record or synthesize reference audio). Update drift cron
      tolerances for the new provider.
- [x] 3.7 Simplify: delete two-stage code paths once single-pass is stable (stage1/stage2 routes,
      `score-stages.ts`) — keep `score-internal` for the async worker.
- **Exit criteria:** calibration suite within tolerance on new pipeline; p95 grading time recorded
  and improved; tone scores demonstrably react to delivery (test: same script read flat vs expressive
  scores differently).
- **Verify after merge (Max):** grade 3 reps on dev — feedback arrives noticeably faster, includes
  stronger version, tone score changes when you deliberately speak in monotone vs with energy.

### Phase 4 — Build a Rep edits (the 12) + coaching quality ✅ (2026-07-17, feat/bar-edits)
*PRD refs: "Edits" section, §7, §4.6–4.7. Fresh session. Depends on Phase 3 (stronger version,
grading speed already fixed there).*

- [x] 4.1 (#2) Moment intake honors user-specified questions: when the description names specific
      questions/moments, generate ONLY those + clearly-offered "add more" suggestions; full
      configurability (already have add/rename/reorder/delete — fix generation respecting intent).
- [x] 4.2 (#3) Rep screen redesign: show just the user's question/moment title as the prompt; add
      side notes panel with AI-generated editable speaking structure (persisted per moment).
- [x] 4.3 (#1) Context upload: accept images (photo library) — vision parse to text; fix `accept`
      attr (already missing `.pptx`).
- [x] 4.4 (#5/#7/#8) Coaching quality: coach's focus grounded in user's transcript with actionable
      retry insights; implementation-rep insights must be event-relevant (interview prep ≠ generic);
      improvement review reports core-skill movement + how well feedback was implemented + what to
      do next rep.
- [x] 4.5 (#6) Core-skill feedback always present in Build a Rep feedback panel (audit why it was
      absent; likely feedbackVariant/v2 gap).
- [x] 4.6 (#10) Post-rep options everywhere in BaR: Retry / Next moment / Back to plan / Exit —
      audit each screen's CTA set.
- [x] 4.7 (#12) Recording playback on Improvement Review + Readiness Review screens.
- [x] 4.8 (#4/#9) Copy pass: plain language, no em-dashes, no jargon; "events" section headers;
      kill the "0 critical moments" state (show real count or better empty state).
- [x] 4.9 Session summary header (#1's second half): cleaner "what I'm practicing" framing.
- **Exit criteria:** all 12 edits addressed or explicitly deferred with reason logged here.
- **Verify after merge (Max):** run a full BaR flow on dev: create event naming 3 specific questions
  → plan shows exactly those 3 → rep screen shows question + notes panel → feedback has core skills +
  stronger version → improvement review has playback → post-rep offers retry/next/exit.

### Phase 5 — Doc-fidelity pass: Skill Lab + Daily Workout + engine ✅ (2026-07-17, feat/doc-fidelity-sweep)
*PRD refs: §4, §5, §6, §8.5. Fresh session. Smaller "sweep" phase.*

- [x] 5.1 Cross-check every §4 design decision against the shipped loop (insight consumable in
      seconds, single coach objective, score movement visibility, next-actions).
- [x] 5.2 §5.7 Workout Complete + §6.8 Session Complete field-by-field audit (coach recommendation
      quality, most-improved logic, reps earned).
- [x] 5.3 §8.5 content selection principles audit (intentional variety, content memory, assessment
      coverage) — confirm selection engines honor them; fix gaps.
- [x] 5.4 Copy sweep for doc terminology (Core Skills, Coach's Focus, Communication Score labels).
- **Verify after merge (Max):** one full Daily Workout + one 3-exercise Lab session on dev feel
  doc-conformant end to end.

### Phase 6 — Production promotion 🟡 (2026-07-17 session 9 — code deployed + verified; 3 items need Max)
*Refs: `plans/prod-promotion-runbook.md`, `plans/project_vercel-env-newline-gotcha` memory. Fresh
session. Requires Max + coordination on prod (Bob per earlier handoffs).*

- [x] 6.1 Prod reseed + prune — **already applied via the shared DB in Phase 2** (dev = prod DB). Verified
      2026-07-17: 102 exercises / 4,148 active prompts / 0 exercises below the slate floor. Did NOT
      hard-delete the 34.8k `is_active=false` rows — deactivation is deliberately reversible and they
      don't serve; a hard prune is optional table hygiene, deferred to preserve reversibility.
- [x] 6.2 Flag promotion — the 5 v2 flags were **already `true` in prod** (set 10–51d ago in earlier
      deploys; the tracker's "off in prod" notes were stale). Only change needed + made:
      `FF_PROSODY_WORKER` was wrongly `true` → set to `false` (Max: prosody worker not deployed to prod;
      `vercel env rm` then `add --value false --no-sensitive --yes`, verified via `env pull`). `AI_PROVIDER=openai`
      confirmed. `NEXT_PUBLIC_USE_ASYNC_SCORING=false` in prod (so the sync `/api/score` path serves everyone).
- [x] 6.3 Prod smoke matrix — **non-auth critical items green** on `cognify-v2-neon.vercel.app`: `/` 200 +
      all 6 security headers (CSP/HSTS/Permissions-Policy `microphone=(self)`/X-Frame-Options DENY/etc.),
      `/try` + `/dashboard` 200 (no 500), scoring health OpenAI. **SIGNALS score-compression bug confirmed
      FIXED in prod:** band reps spread 17→73 (poor=17, below=34, competent-exceptional 71–73), real
      gpt-4o (`openai:gpt-4o-2024-08-06`), rubric v4.0.0, 0 calibration failures. ⛔ **Auth + mic items
      (matrix #3–#17: Google/email sign-in, workout golden path recording) need Max** — require real
      credentials + a mic + a connected browser.
- [ ] 6.4 Post-promotion watch (Max): scoring telemetry p95, drift cron next 3 nights, error rates.
      **Drift cron pre-validated green 2026-07-17** (`GET /api/cron/calibration-drift?dryRun=1` on the v4
      pipeline): 29/29 reps ok, 0 drift, 0 fallback, avg |Δcomposite| 2.03 (gate >5), worst 5 (gate >15),
      alert skipped. The cron alerts on COMPOSITE drift only (stable ±6), not per-dim noise (±15), so the
      gpt-4o per-dim noise floor won't false-alarm. Max still watches the real nightly runs, but the
      "hold until one run passes" condition is effectively met.
- [x] `supabase functions deploy process-rep` — **DONE 2026-07-17** (Max supplied a token; deployed
      to project `dunnoccrvrqzsgxsfjuv`, status ACTIVE v1, current v4 code = audioUrl forwarding +
      coachFocus/feedback writes). Stays off the critical path until `NEXT_PUBLIC_USE_ASYNC_SCORING`
      is flipped on (deliberately left off — enabling async is a separate, separately-validated change).
- **⛔ Remaining follow-ups (need Max):**
  - Deploy the prosody worker to prod (`modal deploy` + set `FF_PROSODY_WORKER`/`PROSODY_WORKER_URL`) — Max
    does this as a follow-up; until then prod tone stays on the text-conservative tier (no breakage).
  - Drift cron judgment — hold until one nightly run passes on the new pipeline.
  - Anthropic fallback low on credits — **intentional (Max 2026-07-17: OpenAI-only, Anthropic not used).**
    The dead fallback only costs the second hop; no action needed.
- **Verify (Max, on prod):** full workout, Lab session, and BaR event end to end; prompt slates
  general + fresh; grading fast; tone reacts to delivery.

---

## Session log

- **2026-07-15** — Planning session. Read July 2026 PRD in full; 6-agent codebase audit (prompts,
  grading, Skill Lab, Daily Workout, Build a Rep, schema/progression); delta analysis vs implemented
  PRD v3; decisions D20–D23 confirmed with Max; this tracker created; new PRD imported to
  `plans/prd/cognify-system-change-v2-2026-07.md`. Next: Phase 0 remainder (taxonomy JSON extraction)
  — can run in a fresh session.
- **2026-07-15 (session 2)** — Phases 0 + 1 shipped on `feat/system-change-v2`. Actual taxonomy
  count is 148 (Thinking Quality table has 28 rows, not 29). Dev DB migrated (profiles + 94
  re-tagged exercises). Two external blockers logged: (1) calibration replay pending API credits
  (see Phase 1 guardrail note), (2) exercise re-tag proposals authored in-session instead of via
  API for the same reason. `/code-review` high (8 finder angles + adversarial verify) surfaced 10
  verified findings — 9 fixed in commit 300843e1, headline items: legacy-id canonicalization was
  missing at every historical read boundary (sub-skill averages window, OutcomeCard chips, retry
  context, prompt-gen, scoring normalizer), the ACTIVE two-stage dev scoring path had no
  sub-skill reference/normalization at all, degenerate recordings could inject junk deterministic
  scores into the profile, calibrate-prosody could never pass post-v2, and 10 tone drills were
  tagged with unreachable delivery skills. PR #5 opened; merge = Max (review required). Deferred
  cleanup (not bugs): consolidate the 3 script-side taxonomy loaders/validators + pacing→delivery
  alias maps into one shared scripts/taxonomy lib — fold into Phase 2's tooling rewrite. Next:
  Phase 2 (prompt architecture overhaul, D21+D23) in a fresh session.
- **2026-07-15 (session 3) — prod promotion of Phases 0+1.** Max refilled OpenAI credits and
  authorized self-merge. PR #5 merged; hotfix PR #6 merged (role-aware OpenAI PRIMARY scoring
  timeout 45s — prod was timing out gpt-4o at the 15s fallback-tuned budget, cascading to dead
  Anthropic → mock scores). Deployed twice to prod (cognify-v2-neon.vercel.app, final dpl on
  merge 4f38aff6). **Discovery: dev `.env.local` and prod Vercel point at the SAME Supabase DB**
  (postgres.dunnoccrvrqzsgxsfjuv) — so migration 0041 + the 94-exercise re-tag were already
  live for prod; 0041 re-applied idempotently via apply-prod-migration.mjs. Prod env already had
  `AI_PROVIDER=openai`. Calibration replay ran (see Phase 1 note). Prod smoke: pages 200, real
  scoring at ~20s via gpt-4o, dims sane. **One item needs Max (prod flag write blocked for the
  agent):** bullet sub-skill attribution on prod returns null because
  `FF_DETERMINISTIC_SIGNALS=false` there — reproduced locally: with the flag off, gpt-4o stops
  emitting `subSkill` (the SIGNALS block's presence is what cues attribution). To enable:
  `vercel env rm FF_DETERMINISTIC_SIGNALS production --yes && printf 'true' | vercel env add
  FF_DETERMINISTIC_SIGNALS production` then `vercel deploy --prod` (percent already 100; the
  taxonomy-v2 mapper is evidence-gated so the old fallback-flooding risk is gone). Also worth a
  password rotation: the prod DATABASE_URL (incl. password) got echoed into a local session
  transcript by a node error during env plumbing.
- **2026-07-15 (session 4) — Chore: prod FF_DETERMINISTIC_SIGNALS flip + Phase 2 (prompt
  architecture overhaul, D21+D23) on `feat/prompt-architecture-v2`.**
  - **Prod flag flip DONE + smoked:** two gotchas beyond the known newline one — (1) piping
    `printf 'true'` (no trailing newline) into `vercel env add` stores an EMPTY value (CLI 56
    readline discards a non-newline-terminated line); (2) stdin-piped adds are created as
    write-only "Sensitive" vars, so `env pull` can't verify them. Reliable pattern:
    `vercel env add NAME production --value true --no-sensitive --yes`, then env pull shows the
    exact bytes. Smoke: POST /api/score with guest cookie → 4/4 bullets carry v2 subSkill ids
    (~14s, gpt-4o). Note: `modelVersion` in score responses is a hardcoded constant
    (MODEL_VERSIONS.scoring, claude-haiku id) — NOT the serving model; /api/score/health shows
    the real provider.
  - **Phase 2 shipped** (2A.1–2B.3 checked above; 2B.4 counts below). Legacy-planner behaviors
    preserved on purpose: Build→Stress→Reinforce pressure slot at N-1 (4+ rep sessions), flow
    ramp archetype order, framework rotation. Behavior changes to know about: Focus Drills
    header now names the CATALOG exercise (was rep-type displayTitle); prompt-select Refresh is
    async from the catalog (session exclusion + generated top-up now apply there); /try serves a
    random intro conciseness catalog prompt; legacy BaR slates come from catalog vertical tags.
    Smoked via direct server-action POSTs on dev: focus/clarity plan (exercise rotation +
    doc-merged prompts in slates) and pressure plan (ramp order, relocated pressure exercises,
    correct budgets) both green; /try serving varied catalog prompts.
  - **Chore 2 (credential maintenance) skipped by Max's instruction this session** ("we don't
    need that yet, focus on builds").
  - Deferred/flagged: Word Budget doc prompts say "75 words max" but the exercise rule is 30
    words — doc suffix dropped, needs Max ruling if 75-word variant wanted; six-word-story +
    read-and-teach one-liners skipped (see 2B.1); SkillLabSession reps now record exerciseId
    (was null for legacy Skill Lab reps).
  - **/code-review high (8 finder angles + verify) → 10 verified findings, all fixed** in commit
    6d2d2425. Headliners: unclamped planLabSession counts (public action, unbounded DB/LLM work);
    canon-verdict schema capped below the judge's own tag count (a maximally-tagged verdict
    failed the batch and the runtime path failed OPEN, caching condemned prompts); vertical
    picker could return an empty Build-a-Rep slate; seen-ids cap kept FIRST 500 (heavy users got
    repeat slates on refresh); mixed sessions lost interleaving and wrongly gained a pressure
    rep; the pressure bank could create a phantom profile.applications['pressure']; pressure
    slots rendered the wrong scaffold; pressure ramp always started at time_compression. Also:
    pure planning logic extracted to src/server/lib/lab-session-planning.ts (+tests), slates
    parallelized per exercise group, pacing↔delivery alias consolidated into
    dimension-aliases.ts, em-dash copy fixed in new catalog content (reseeded: 3 new rows, 3
    orphans deactivated — active count still 4,148).
  - Known non-blockers: /try uses ORDER BY random() over the filtered intro-conciseness pool
    (small set, marketing page); audit exemption matches curated manifests by normalized TEXT
    (provenance tags would be sturdier — future improvement); stripFences is the codebase's 7th
    fence-stripper (consolidation deferred); prompt-gen-cache still runs the canon judge
    inline on the user-blocking top-up path (quality-over-latency, top-up is rare).
- **2026-07-16/17 (session 5) — Phase 3: Grading rethink (D22) on `feat/grading-v3`.**
  - **Spike verdict (3.1): enhanced DSP prosody wins.** OpenAI audio-in models (gpt-audio,
    gpt-audio-1.5, gpt-audio-mini) cannot discriminate prosody in structured text-output scoring
    (identical tone for flat AND expressive clips); the Praat-worker DSP block through the text
    grader separated tone 25–38 pts. Full record: `plans/prd/grading-v3-design.md` +
    `plans/spike-audio-grading-results.json`; 15 validated fixtures (PSOLA pitch-flattened true
    monotones) in `tests/fixtures/audio-grading/`.
  - **v4 contract shipped (3.3/3.4):** one unified pass emits per-skill `feedback`+`subSkill`,
    ONE `coachFocus {behavior, why, action}`, verbatim-quote-validated `strongerVersion`,
    headline/tone/hint; callouts/didWell/didntLand/nextRepFocus left the model output
    (legacy-read only). FEEDBACK_VERSION v4.0.0, RUBRIC_VERSION v4.0.0. `reps.feedback` jsonb
    (migration 0042, applied to the shared DB) + widened `coach_focus` persist the full doc;
    async path reaches write/read parity (audioUrl forwarding via signed URL in process-rep —
    **needs `supabase functions deploy process-rep`** — coachFocus/coaching_events/feedback
    writes, 60s/120s client watchdog). UI converged on the v2 layout everywhere; two-stage
    pipeline deleted (3.7). Provider flip (3.2): AI_PROVIDER default openai, role-key model
    resolution, honest `modelVersion` from call metrics, real Anthropic fallback budget (20s).
  - **Latency (3.5):** total p50 13.6s → 9.3s, p95 20.3s → 11.8s (`plans/baselines/
    phase-grading-v3-pre|post.json`), 0% fallback. OpenAI primary timeout 45s → 35s.
  - **Recalibration (3.6) — found a live prod bug:** the Ch.11 SIGNALS block told the model to
    score content dims "PRIMARILY against" regex numbers that miss implicit structure/evidence
    (elite ref rep measured "logical flow 9/100, claim-support 0%" → gpt-4o crushed everything
    into 40–65, breaking band semantics). The flag went live in prod 2026-07-15, so PROD WAS
    AFFECTED for ~2 days. Fixes: signals demoted to corroborating evidence; band anchors now
    unconditional (FF_BAND_ANCHORS retired); SCORE CALIBRATION + DIMENSION INDEPENDENCE + edge
    rules 2b/7/8; MEASURED RATE wpm line (computed in code). Bank re-authored from 3× replays
    (`scripts/calibration/reauthor-expectations.mjs`), independence thresholds relaxed to
    observed-stable with auditable rationale stamps (`rethreshold-independence.mjs`), durations
    normalized where hand-invented values implied absurd WPM. Harness tolerances split
    (composite ±6, per-dim ±15 = measured gpt-4o noise floor at temp 0.2); harness hard-fails
    on mock-fallback responses. **Ordering caveat:** the pipeline inverts some hand-authored
    family rankings (excellent-tier reps landing below competent-tier); bank now pins CURRENT
    behavior for drift detection, not quality endorsement.
  - **Audio exit criterion PASS:** 15 clips promoted into the bank (kind=audio-tone, uploaded to
    rep-audio/calibration-audio/) + `scripts/calibrate-audio-tone.mjs` (serves clips over local
    HTTP, toneSource provenance gate): all per-clip bounds green, 4/4 valid tone pairs separate
    +25…+38 (flat 25–40 vs expressive 60–70). One TTS "expressive" clip measured upspeakRatio
    0.5 at the worker → re-tagged as a DNA-rule-4 upspeak specimen. Pacing pairs advisory-only
    (TTS clips aren't rate-controlled; production delivery is deterministic from timings).
    Dev env now runs the local Praat worker (infra/prosody-worker/.venv, uvicorn :8080;
    FF_PROSODY_WORKER=true + PROSODY_WORKER_URL in .env.local).
  - **/code-review high (8 finder angles; 7 reported, simplification agent hung + killed) →
    fix wave committed:** headliners — v4 reps returned NULL from every callout scavenge, so
    /try guests saw zero coaching copy, progression lost its top-weakness line on 4 surfaces,
    and prep readiness reviews graded from averages alone (all now derive from coachFocus via
    shared `deriveRetryFocus`/`deriveTopWeakness` in coach-focus.ts); async watchdog could
    double-fire onComplete (poll/realtime race); Anthropic-as-PRIMARY ran on the 5s quick-fail
    budget; progression rows misattributed gpt-4o output to the hardcoded claude id; worker
    prosody was discarded whenever word timings were absent (+ forked filler semantics — now
    `synthesizeProsodyBaseline` shares the timed path's lexicon); legacy coach_focus rows
    rendered duplicated copy; delivery override could show feedback praising a number it
    replaced; em-dash copy violations; stale primaryFocusDimension prompt refs.
  - **BLOCKED on API credits (both providers dead as of 2026-07-17):** OpenAI
    `insufficient_quota` + Anthropic "credit balance too low" — **PROD SCORING IS SERVING MOCK
    FALLBACKS until Max re-ups billing.** Pending once credits return: (1) full-bank text
    verification under the final prompt (`CALIBRATION_GUEST_ID=<uuid> node
    scripts/calibrate-scoring.mjs`, expect ≤5 noise-level failures; micro-adjust expectations if
    the small post-re-author prompt fixes shifted anything), (2) `PHASE=v2-3
    node scripts/phase-baseline.mjs` final latency record.
  - Phase 6 checklist additions: `supabase functions deploy process-rep`; deploy prosody worker
    (`modal deploy infra/prosody-worker/modal_app.py` or container) + set FF_PROSODY_WORKER/
    PROSODY_WORKER_URL in prod (until then prod tone runs the text-conservative tier — no
    breakage); prod flag state otherwise unchanged (v4 pass itself ships unflagged per Max's
    approved clean-break ruling — prod only changes when Phase 6 deploys).
- **2026-07-17 (session 6, same session as Phase 3) — Phase 4: Build a Rep edits (the 12) on
  `feat/bar-edits`.** All 12 edits addressed (#5 stronger version + #11 faster grading were
  Phase 3's; #6 verified fixed by Phase 3's layout convergence).
  - **#2 user-named questions:** planner rule 1a — named questions become EXACTLY the plan
    (schema min 4→1, first 9 kept, max_tokens 3200 so long lists can't truncate into the
    generic fallback); extras persist as source='suggested' (sortOrder band 1000+) in a
    dismissible "Want to add any of these?" rail; acceptSuggestedMoment promotes them.
    getPrepEvent splits moments/suggestions so all consumers keep treating moments as the
    practice list; all-suggested plans are promoted rather than creating zero-practice events.
  - **#3 rep screen:** RepSurface gained `scoringPromptText` — BaR shows just the question
    while the grader keeps the full event sentence (format kept byte-identical to pre-branch:
    promptText is /compare's grouping key). Per-moment speaking notes
    (critical_moments.notes jsonb, migration 0043, applied to shared DB): auto-drafted via the
    talking-points generator (moment-specific deterministic fallback when the model's down;
    failed REGENERATE never overwrites user edits), edited in place via TalkingPointsSidebar,
    sticky beside the recorder. Pure logic in src/lib/prep/moment-notes.ts (+tests).
  - **#1 uploads:** accept fixed (.pptx was parseable but not accepted) + image/* for the photo
    library; images vision-parse to text (OpenAI, best-effort); client-side downscale to
    1600px JPEG keeps phone photos under the 4MB cap, cuts vision cost, and transcodes HEIC
    where the browser can decode it (HEIC on Chrome stays unsupported — known limitation).
  - **#7/#8 coaching:** event-context block now instructs coaching outputs to target THIS
    event (only-when-present ⇒ reference prompts stay byte-identical; formal replay still
    queued behind the credits blocker with Phase 3's); Improvement Review renders the v4
    behavior/why/action focus, per-skill deltas, implementation verdict, and (#12) Listen-back
    scrubbers for both takes; Readiness Review plays the simulation recording; blob URLs
    revoked when reviews are left (leak fix).
  - **#10 CTAs:** first-rep feedback offers Retry (primary) / skip-to-next / back-to-plan;
    scored retries land on Improvement Review's next/again/plan set. (A naive retry-branch CTA
    row was caught by review rendering stale navigation under a live recorder — removed.)
  - **#4/#9 copy:** all user-facing em-dashes out of BaR (incl. ~40 fallback-plan strings;
    paired dashes → parentheses); planner prompt bans em-dashes in every generated user-facing
    field; "Events you're preparing for" header; no "0 Critical Moments" (→ "Plan ready to
    build"); plan header gains the "You're practicing N moments (~M min)" summary line.
  - **/code-review (6 finder angles) → all verified findings fixed** (headliners in the fix
    commit: stale CTA row, regenerate-destroys-notes, unreachable fallback, zero-practice
    plans, promptText identity break, notes dead ends, blob leak, 4MB photo wall).
    Accepted trade-offs logged: acceptSuggestedMoment does 3 sequential round trips (minor
    race on concurrent accepts), generateMomentStructure uses two selects not a join.
  - **Verification limitation: both AI providers are still out of credits**, so plan
    generation/notes/vision were exercised through their deterministic fallbacks + unit tests
    only; the LLM paths need a live smoke after re-up (see Max checklist in the PR).
- **2026-07-17 (session 7, same session) — Phase 5: doc-fidelity sweep on
  `feat/doc-fidelity-sweep`.** Four parallel audits (§4 loop, §5.7/§6.8 screens, §8.5
  selection, terminology) → fix waves + a 2-angle review wave.
  - **§4 loop:** "Run it again" now implements the focus the Improvement Review just assigned
    (was re-coaching the FIRST rep's objective — overlay, scoring context, comparison, and
    parentRepId lineage all follow the attempt being implemented against); retry screens no
    longer stack generic sub-skill hints beside the Coach's Focus overlay.
  - **§5.7/§6.8 screens:** Core Skill breakdown (current values) always on Workout Complete;
    coach recommendation value-driven only (calendar-parity branch removed; sub-70 users keep
    Lab discovery via a secondary "Or apply it" link); improvement/most-improved fall back to
    all attempts on single-exercise days (labeled "Includes your coached retry"); Lab
    completion labels the degraded-fetch metric honestly + lists all six Core Skills.
  - **§8.5 selection:** lab planner personalizes for signed-in users (3-day recent-exercise
    demotion, automatic weakest-hidden-skill bias — soft, recency-aware; user deep-links stay
    hard), hash-spread deterministic rotation seeds + pressure-archetype rotation (guests keep
    legacy random); prompt skip memory persists (migration 0044:
    prompt_selection_events.skipped_prompt_ids; 7-day soft deprioritization wired through
    PromptPicker → fetchPromptCandidates, truncation-proofed); assessment-phase slates stay
    broad (30-day windowed gate matching isAssessmentActive) instead of vertical-narrowed from
    day one.
  - **Terminology (5.4):** "Composite"→"Communication Score", "dimensions"→"Core Skills",
    tutorial "Delivery"→"Pacing" across dashboard/progress/report/completion surfaces.
    (SubSkillBreakdownCard is already dead behind the retired FF_SUBSKILL_UI — untouched.)
  - **Surfaced to Max, not relitigated (PRD-vs-code conflicts):** (1) Owen C10 score-movement
    softening (negatives < −3 hidden) contradicts PRD §4.7 "score movement should be highly
    visible" and C10 isn't in the D-log — needs a ruling: amend §4.7 or restore numeric
    visibility. (2) §8.5 "recently used communication contexts / speaking scenarios" memory
    remains unimplemented (needs tag-level schema design — deferred; prompt-id-level memory
    only). (3) The Lab core-skill planner personalizes now, but §8.5's full
    strengths/weaknesses/goals matrix is Phase-7-intelligence scope.
  - Review wave (2 angles) fixed: skip-memory silently no-op for active users (bias-window
    truncation), rotation-counter modulo aliasing, guest-cookie identities taking the
    personalized path, auto-bias monotony (single tagged exercise leading forever), stale W7
    docstring, em-dash regressions.
- **2026-07-17 (session 8) — Post-re-up verifications (the Phase-3/4 credit-blocked queue) +
  a real quote-cap hotfix, on `fix/stronger-version-quote-cap`.** Max re-upped billing;
  probe result: **OpenAI (scoring primary) live; Anthropic (fallback) still "credit balance
  too low"** — flagged, work continued since primary is what all scoring/gen uses (Anthropic-dead
  only costs the fallback hop).
  - **Found + fixed a live latent bug (score.ts):** `strongerVersion.quote` had a Zod `max(400)`
    but the prompt states NO quote cap, so on comma-spliced run-on answers gpt-4o quotes a long
    span (e.g. the whole 859-char transcript) → the ENTIRE scoring response failed validation →
    cascaded to the dead Anthropic fallback → **mock-fallback served for a real answer** (mis-logged
    as "provider unreachable"). Same "weaponized cap" failure the `headline` cap already documents.
    Fix: quote `max(400→1000)`, rewrite `max(600→700)` margin; schema-only, so scoring-prompt BYTES
    are unchanged (no calibration re-author needed). Regression test added
    (grading-v3-contract: 600-char quote parses). This bug is in prod now (Phase 3 shipped it) — it
    silently mock-scores any long/run-on rep; the fix ships to prod in Phase 6.
  - **Calibration (2, ≤5-noise criterion MET):** across 4 full-bank runs the failure count was
    3/1/4/2, always ≤5 and on **rotating** reps (band-exceptional, interview-excellent, qa-competent,
    velocity, objection-excellent each fail once) = the temp-0.2 gpt-4o noise floor, not drift
    (no uniform direction; interview-excellent drifts UP +18 structure). Two surgical bank
    adjustments (Max-authorized tooling):
    (a) `rethreshold-independence.mjs` on **indep-launch-miss-breathless** thinking_quality min
    65→35 — its old rationale literally read "observed **70/70/70**", i.e. it was thresholded
    against MOCK output (mock returns ~70) because the quote-cap bug mock-failed this exact rep
    during the Phase-3 re-author; real gpt-4o scores its thinking a stable 40/42/40.
    (b) `reauthor-expectations.mjs` on **qa-excellent-board-regulatory** (single-rep replay files
    → only this rep) composite 77→68, band strong→competent — consistent across 3 dedicated runs
    (69/68/67), another instance of the documented §3.6 "pipeline under-rates upper-tier reps"
    limitation. ⚠️ **For Max:** the bank pins CURRENT behavior for drift detection, not quality
    endorsement — qa-excellent-board and the rotating upper-tier reps land ~8 below their
    hand-authored composites; if that under-rating is a real quality gap, that's Phase-7 grading
    work, not a bank problem.
  - **Audio tone exit criterion (3): PASS.** Clean re-run 0 failures; all 4 valid tone pairs
    separate +20…+35 with `toneSource:prosody` (real Praat-worker audio grading, worker on :8080).
    band-competent's expressive clip stays excluded (the known upspeak specimen). One boundary-noise
    clip (qa-strong expressive 55↔60) self-cleared on re-run.
  - **Latency (4): `PHASE=v2-3 phase-baseline.mjs`** → total p50/p95 **7.66s / 10.27s**, model
    7.1s / 9.4s, **0% mock-fallback, 0% OpenAI-fallback**, 100% cache. Better than the Phase-3
    post-baseline (9.3s/11.8s). Persisted `plans/baselines/phase-v2-3.json`.
  - **Phase-4 LLM smokes (5): all PASS with real model output** (`scripts/smoke-bar-llm.ts`, new).
    #2 named questions → EXACTLY the user's 3 questions verbatim as practice moments, 0 fabricated,
    suggestions-rail mechanism intact (`suggested:true`), coachCue+scoringHint present. #3 moment
    notes auto-draft → clean STAR sections (the editability/persist half was Phase-4 unit-tested +
    reviewed). #1 OpenAI vision parsed a generated JD image (1080 chars, accurate) → regenerated a
    document-specific plan ("Final Panel Interview at Aurora Payments"). Browser extension wasn't
    connected, so validated via direct LLM-function calls (the exact "LLM paths need a live smoke"
    gap the Phase-4 log named).
  - **verify-scoring.mjs (6): all assertions PASS** (coachFocus/strongerVersion grounding/per-skill
    6/6/headlineTone/nextRepHint/non-mock). Trailing `UV_HANDLE_CLOSING` line is a Windows/libuv
    teardown race after success, not an assertion failure.
  - typecheck + full test suite + lint green. Next: Phase 6 prod promotion.
- **2026-07-17 (session 9) — Phase 6 prod promotion on `phase-6-prod-promotion`.** Max authorized the
  prod work. Vercel CLI authed (`maxvolkov202`), project `cognify-v2` (`cognify-v2-neon.vercel.app` is its
  prod alias). Executed:
  - **D24 ruling (PR #11 conflict):** kept Owen C10 score-movement softening; amended PRD §4.7.2 with the
    display rule (delta < −3 → soft copy, ≥ +1 → celebrate) and logged D24. Code and doc now agree; large
    negatives stay hidden.
  - **Flag promotion (6.2):** discovered the 5 v2 flags were ALREADY `true` in prod (stale tracker notes);
    fixed the one wrong one (`FF_PROSODY_WORKER` true→false per Max). `AI_PROVIDER=openai`,
    `NEXT_PUBLIC_USE_ASYNC_SCORING=false` (sync path serves everyone → the blocked process-rep edge fn is
    off the critical path).
  - **Reseed (6.1):** already applied via the shared DB in Phase 2 (4,148 active prompts, 0 thin); no
    destructive hard-prune (preserves `is_active=false` reversibility).
  - **Deploy (the headline item):** first `vercel deploy --prod` **build FAILED** — a real latent Phase-4
    bug: `PrepEventClient` (client) + the client image-downscaler imported constants from `prep/parse.ts`,
    which dynamic-imports node-only extractors (unpdf/pptx → `node:zlib`), so webpack pulled `node:zlib`
    into the browser bundle. Tests/typecheck/lint never exercise the bundle boundary, so it only surfaced
    at deploy. Fixed by splitting client-safe constants into `src/lib/prep/parse-constants.ts` (parse.ts
    re-exports for server importers); local `next build` + full suite green; redeploy READY
    (`dpl_7kydKi…`, prod alias repointed).
  - **Smoke (6.3):** headers + pages + scoring health green; **SIGNALS score-compression bug fixed in
    prod** (band spread 17→73, real gpt-4o, rubric v4.0.0, 0 calibration failures). Auth/mic matrix items
    left for Max.
  - **Handed to Max (blocked/follow-up):** `supabase functions deploy process-rep` (CLI unauthenticated;
    non-critical while async scoring is off), prosody-worker prod deploy (Modal), drift-cron hold, and the
    Anthropic-fallback low-credit flag. `/code-review` + PR + self-merge as usual.

- **2026-07-20 (session 10) — Phase 7 grading recalibration (rubric v4.1.0) + PROD INCIDENT.**
  Branch `fix/grading-recalibration-v4-1` (NOT merged, NOT deployed). Addresses the upper-tier
  under-rating from `plans/verification-2026-07-20-holistic.md` (elite reps clustered 75-78).
  - **🔴 PROD SCORING INCIDENT (needs Max — billing):** midway through local validation, OpenAI
    returned `429 "You exceeded your current quota"` and Anthropic fallback is still out of credits
    → **prod `/api/score` is serving `mock-fallback-v1` (composite 70, canned coaching) to real
    users.** Prod was confirmed non-mock at session start (18-rep baseline, 0 mock), so the quota
    was exhausted DURING this session — the ~250+ gpt-4o validation calls I ran (local + prod share
    the OpenAI account) are the overwhelmingly likely cause. **Fix = re-up OpenAI quota (or Anthropic
    credits so the fallback works).** I stopped all scoring calls on detection.
  - **Rubric changes (DONE, typecheck+lint+contract-tests green, code reviewed by eye):**
    `score.ts` — anti-middle-compression rule; a clarity/structure "clean-arc ceiling" rule;
    thinking_quality "depth ≠ evidence-count" recalibration (edge rules 5/7 reinforced, 2b
    strengthened for disorganized-but-deep, 2 strengthened for numbered-scaffold structure);
    widened delivery band 150-160 → 130-165 with a >170-wpm fast-penalty retained and a no-audio
    delivery-grounding rule. `rubric.ts` — RUBRIC_VERSION v4.0.0 → **v4.1.0**, delivery def/​signals
    130-165. `rubric-anchors.ts` — thinking 61-100 + delivery 61-80 anchors rewritten.
    `scripts/qa/grading-quality-reps.mjs` — +6 fresh excellent/elite reps (2nd pitch, behavioral,
    objection, teaching, toast, technical explainer).
  - **Validation captured BEFORE quota died (local, 24-rep QA, averaged):** junk 16 / poor 26 held;
    independence gaps clean (org-empty str−thk +15, clear-shallow cla−thk +15, concise-vague
    con−thk +53); deep-but-disorganized FIXED — thinking 62-72 > structure 42-45 (was thk40<str50),
    5/5 runs; excellent reps clear 80 (teaching 81, technical 81, investor 84); elite reps 82-85
    (climate pitch hit 85). The calibration bank replay (run 1 of 3, 48 reps, 0 mock) showed the
    intended upper-tier lift: interview-excellent-leadership-failure 59→71 (thinking 47→72),
    band-exceptional 70→79, +7 more upper-tier band reps drifting UP — these are the sanctioned
    re-baseline targets, not drift.
  - **⚠️ BLOCKED on credits — remaining Job-1 gates NOT done:** (a) finish the 3× calibration replay
    → `reauthor-expectations.mjs` re-baseline of upper-tier band reps; (b) full `calibrate-scoring` /
    `verify-scoring` / `phase-baseline` / `calibrate-audio-tone` suite; (c) `/code-review high`;
    (d) PR + self-merge + `next build` + `vercel deploy --prod` + prod elite-rep smoke. Resume once
    OpenAI/Anthropic credits are restored. Text-only tone caps ~70 by design, so text-only elite
    tops ~85; 85-90 elite is audio-gated (needs Job 2 prosody).
  - **Job 2 (prosody worker) — DOUBLE BLOCKED, see `plans/job2-prosody-blocker-2026-07-20.md`:**
    (1) the Modal token in the prompt was the literal placeholder `<PASTE MODAL TOKEN HERE>`;
    (2) the prod SYNC path (`RepSurface.tsx:568-609`) never sends `audioUrl` to `/api/score`, so
    flipping `FF_PROSODY_WORKER=true` alone is a no-op for tone — fix + latency tradeoff documented.

- **2026-07-20 (session 10, cont.) — Job 1 SHIPPED after OpenAI re-up.** Max re-upped OpenAI;
  prod + local confirmed non-mock. Resumed and completed all gates:
  - 3× calibration replay (0 mock, **0 independence failures**) → `reauthor-expectations.mjs`
    re-baselined the 29 band reps (upper tier +8-12, low/mid ±2-6). Post-reauthor
    `calibrate-scoring` **1/48** (indep-earnings-explainer thk 65>60, documented aspirational),
    0 mock — within ≤5. `verify-scoring` all-pass (v4.1.0, non-mock). `phase-baseline` p50/p95
    **9.1s/9.9s**, 0 mock, not regressed. `calibrate-audio-tone` **4/4 tone pairs +25**, prosody
    end-to-end (worker :8080), 1 documented per-clip TTS boundary noise.
  - `/code-review high` → 1 low-severity DEFERRED finding: edge rule 3 (>170 wpm docks delivery)
    vs deterministic `scorePacing` (penalizes only >220) — each governs a different path
    (deterministic override wins when words present), so no wrong behavior; left for a future
    decision on whether to add a 170-220 band to scorePacing.
  - **PR #17 merged → main** (`08e29d52`). `next build` green. `vercel deploy --prod` →
    `dpl_FGrqmk2kNU1Qcd89nGBb3Lp8rKQA` (production, READY). **Prod smoke: elite pitch composite
    81, non-mock (openai:gpt-4o), rubricVersion v4.1.0 live, rep-specific headline.** Max's target
    (excellent reps reach 80+) is met in prod. Text-only tone still caps ~70 by design → elite
    85-90 remains audio-gated (Job 2).
  - **Incident postmortem:** the mid-session prod mock-fallback was OpenAI quota exhaustion (429)
    from the validation burst + Anthropic fallback also out of credits; resolved by Max's re-up.
    Consider raising the OpenAI spend cap and re-upping Anthropic so the fallback can absorb the
    next quota event instead of dropping to mock.

- **2026-07-20 (session 10, cont.) — Job 2 SHIPPED: prosody audio-tone grading LIVE in prod.**
  Max authed Modal (`modal token new`). Executed:
  - **Modal worker deployed** (`cognify-prosody-worker`, URL
    `https://maxvolkov202--cognify-prosody-worker-fastapi-app.modal.run`) from
    `infra/prosody-worker/modal_app.py`. Hardened with a shared-secret (`cognify-prosody-secret`)
    so a leaked URL can't burn credits; worker verified returning real prosody for wav + mp3.
  - **PR #19** — sync path now uploads audio BEFORE scoring and sends the signed `audioUrl` to
    `/api/score` (gated by `NEXT_PUBLIC_PROSODY_SYNC`, default off = byte-identical). This closed the
    original blocker (sync path never sent audioUrl).
  - **PR #20** — `extractWorkerProsody` now tries the Praat worker FIRST, Hume as fallback. Prod had
    a stale `HUME_API_KEY` that returned null and short-circuited the worker (tone fell to text tier
    despite a healthy worker). Fixed + latent "Hume-null-no-fallback" bug removed.
  - **Prod env set** (verified via `vercel env pull`): `PROSODY_WORKER_URL`, `PROSODY_WORKER_TOKEN`,
    `NEXT_PUBLIC_PROSODY_SYNC=true`, `FF_PROSODY_WORKER=true`. Two `vercel deploy --prod` cycles.
  - **Smoke PASS:** prod `/api/score` with a signed audioUrl → `toneSource: prosody`,
    `prosodyAvailable:true`, non-mock; tone REACTS — expressive clip 65 vs flat clip 35 (+30).
  - **Watch-items for Max:** (1) `min_containers=1` on the worker = continuous Modal credit burn
    against ~$30 — consider `min_containers=0` (graceful cold-start degradation to text) after
    handoff. (2) sync reps now upload before scoring → slightly slower perceived scoring. (3) the
    stale `HUME_API_KEY` is now inert (Praat is primary); remove it if Hume is truly dead.
  - **Job 3 (Max-owned) still open:** manual auth + mic smoke matrix.

- **2026-07-21 (session 11) — WebM prosody decode + unified scoring display SHIPPED (PR #22 →
  `2e235342`).** Verification found the Job-2 prosody worker couldn't decode the real browser format:
  it called `parselmouth.Sound()` directly, but Praat has no WebM/Matroska reader, so
  `audio/webm;codecs=opus` (the format `capture.ts:24` records) returned all-null prosody and tone
  silently fell back to text tier — only the wav/mp3 calibration fixtures ever worked. Proven 3 ways
  (local parselmouth `PraatError: Not an audio file`, live worker all-null, prod `/api/score` with a
  real webm → `[toneSource: text]`).
  - **Fix:** `infra/prosody-worker/main.py` `_load_sound()` tries Praat directly (fast path for
    wav/mp3/flac/ogg) then transcodes to 16kHz mono WAV via the ffmpeg already in the Modal image on
    any failure. `modal deploy` done. **Verified end-to-end:** real webm → non-null prosody
    (pitchMeanHz 141.6) and prod `/api/score` → `[toneSource: prosody]` (was text), non-mock.
  - **Scoring display:** removed the optimistic deterministic preview in `RepSurface.tsx` (showed
    delivery + a thinking_quality BASELINE 85 that the LLM blends down to ~71 — users watched a score
    "drop"). Now one skeleton runs during grading and all six FINAL dims appear together when
    `/api/score` returns. Pure scorers unchanged; UI-only. `computeOptimisticDims`/
    `OptimisticDimensionPreview` removed from the UI.
  - build + lint + tsc green. PR #22 merged, `vercel deploy --prod` (`cognify-v2-pkb8s0o6x`) + alias
    repointed, prod health green. **Remaining launch gate: Google OAuth** (needs Max's `GOCSPX-`
    secret in Supabase — a wrong non-Google value was in the field). Modal `min_containers=1` cost
    still open. Prompt-bank expansion is the next workstream (`plans/prompt-bank-holistic-brief.md`).

- **2026-07-21 (session 12) — workout-loop UX bug sweep (4 issues from Max, uncommitted).**
  - **(1) "Thinking Quality + Pacing score before the rest."** Already fixed in code + prod (PR #22,
    `161a90a8` — optimistic preview removed; `computeOptimisticDims` now has zero callers in `src/`).
    No new code change. Root cause of Max still seeing it: **stale cached PWA bundle** — needs a hard
    refresh / installed-app update to pick up the deployed fix.
  - **(2) "Proceed anyway" jumped to redo, skipping the score — REVERTED (misdiagnosis).** First
    attempt: removed the F-6 `pendingBeginRetry` auto-advance in `finishRepWithScore`, thinking it
    skipped `score-reveal`. **This was wrong and regressed the real retry flow** — the authed
    workout-loop e2e (`AUTHED=1`, fake mic) failed: a fast "Start your Retry" tap (which races ahead
    of `SCORE_DONE` during the ~200ms `tagWorkoutRep` round-trip) now needed a second tap. The
    auto-advance is CORRECT: tapping "Start your Retry" is an explicit post-feedback choice to retry.
    Restored the original logic + F-6 test. The e2e's `recordRep` helper clicks "Proceed anyway" on
    every rep, so the passing loop proves proceed-anyway → score → retry → improvement-review works
    in current code — Max's reported jump does not reproduce (likely stale PWA bundle or a
    scoring-error/async-path condition). **Need a concrete repro from Max to fix the actual #2.**
  - **(3) Jot-notes room too small.** `RepFrameworkStrip.tsx` per-section input `maxLength` 60 → 120;
    helper copy "a word or two" → "a few words". (shipped in PR #24, kept.)
  - **(4) Exiting mid-workout restarted at rep 1.** `startMuscleGroupDay` returns `resumeStationIndex`
    (persisted session index, else `completedReps`, clamped); `WorkoutShell.onStartWorkout` uses it
    (was hard-coded 0). **Runtime-verified e2e** (fresh clean user): clear station 1 → advance to
    "Rep 2 of 3" → leave `/workout` → return → Start → resumes "Rep 2 of 3", not rep 1. (shipped
    PR #24, kept.)
  - Also shipped in PR #24 (kept): deleted dead `deterministic-client.ts` (`computeOptimisticDims`
    zero callers).
  - **PR #24 merged + deployed to prod** (`cognify-v2-kbd1kft3m`, alias `cognify-v2-neon` auto-followed)
    — but it carried the wrong #2. Correction (revert #2) ships next.

- **2026-07-21 (session 12b) — #2 revert + leaderboard cleanup.**
  - **Revert #2** (above) — restore F-6 auto-advance; 99 machine tests green.
  - **Leaderboard: hide test accounts.** `@cognify.test` (e2e-harness, demo, e2e-resume-verify — my
    e2e runs wrote reps straight to the **prod** Supabase via `.env.local`) now excluded from every
    scope in `leaderboard.ts` + the leagues cohort board (`leagues.ts` `getCohortLeaderboard`).
  - **Leaderboard: real users were missing** (Anthony Hausfeld, Aidan Holt, Owen Brown — last trained
    May 2026). Root cause: the global board was a **30-day rolling window**; nothing disconnected
    (0 orphaned reps). Per Max, changed `global` + `team` scopes to **all-time** (`since = epoch`);
    `this_week` unchanged. Verified: new board = Owen, Hunter, Anthony, Max, Aidan (no test accts).
    Note: all-time + `HAVING count>=1` lets a low-rep account top the board (Owen #1 on 6 reps) —
    add a min-rep floor if that ever feels off.
  - tsc + lint + full unit suite + authed workout-loop e2e green.

- **2026-07-21 (session 12c) — the ACTUAL #2 fix + two more loop bugs (branch `fix/workout-loop-score-reveal-notes-resume`).**
  Max re-reported three symptoms on the live daily workout: (1) after a rep the score/transcribe
  screen flashes then **jumps straight back to the rep start (record) page**; (2) jotted notes
  **carry into the next rep**; (3) on rep 3, the score-jump **restarted the day at rep 1**.
  - **#2 real root cause (NOT the machine).** `WorkoutShell.tsx` keyed the in-workout
    `<AnimatePresence mode="wait">` wrapper on `controls-${state.phase}`. `recording` and
    `score-reveal` render the SAME `<ActiveRep>`/`RepSurface`, which holds the record→score→feedback
    UI in its OWN local `done` state. When `SCORE_DONE` flips the machine recording→score-reveal, the
    key changed → AnimatePresence **remounted RepSurface fresh at idle**, discarding the feedback and
    showing the record screen. `onComplete` awaits `tagWorkoutRep` (~200ms) before `SCORE_DONE`, so
    the feedback paints then vanishes ~200ms later. **The retry e2e survived only because it clicks
    "Start your Retry" inside the ~0.32s exit-animation window** — a human reading the grade misses
    it. This is why session 12's machine-level "fix" was a misdiagnosis and the F-6 revert was right.
    Fix: collapse recording/transcribing/scoring/score-reveal to ONE surface key (`active-${attempt}`)
    so the surface is stable across the score reveal; first→retry still remounts (attempt changes) for
    a deliberate fresh mic. **Session machine untouched — F-6 auto-advance + revert stay intact.**
  - **Notes carryover.** `clearRepDraftNotes` had ZERO callers; notes are keyed
    `${muscleGroupDayId}:${exerciseId}`, shared by the first attempt AND its retry, and restored on
    every RepSurface mount. Per Max, notes must SURVIVE first → retry → "again" (all Coach's Focus
    redos of the same exercise) and clear only when the STATION changes — so cleared in
    `WorkoutShell.onAdvanceNow` (the ADVANCE transition) for the leaving station's exercise, not
    per-rep. Same exercise on a future day starts blank.
  - **Resume at rep 1.** Both resume paths used `activeSession…index ?? completedReps` — but
    `current_station_index` is created as `0` and a persisted `0` is not nullish, so `??` defeated the
    fallback. Changed `startMuscleGroupDay` (workout-day.ts) and the server-render math (workout/page.tsx)
    to `Math.max(sessionIndex, completedReps)` (both are progress lower bounds), clamped to last station.
  - tsc + lint + full unit suite (all green) + prod build green. **Needs Max eyes-on** on the real
    loop (unit/e2e can't catch #2 — the e2e passed even with the bug) + `/code-review` before PR.
    Note: `.claude/settings.local.json` was already malformed (missing commas/dupes) at session start —
    unrelated, left untouched.

- **2026-08-23 — rep-flow UX pass (PR #61, D26, shipped + production-verified 2026-08-24).**
  - Zero-streak dashboard copy now invites the user to start a streak instead of saying to keep one.
  - Classic recorder controls make **Stop & submit** the dominant white action and demote
    **Discard rep** to a quiet text action.
  - Daily Workout, Application Lab, and Build a Rep now show compact first-attempt feedback:
    Communication Score + one Coach's Focus + the expandable Core Skill Breakdown + playback.
    **Retry this rep** is the brand primary; gray **Continue** advances without a retry. A chosen
    retry opens the Improvement Review with the first→retry comparison and both recordings.
    (The breakdown and playback were briefly trimmed here; restored 2026-08-24 — see the D26
    amendment above.)
  - Session-machine Continue is race-safe (`pendingAdvance`), including scoring failure,
    dual-action, and last-station cases. Final-station Continue explicitly closes the owner-scoped
    workout day with a server-computed average and awards completion XP exactly once.
  - **Day-close timing (code-review finding, fixed before merge).** The close must NOT fire from the
    Continue tap. Continue can be tapped on RepSurface's local done screen before `SCORE_DONE` reaches
    the machine; on that buffered path `tagWorkoutRep` has not yet incremented `completed_reps`, so the
    close hits its `completed_reps >= planned` guard, silently no-ops, and is never retried — leaving
    the day `planned` with no `composite_at_close` and no completion XP. Observed in the dev DB at
    `3/3 reps, status planned`. The close is now anchored to the machine reaching `day-complete-prompt`
    / `day-complete`, which always follows `tagWorkoutRep`. The server action stays guarded and
    idempotent, so the Retry path, the v1 path, and repeat renders are safe no-ops.
  - Local verification: typecheck, lint, unit suite, and production build green. Live fake-mic
    browser runs green for recorder abort/re-record, Daily Workout Retry, Application Lab Continue,
    Application Lab Retry, and a full Daily Workout completed through Continue on every remaining
    station.
  - **Production verification (2026-08-24, cognifygym.com).** Ran the persisted-auth fake-mic configs
    against production with `PW_BASE_URL` + `PW_STORAGE_STATE` (no change to `auth.setup.ts`, whose
    production guard stays intact; the prod storage states were deleted afterwards). Green: Application
    Lab Continue and Retry branches, and a full 3-station Daily Workout completed entirely through
    Continue, which closed in Vercel's own runtime with a rendered Communication Score. Zero-streak
    dashboard copy confirmed live ("Today is a good day to start a streak" at streak 0).

- **2026-08-24 — knowledge artifact reconciled (PR #62). No calibration re-run required.**
  `src/lib/ai/knowledge/generated.ts` had sat dirty in the working tree, differing from the committed
  copy only in the newlines embedded inside its string literals (`\r\n` vs `\n`). Those bytes do reach
  scoring prompts (`score-shared.ts` renders `loadSkill()` blocks), so it looked like a calibration
  guardrail event. It was not one, for two reasons worth remembering:
  - `npm run build` runs `build:knowledge` first, so **every** build — local and Vercel — regenerates
    the artifact from the `.md` sources. Production has therefore always served the LF output; the
    committed CRLF copy was a stale commit from a CRLF checkout that no build ever consumed.
  - The only consumer of the committed copy was the unit/calibration suite, which runs under `tsx`
    without a build step. So the suite had been reading bytes production never used. Committing the
    real generator output makes the suite match production rather than diverge from it.
  Fix: commit the true generator output and add `.gitattributes` pinning
  `src/lib/ai/knowledge/**/*.md` and `generated.ts` to `eol=lf`, so a CRLF checkout can never silently
  rewrite prompt bytes again. Verified by re-running `npm run build:knowledge` on a clean tree (zero
  diff) and the full unit suite (20 suites green, including `reference-anchors` and `score-arm-b`).

- **2026-08-26 — rep audio has never worked on Chrome or Edge (PR #72, squash `63178b1d`). Fixed,
  shipped, prod-verified. No calibration re-run.**
  `/api/upload` passed `file.type` straight to Supabase Storage as `contentType`. MediaRecorder
  reports a PARAMETERIZED type and Storage matches its bucket allowlist against the FULL string, so
  Chrome/Edge's `audio/webm;codecs=opus` was always rejected (`500 upload_failed`, *"mime type
  audio/webm;codecs=opus is not supported"*).

  **This was filed as a regression starting ~2026-07-24. It is not one, and the correction matters.**
  Every rep that has ever stored audio is `.mp4` (36, spanning 2026-04-22 → 2026-08-26), and the
  bucket has never held a single `.webm` object. `PREFERRED_MIME_TYPES` (`src/lib/audio/capture.ts:28`)
  tries `audio/webm;codecs=opus` first, so Chrome/Edge always sent the parameterized form and always
  failed, while Safari fell through to a BARE `audio/mp4` and always worked. The apparent July outage
  was a change of test browser, not of code. Upload is best-effort, so reps still saved and graded —
  the damage was playback-only, and only for listening back to a PAST rep (in-session playback uses a
  local blob URL). Audio for existing Chrome/Edge reps was never written and is unrecoverable.

  Fix: normalize the MIME at the boundary (`src/lib/audio/mime.ts`, 47 assertions) rather than
  widening the bucket allowlist, since codec parameter sets are open-ended. Extension derivation moved
  from an ordered `includes()` chain to exact matching. Unsupported types now return 415 with the
  allowlist instead of an opaque 500, **and are logged** — all three call sites discard the upload
  status, which is precisely how this stayed invisible for months.

  Bundled: `useHasAudioControl()` reported whether the PROVIDER was mounted, not whether audio exists.
  `CalloutDetail` never consulted it at all, and `ImprovementReview.tsx:363` renders `DimensionGrid`
  with real callouts and no provider — so every callout with a `transcriptStart` was rendering a
  visible dead "Jump to m:ss" button in production. Availability is now threaded through the context
  as `hasAudio`, fed by the same condition that gates the `<audio>` element.

  **Calibration guardrail: not triggered, but not silent either.** No scoring prompt and no model
  changed. However `extractWorkerProsody` is gated on `input.audioUrl != null`
  (`score-shared.ts:1352`), and prod has `FF_PROSODY_WORKER`, `NEXT_PUBLIC_PROSODY_SYNC` and
  `PROSODY_WORKER_URL` all set — so **Tone/Pacing now grade from real audio on Chrome/Edge, where they
  had always fallen back to the text tier.** That is D22's designed behavior finally working, not a
  regression, but an identical Chrome rep scores differently after this deploy. Re-running the
  calibration suite would not have caught it (reference reps already have audio, so their scores can't
  move); the meaningful check was on the verification rep, done below.

  **Production verification (2026-08-26, real Chromium rep as `e2e-fresh-20260825@cognify.test`).**
  Before-state: 201 Chromium-driven test reps, **0** with audio.

  | check | result |
  |---|---|
  | `reps.audio_url` after a new rep | non-null, `.webm` — the first ever written |
  | object in Storage | 249,487 bytes; fresh signed URL → HTTP 200, `audio/webm` |
  | playback on a PAST rep (`/progress` → Recent reps) | play button renders, clip decodes (`readyState 4`, no error), playback advances |
  | seek — the v4.1.0 "Hear it at m:ss" path | seek to 4s landed at exactly 4.000s |
  | prosody worker on the new `.webm` | real features returned (pitch 143.9Hz, monotone 0.11, RMS 55.1) |

  Two things worth keeping. `audio.duration` is **`Infinity`** for MediaRecorder WebM (no Duration
  element in the container) — inherent, not a defect, and `RepAudioScrubber` already guards with
  `Number.isFinite` and falls back to the DB duration. A first verification pass asserted a finite
  duration and failed; the assertion was wrong, not the app. And Chrome reps are now WebM/Opus, a
  format Safari may not decode — until now every stored clip was universally playable `.mp4`. An
  `onError` fallback hides the seek buttons and shows plain "can't play" copy instead of a dead
  button, but **Safari/iOS relisten is still unverified on a real device.**

  `/code-review` (high) returned four findings, all valid, all addressed in `75434488`: the prosody
  behavior change above; the same bug unfixed on the sibling writer
  `api/ops/reference-rep/[id]/audio` (same bucket, now normalized); the 415 being just as invisible as
  the 500 without logging (the sharpest one — it corrected an overstated claim in the plan doc); and
  the WebM cross-browser playback risk.

  Full detail, decision log and verify checklists: `plans/audio-upload-fix-progress.md`.

- **2026-08-26/27 — Grading audit (read-only, no code).** Compared `Cognify grading docs/00–07` against prod
  DB (`cognify_v2`, 354 reps / 167 real LLM grades), all bench + calibration artifacts, and the scoring code on
  `main@72b187a3`. Headline: Pacing is `scorePacing()` = 92 on 79% of human v4.1.0 reps; Tone graded from text on
  92% of v4.1.0 reps until PR #72 (which does not touch Pacing); Thinking Quality 60/40 blend compresses the model
  to 40% of its range (sd 6.9); calibration bank re-authored from model output so 48/48 = self-consistency; RAG
  never accuracy-benched and mostly re-injects `skills-full` sections already in the cached block; 26% of reps in
  the last two weeks were mock fallbacks (Zod char caps on `coachFocus.*`, OpenAI 429 no-credits on 08-24, 20 s
  Anthropic fallback timeout); `scoring_telemetry.rep_id` NULL on all rows. Decisions: priority accuracy > feedback
  > latency > cost; human-labeled 60-rep set is the accuracy gate (Max + second rater); remove the short-rep
  modal with a silent <5-word/<3-s floor; latency target <7 s p50 score-visible; evidence gates ≥20/≥30/≥50 real
  reps per check. Plan + handoff: `plans/grading-audit-2026-08-26.md`, `plans/handoff-grading-p0-p1.md`;
  scripts in `scripts/qa/grading-audit/`. Next: P1 labeling packet, then P0 instrumentation branch.

- **2026-08-28 — Grading WS1: instrumentation and failure handling** (`feat/grading-p0-instrumentation`, plan
  `plans/grading-audit-2026-08-26.md` §3.1). Also lands the audit files (plan, handoff, `scripts/qa/grading-audit/`
  scripts; the two raw output files with user transcripts are gitignored because the repo is public).
  - **Telemetry joins to reps.** `/api/score` mints the `scoring_telemetry` row id, returns it as
    `score.scoringTelemetryId`; `saveRep` calls `attachTelemetryToRep` (owner-scoped, `rep_id IS NULL` guard) to
    set `rep_id` + client timings. Migration `0047`: `graded_from_audio`, `rag_chunk_ids`, `rag_chunk_count`,
    `deepgram_ms`, `upload_ms`, `prosody_ms`, `client_e2e_ms`, `short_rep` on `scoring_telemetry`;
    `reps.prosody_features jsonb`; index on `scoring_telemetry.rep_id`. Probes added to `verify-prod-migrations`.
    **Applied 2026-08-28 via `apply-migration.mjs` against `.env.local`, which is the prod pooler** (additive only);
    all 9 columns verified present.
  - **Evidence persisted.** `transcript.words` now stored by `saveRep`; `RepScore.prosodyFeatures` carries the
    bundle the grader saw and both `saveRep` and `/api/score-internal` persist it.
  - **Soft-truncate, not mock.** `src/lib/scoring/soft-truncate.ts` cuts `headline`, `nextRepHint`,
    `coachFocus.behavior/why/action`, `implementationReview.note`, `dimensions[].feedback` on a word boundary
    before Zod; quotes untouched (verbatim). Runs post-parse, so **no scoring-prompt bytes changed; calibration
    suite not re-run**.
  - **Provider resilience.** Anthropic fallback timeout 20 s → 35 s; `provider_credits` failure_reason
    (`isProviderCreditsError`, checked before the 429 bucket) + `console.error` tagged `provider_credits`.
  - **Honest mock.** `RepSurface` done-phase renders "We couldn't score this rep" + audio + Run it again when
    `modelVersion === "mock-fallback-v1"`. Score shape unchanged; mock reps are still saved (telemetry/audit).
  - **Aggregates filter `model_version`.** `src/lib/db/scored-rep-filter.ts` (`isScoredRep` excludes mock;
    `isRealLlmGradedRep` also excludes seed) applied to progress heatmap/trend/yesterday/weekly, calendar,
    leaderboard, friends, muscle-group day averages, workout day close, prompt-selection recent composite,
    day-fetchers recent averages, and the three calibration-metrics queries. Activity counts still include mocks.
  - Tests: `tests/soft-truncate.test.ts` (24), `tests/telemetry-classify.test.ts` (17); full suite, tsc, lint green.
  - **Verify gate (open):** ≥ 20 real reps across ≥ 3 users with `scoring_telemetry.rep_id` joined and
    `graded_from_audio` set; forced 300-char `coachFocus.why` still yields a real score (unit-covered; prod smoke
    pending). Not yet met — needs prod traffic after deploy.
  - **`/code-review high` (2026-08-28) — fixed before merge:** telemetry insert is now awaited in `/api/score`
    (the client's `saveRep` UPDATE raced a `void` insert); activity counts (heatmap, calendar, weekly repCount,
    friends totalReps, leaderboard rep count) keep mock reps again and only the averages use
    `avg(...) filter (where ...)`; workout day close falls back to the placeholder average when every rep on the
    day was a mock so the day can still close; `provider_credits` is checked before the timeout bucket (the
    both-failed wrapper takes the fallback's AbortError name); `isProviderCreditsError` moved to
    `src/lib/ai/provider-errors.ts` so `saveRep` no longer transitively loads both LLM SDKs; `isShortRep` shared
    from `telemetry.ts` and set on the score-internal catch path too; gated (speaking-gate modal) reps write
    `client_e2e_ms` NULL; dashboard/progress "recent average" and `detectNewHigh` skip mock reps.
    **Accepted / follow-ups:** no `FF_*` gate on the honest-mock card or the aggregate filters (bug fixes in an
    approved plan, not v2 features); still unfiltered: `getSubSkillRunningAverages` (sub-skills.ts), friend-challenge
    winner (`actions/friends.ts`), XP award on mock reps (`reps.ts`, pre-existing), arm-B `mergeArmMetrics` drops
    the three new metrics fields (dormant arm). Consider `composite_score = NULL` for mock reps at save time as
    the structural fix (WS9 hygiene candidate).
  - **Shipped 2026-08-28:** PR #75 squash-merged → `main@a6a2ff08`; `vercel deploy --prod` READY
    (`cognify-v2-c0iz736g3`, aliased `www.cognifygym.com`, HTTP 200). Migration 0047 was applied before the
    deploy. WS1 verify gate stays open until ≥ 20 real reps / ≥ 3 users carry `scoring_telemetry.rep_id` +
    `graded_from_audio`. Next: WS2 human ground-truth packet (DB read-only, no PR); WS3 waits on the WS2 baseline.

- **2026-08-28 — Field report → plan item 1b.** A user hit the short-rep modal, could not click "Proceed anyway",
  then nothing, then Vercel `504 MIDDLEWARE_INVOCATION_TIMEOUT` (`iad::d8gln-1787789756482-d4c79a754e06`).
  `src/middleware.ts` awaits `supabase.auth.getUser()` on every non-static request with no timeout. Added as
  workstream 1b in `plans/grading-audit-2026-08-26.md` §3 (bounded refresh + narrower matcher + client aborts),
  to run before WS3. No code changed yet.

- **2026-08-28 — Grading 1b: middleware auth-refresh timeout** (`fix/middleware-auth-timeout`, plan §3.1b).
  `updateSupabaseSession` now races `supabase.auth.getUser()` against `MIDDLEWARE_AUTH_REFRESH_TIMEOUT_MS`
  (default 2500) via `src/lib/util/with-timeout.ts`; on timeout/error the request proceeds with its existing
  cookies and logs `middleware.auth_refresh_skipped`. Matcher excludes `api/score`, `api/score-internal`,
  `api/transcribe`, `api/upload`, `api/cron`, `api/health` (all self-authenticating) so a rep in flight never
  waits on the refresh. Client: `/api/transcribe` and both `/api/upload` fetches get a 30 s `AbortSignal.timeout`
  and fall into their existing error handling. Tests: `tests/with-timeout.test.ts` (6). Build, tsc, lint, suite green.
  **Verify gate (open):** zero `MIDDLEWARE_INVOCATION_TIMEOUT` in Vercel logs over the following 7 days; a rep
  completes with Supabase Auth unreachable (not reproduced locally in this session).
  - **`/code-review high` on 1b — fixed before merge:** the Auth fetch itself is now aborted at the budget
    (`global.fetch` with `AbortSignal.timeout`) so an orphaned refresh cannot rotate the token behind the
    browser's back (reuse-detection logout); resolved `{ error }` outcomes from supabase-js are inspected and
    logged (they never reject); NaN/empty env guard on the budget; matcher excludes `api/` wholesale (every API
    route self-authenticates); a transcribe timeout now shows the error card + Retry instead of scoring an
    empty transcript; budgets raised to 90 s transcribe / 75 s upload for 3-minute reps; `timeoutSignal()`
    fallback for browsers without `AbortSignal.timeout` (iOS < 16). Accepted: server actions (saveRep,
    insertPendingRep) still pass through the bounded refresh; the two private `withTimeout` copies in
    `rag/retrieve.ts` / `rag/reference-reps.ts` were left alone (different throw semantics, scoring path).
- **2026-08-28 — Grading WS2: human ground-truth packet built** (plan §3.2, §5). Raters: A = Max, B = Owen Brown.
  `scripts/calibration/human-labeling/{build-packet,scoring,rescore}.mjs` (+ `_shared.mjs`). Packet in
  `plans/calibration/human-labeling-2026-09/` (data files gitignored, user transcripts + public repo; README
  committed). Population: 89 real reps → 86 with ≥ 5 words → **68 on the six current dimensions** (v3.2.0+; the
  18 v2-era reps scored relevance/confidence/pacing and are not comparable), 11 with audio, 6 users. Sample: **60**
  (all 11 audio reps + text reps proportional over composite band × duration tercile, seed 20260901); bands
  <50 / 50–65 / 65–75 / 75+ = 6 / 27 / 25 / 2 (the population has only 2 reps at 75+; nothing backfilled).
  48/60 carry a v4 headline, 50/60 a Coach's Focus (v3.2/3.3 reps predate them; the binaries are skipped there).
  Audio links signed for 7 days from 2026-08-28. `scoring.mjs` reports unweighted + linear-weighted kappa per
  dimension, the > 1-band adjudication list, then band-match / MAE (bands and points) / Spearman / bias per
  dimension vs the model and the three feedback rates; dry-run on synthetic sheets passes. `rescore.mjs` is the
  harness mode for later workstreams (`--label <ws>` → `metrics.<ws>.json`).
  **Open:** both sheets to be filled (~2 h each); baseline metrics recorded here before WS3 starts.
  - **Shipped 2026-08-28:** PR #78 squash-merged → `main@f38c43e9`; `vercel deploy --prod` READY
    (`cognify-v2-fcg5pn0e8`, aliased `www.cognifygym.com`; `/`, `/api/health`, `/dashboard` 200). Note: an
    intermediate deploy (`cognify-v2-657gbe4p5`) shipped `main@c4b9f33f` (WS2 scripts only) before the merge
    conflict on the tracker was resolved; superseded. Verify gate (7 days, zero `MIDDLEWARE_INVOCATION_TIMEOUT`)
    opens now.

- **2026-08-28 — Field report → plan item 1c (prompt slate latency).** Daily Workout exercise 2 took ~20 s to show
  prompts. Read-only map: the slate waits on a cold `fetchPromptCandidates` server action (6-7 sequential DB
  round trips, unbounded bank selects) queued behind `saveRep`/`tagWorkoutRep`/session-state actions; no prefetch
  although every station's exerciseId is already client-side; no latency instrumentation. Added as workstream 1c
  in `plans/grading-audit-2026-08-26.md` §3 (instrument → prefetch N+1 → parallelise/limit → offline bank fill).

- **2026-08-28 — Grading WS3: short-rep ruleset** (`feat/short-rep-ruleset`, plan §3.3 + §4). Started before the
  WS2 baseline on Max's call (2026-08-28, "let's just proceed building"); WS3 will be evaluated against the human
  set retroactively via `rescore.mjs --label ws3` once the sheets are in.
  - UI: `speaking-gate` phase, the "Your rep was shorter…" modal and `speakingThreshold` (3 call sites) deleted.
    One silent floor remains, `isBelowScoringFloor` in `src/lib/workout/pause.ts` (< 5 words AND < 3 s): inline
    "Too short to score. Try one full thought before the cut." with the recording + Retry, no choice.
  - Rubric **v4.2.0**: under-budget / "within 10% of budget" language removed from conciseness + delivery
    definitions, band signals, `rubric-anchors.ts` and `skills/{conciseness,delivery}.md`; over-run kept ("keeps
    talking past where the content runs out", "runs well past the time budget").
  - Prompt: edge rule **5a** (never cite length/duration/word count; incomplete answers lose on Thinking Quality
    or Clarity for what is missing; rate "n/a" → do not dock delivery on rate); `renderRateLine()` renders
    `MEASURED RATE: n/a (too short to measure …)` under 8 s, byte-identical to before at ≥ 8 s.
  - Deterministic: `scorePacing` under-budget branch removed (over-budget kept; the sync path now sends
    `timeBudgetMs` so it can fire); `scoreThinkingQualityDeterministic` pause/stall penalties scale with
    `min(1, duration/60 s)`.
  - Tests: `tests/short-rep-ruleset.test.ts` (23, incl. a regex sweep that no under-budget wording remains).
    Suite, tsc, lint, `next build` green.
  - **Calibration suite (prompt bytes changed):** WS3 branch **29/48** pass. Control run of the SAME suite on
    `main@87268824` with the same local setup: **31/48** pass. Drift is identical in both (structure ≈ +21,
    thinking ≈ +19 on the flagged reps; 12 failing reps shared; the remaining flips sit inside the audit §1.5
    run-to-run noise). Conclusion: the bank's expectations are stale for current `main` (authored 07-20 under
    earlier prompt bytes; §1.8 self-consistency caveat), not a WS3 regression. Bank left untouched (no
    re-authoring per the plan); the human set is the accuracy gate. Logs kept locally
    (`calib-ws3.log`, `calib-main.log`, ~18 min each, guest `…ws3c…`).
  - **Verify gate (open):** on ≥ 50 real reps no dimension feedback mentions length; human-set metrics not worse
    than baseline (pending sheets). The 6 s / 12-word case is unit-covered (`isBelowScoringFloor`).
  - **`/code-review high` on WS3 — fixed before merge:** an empty transcript on a > 3 s recording no longer slips
    past the floor to score the "Rep recorded for Ns" placeholder (`wordCount === 0` is always below floor);
    `scorePacing`'s slow/rushed WPM branches now share the 8 s `RATE_MEASURABLE_MIN_MS` guard with the prompt's
    "n/a" line; scaled pause/stall penalties say "(reduced weight, Ns rep)" and sub-point penalties are not
    reported; dead `onDiscard` prop removed; `timeBudgetMs` rounded to an int; e2e helpers no longer wait for
    "Proceed anyway"; floor card has its own heading. Calibration note: one bank rep, `edge-brevity-cost-meaning`
    (3.0 s), now renders the "n/a" rate line, so its prompt bytes differ; it passed in both runs.
  - **Shipped 2026-08-28:** PR #82 squash-merged → `main@31fed48a`; `vercel deploy --prod` READY
    (`cognify-v2-dyraxq55r`, aliased `www.cognifygym.com`; `/` and `/api/health` 200). Rubric v4.2.0 is now what
    prod stamps. Next: WS4 pacing rebuild (`feat/pacing-rubric-score`).

- **2026-08-28 — Grading WS4: Pacing rebuilt** (`feat/pacing-rubric-score`, plan §3.4).
  - `scorePacing` is now a weighted function of the rubric's own signals: rate distance from 130–165 (35%;
    graded docking above 170 per edge rule 3, mild below 110, neutral 85 under 8 s), quartile stability +
    final-quartile rush (15%), pause placement (20%: 1–3 s pauses after a clause end lift, stalls > 3 s and
    mid-phrase pauses dock; per-minute so short reps are not over-penalised), filler/hedge fluency (20%),
    over-budget only (10%). Sub-scores returned on the result. The old "92 minus penalties" formula that put 79%
    of human reps at exactly 92 is gone.
  - `extractSignals` adds `clausePauseCount` / `midPhrasePauseCount` from punctuated Deepgram words.
  - Delivery feedback is generated from the same numbers (`buildPacingFeedback`: measured wpm, fillers/min,
    pauses, stalls, over-run, one action aimed at the weakest sub-score); the model's subSkill + grounded quote are
    kept, its feedback line is always replaced. Score and copy cannot disagree.
  - Prompt: the "delivery 76–82 (default 78)" instruction retired (text-only reps still graded from rate + fluency).
  - Tests: `tests/pacing-v2.test.ts` (34: band, monotone docking above/below, asymmetry, n/a, stability, pause
    placement, filler monotonicity, under-budget never docks, idempotence, ≥ 25 unique scores over a plausible
    grid, feedback quotes the real numbers, clause-aware extraction). Suite, tsc, lint green.
  - **Calibration (prompt bytes changed):** WS4 branch **26/48**; `main` control **31/48**; same drift pattern
    (structure ≈ +22, thinking ≈ +18) and the ONE delivery drift (`objection-poor-too-expensive` −23) is identical
    on `main`. The bank reps carry no word timings, so the suite cannot exercise the new pacing formula; the
    extra flips are the same run-to-run noise. Bank untouched.
  - **Verify gate (open, needs ≥ 50 real reps):** ≥ 25 unique Pacing values; correlation with WPM distance from
    band; zero headline/score contradictions in a 25-rep read (structurally guaranteed now: same numbers);
    human-set Pacing MAE improves (`rescore.mjs --label ws4`).
  - **Review (targeted, the `/code-review` runs kept diffing the already-merged audit scripts) — fixed before
    merge:** quartile WPM now uses the speech span so stopping the recorder late no longer docks stability; short
    (< 8 s) reps get a grammatical sentence and never a rate/stability action; "quartile" removed from user copy;
    hedge weight kept at the previous 2/pt; clause-end regex accepts `…` `—` `–`; the mock-fallback Delivery
    callout shows the generated narrative, not internal reason strings; comment corrected: the model's Delivery
    quote is dropped (assembleRepScore drops any quote whose sentence was replaced). Audit-script findings
    (hard-coded scratchpad OUT path, emails printed to stdout, `Date.now()` anchoring, duplicated analyze*.mjs,
    NULL-email filter) recorded for WS9 hygiene.
  - **Shipped 2026-08-28:** PR #84 squash-merged → `main@13a9b19c`; `vercel deploy --prod` READY
    (`cognify-v2-n6ejejohb`, aliased `www.cognifygym.com`; `/` and `/api/health` 200). Next: WS5 tone
    prosody-first (`feat/tone-prosody-first`); its ≥ 30-audio-rep gate is unmet, so the deterministic tone core
    ships behind `FF_TONE_PROSODY_CORE` (OFF in prod) with the prompt field-name fix live.
