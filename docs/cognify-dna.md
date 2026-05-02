# Cognify — DNA

Last revised: 2026-05-01 · Version: v3.0.0 (DNA reconciliation)

This document is the founding spec for Cognify. It supersedes the
April 2026 Word doc (archived at `docs/archive/cognify-dna-2026-04.docx`),
which was "how"-heavy and missed five of the six questions a foundational
doc should answer. This rewrite is structured around those questions:
Who, What, Where, When, Why, How.

---

## Who

Cognify's long-term thesis is that communication is a near-universal
need and that almost no one is trained to do it deliberately. The
addressable market is, eventually, anyone who needs to be understood —
which is everyone with a job and most people without one.

That's the long arc. The wedge is sharper.

**Initial wedge segment:** knowledge workers, ages 25–40, who already
spend the equivalent of a workday per week in high-stakes spoken
moments — sales pitches, board updates, internal reviews, performance
conversations, customer briefings — and who already use daily-habit
apps (Duolingo, Headspace, Whoop, Strava). The wedge is defined by
three traits:

1. **High frequency of stakes.** Their week is defined by moments
   where a spoken response moves money, trust, or career.
2. **Daily-habit literacy.** They've already proven they'll log into
   an app every day to train a measurable thing.
3. **No existing training.** Nobody at their company is teaching them
   communication. Toastmasters is too slow. A speech coach is too
   expensive. Reading a book is too passive.

The bar for picking this wedge is that one stranger, after reading
this paragraph, can describe Cognify's first user in a sentence:
*"the salesperson at the Series-B startup who already does Duolingo
every morning."* If you can't picture them, the wedge isn't sharp
enough yet.

We expand from this wedge outward — first to adjacent knowledge-worker
roles (PMs, founders, engineers preparing for design reviews),
eventually to the broader universe of anyone preparing for a spoken
moment. The expansion is organic; the wedge is deliberate.

---

## What

Cognify is a daily speaking gym. Users complete short spoken reps
(typically 30–90 seconds), get scored across six research-grounded
dimensions, and receive grounded, sub-skill-specific feedback they can
apply immediately to their next rep.

What makes Cognify defensible — the actual IP, not "proprietary
algorithms":

1. **The Sub-Skill Map** (`src/types/sub-skills.ts`) — 36 sub-skills
   across the 6 dimensions, drawn from communication research and
   refined through internal calibration. Most scoring systems return
   "Clarity dropped." Cognify returns "Word Choice broke down within
   Clarity" and routes the user into a drill that targets that
   specific lever. The map is the diagnostic backbone; the rest of
   the system is built on top of it.
2. **The Calibration Harness** (`scripts/calibrate-scoring.mjs` +
   `scripts/calibration/reference-reps.json`) — a hand-graded
   reference bank that gates every scoring-prompt change in CI. AI
   scores must agree with our human scoring within ±5 per dimension
   before any rubric or prompt change ships. This is what keeps the
   AI honest as the model evolves.
3. **The Prosody Pipeline** (`src/lib/audio/prosody-inline.ts` +
   `infra/prosody-worker/`) — Tone scoring grounds in raw audio
   features (pitch variance, downward inflection ratio, monotone
   ratio, articulation proxy) extracted via parselmouth/Praat, not
   guessed from a transcript. Most "AI feedback" tools score Tone
   from text; Cognify scores it from the actual voice signal.
4. **The Mode-Aware Feedback Loop** (`src/lib/ai/score.ts`
   ScoreRepInput.modeContext) — every rep's feedback is framed by what
   the user was trying to train. A focus-mode rep on Clarity gets
   Clarity-targeted feedback; a pressure rep gets archetype-aware
   feedback; a Daily Workout rep gets carry-over feedback referencing
   the previous rep's weakness.

The user-facing experience is a daily-habit app: open the phone, tap
in, run a 4-rep workout in 5–7 minutes, get a level-up celebration
when the streak earns it, watch the per-dimension averages move over
weeks. The experience is gym-like (rep, score, next rep) rather than
classroom-like (lesson, quiz, lesson).

---

## Where

Cognify runs anywhere there's an internet connection and a microphone.
The product is a Next.js web app deployed on Vercel
(`maxvolkov202s-projects/cognify-v2`). Users open
`cognify.com` (production) on phone, laptop, or tablet, sign in once,
and the app keeps state across devices.

Mobile install path is on the roadmap as a PWA — the product already
works in a mobile browser; the install layer is a polish step. There
is no native iOS/Android app planned for the wedge phase: the friction
of an install would shrink the daily-habit funnel, and a PWA covers
~95% of what a native app would offer.

---

## When

Anytime. The product assumes a user shows up once a day for 5–10
minutes — the same time-of-day they already use Duolingo or Headspace
— and the workout fits inside that window. Reps don't need preparation
the way a Toastmasters meeting or a coaching session does; the prompt
is generated on-demand and the speaking happens immediately.

Practice is on-demand and asynchronous. Users don't book a session,
don't wait for a coach, don't coordinate with a peer group. The speed
from "I want to train" to "I am training" is roughly 8 seconds —
sign-in to first rep prompt.

---

## Why

This is the section that defends the design decisions. Each subsection
answers a "why this and not something else" question.

### Why communication matters

The case is empirical and well-documented:

- 85% of career success is attributed to communication skills; only
  15% is technical expertise.
- Effective communicators earn ~20% more in salary on average.
- 93% of employers cite communication skills as essential when hiring
  and promoting.
- Poor communication costs businesses over $26,000 per employee per
  year in productivity losses.
- 86% of employees cite ineffective communication as the primary
  cause of workplace failures.
- 46% of people cite "creating a compelling, structured story" as
  the most challenging part of communication preparation.

Cognify exists because the gap between how much communication matters
and how little it's deliberately trained is one of the largest skill
gaps in any domain.

### Why these six dimensions and not four or eight

The six dimensions — Clarity, Structure, Conciseness, Thinking
Quality, Delivery, Tone — were selected against three filters:

1. **Research foundation.** Each dimension maps to at least three
   independent research traditions. Clarity → Cognitive Load Theory
   (Sweller), Curse of Knowledge (Pinker), Audience Design (Clark &
   Murphy). Structure → Schema Theory (Bartlett), Chunking (Miller),
   Narrative Transportation (Green & Brock), BLUF (US Military),
   Monroe's Motivated Sequence. And so on for the remaining four.
   The full citations live per-skill in
   `src/lib/ai/knowledge/skills/*.md`.
2. **Detectability in a one-way audio rep.** Each dimension produces
   measurable signals in 60 seconds of recorded speech — text
   features (idea density, transition frequency, hedge count),
   timing features (rate, pauses, fillers via Deepgram word
   timings), or prosodic features (pitch variance, downward
   inflection via parselmouth). Dimensions that would require
   bidirectional dialogue or video (e.g. eye contact) were
   intentionally excluded.
3. **Trainability in 60-second reps.** Each dimension can be
   meaningfully moved by a focused drill in under a minute of
   speaking. Dimensions that require 20-minute presentations to
   measure (e.g. extended argument structure) were excluded or
   absorbed into a smaller-scope sub-skill.

Six survives those filters. Four would lose either Tone (no audio
training in any other tool) or Thinking Quality (the substance
filter). Eight would split dimensions that share signal (e.g.
splitting Pacing from Tone) and fragment the user's mental model.

The six are weighted Clarity 25 / Structure 20 / Thinking Quality 20
/ Conciseness 15 / Delivery 10 / Tone 10. Weights live in a single
constant (`DIMENSION_WEIGHTS` in `src/types/domain.ts`) so the math
is consistent across composite scoring, dashboard, and calibration.

### Why daily AI reps over alternatives

The competitive landscape:

- **Yoodli** records you speaking and surfaces filler/pace metrics.
  It's a recording tool with metrics; there is no curriculum, no
  scoring against a rubric, no weakness-targeted next rep, no
  progression. Useful as a mirror; not a gym.
- **Poised** is a meeting overlay that scores you in real-time during
  a real meeting. Different product entirely — surfaces signals
  during live calls, doesn't train deliberate practice.
- **Orai** is an iOS app focused on speech delivery (rate, fillers,
  energy). Narrower scope (delivery only), no thinking-quality or
  structure scoring, no rep-to-rep continuity.
- **Toastmasters** is the gold-standard human-graded format. Weekly
  cadence, peer-graded, social. Cognify is daily, AI-graded,
  asynchronous — different niche, complementary rather than
  competitive.
- **Speech coaches** are the gold-standard 1:1 format. $200–$500/hour,
  weekly at most, hard to scale below the executive tier.

Cognify's claim is daily + AI + objectively scored against a
calibrated rubric + sub-skill diagnostic + weakness-targeted next
rep. None of the alternatives offer that combination. The bet is
that the daily cadence + the diagnostic depth compounds into
measurable growth that weekly human-graded systems can't match for
the same dollar cost.

### Why a progression / engagement system

Lally et al. (2010) on habit formation: ~66 days of daily repetition
to reach behavioural automaticity. Most users won't hit 66 days
without external structure (streak, level, achievements). Duolingo's
streak system is the proof at scale — a 95%+ retention difference
between users with vs. without an active streak.

Cognify's progression system (XP / Levels 1-100 / streak multipliers
/ achievements / leagues / daily quests) is engineered to make the
first 90 days of daily use addictive enough to outlast the
motivation phase and reach the habit phase. The level curve is
deliberately hyperbolic so early-stage users get visible momentum
(matches the gym-day-one feeling) and late-stage users hold a level
that genuinely means something. Level 100 is the chase; almost no
one will reach it.

### Why operator-tunable rather than fully autonomous

The scoring rubric, the dimension weights, the edge-case rules, and
the prompt bank are all operator-tunable through versioned config
files. The bet is that early calibration drift — between AI scores
and human-grader judgment — needs human-in-the-loop tuning, not
self-supervised improvement. The calibration harness gates every
rubric change so we can prove the AI agrees with us before users see
the new behavior.

Eventually the system can self-tune from accumulated user-feedback
data (the calibration tile + correction flow already collects this).
For now, operator control is the safer default.

---

## How

(Unchanged from the prior doc; carried forward verbatim where it
read cleanly. Minor edits where the prior content was repetitive.)

The "how" section is the technical core that the original DNA doc
already covered well: signal-detection architecture, weighted
scoring rubrics with strict calibration philosophy, inter-skill
independence rules, edge-case grading guidelines, the Levels 1-100
progression system, and the live skill dashboard.

That content is now distributed across the codebase as the source of
truth:

- **The 6 dimensions and the sub-skill map** —
  `src/types/domain.ts`, `src/types/sub-skills.ts`,
  `src/lib/ai/knowledge/skills/*.md` (per-dimension research
  foundations + scoring boundaries + exemplar callouts).
- **The scoring pipeline** — `src/lib/ai/score.ts` (the AI prompt +
  Zod schema + sanitizers), `src/lib/scoring/rubric.ts` (rubric
  anchors + composite math), `src/lib/scoring/deterministic.ts`
  (deterministic Delivery scorer from Deepgram word timings).
- **The prosody pipeline** — `src/lib/audio/prosody.ts` (feature
  type), `src/lib/audio/prosody-inline.ts` (rate / fillers / pauses
  from word timings), `src/lib/audio/prosody-worker.ts` (HTTP
  client), `infra/prosody-worker/` (parselmouth-based Python
  reference impl + Modal deploy).
- **The calibration harness** —
  `scripts/calibrate-scoring.mjs` + `scripts/calibration/`.
- **The progression system** — `src/lib/progression/levels.ts` +
  `src/lib/progression/xp.ts` + `scripts/backfill-progression.mjs`
  + `src/components/product/LevelPill.tsx` +
  `src/components/product/LevelUpCelebration.tsx`.
- **The engagement system** — `src/lib/engagement/achievements.ts`
  + `src/lib/engagement/achievement-rules.ts` +
  `src/components/product/dashboard/StreakCalendar.tsx`. Leagues +
  daily quests are in flight (Ch.9b + Ch.9d).
- **The dashboard** —
  `src/components/product/dashboard/LevelStreakCard.tsx` +
  `WeakestLinkCard.tsx` + `StreakCalendar.tsx` mounted in
  `src/app/(app)/dashboard/page.tsx`.

Implementation history is tracked per-chapter in
`~/.claude-personal/plans/jolly-giggling-dahl.md` (master plan) and
the per-chapter PR branches (`feat/dna-ch{N}-*`).

---

## Versioning

This doc is versioned with the rubric. v3.0.0 of the rubric
corresponds to v3.0.0 of this doc. Bump both when material changes
land — rubric weights, dimension renames, score-band thresholds.

Prior versions:
- **v3.0.0** (2026-05-01) — DNA reconciliation: Adaptability → Tone,
  prosody pipeline, sub-skill grading, calibration harness,
  progression system. This doc.
- **v2.0.0** (2026-04-24) — initial 6-dimension rubric (Clarity,
  Structure, Conciseness, Thinking Quality, Delivery, Adaptability).
- **v2-beta** (earlier) — relevance / confidence / pacing / tone
  legacy names; aliased forward via
  `src/lib/scoring/dimension-aliases.ts`.

---

## Open questions for the team

These are the live debates that should resolve into the next doc
revision:

1. **Wedge segment scope.** "Knowledge workers 25-40 who use
   daily-habit apps" is a thesis, not a tested go-to-market. Does
   it survive contact with the first 100 paying users? If not,
   sharpen.
2. **Prosody worker infra ownership.** Modal is the recommended
   deploy target; if traffic justifies it, owning the infra
   in-house (Vercel Python Functions or self-hosted) might be
   cheaper at scale.
3. **Progression mechanics balance.** Streak multipliers + XP +
   leagues + achievements + daily quests is a lot of mechanics. The
   Duolingo proof says all of them work together; we should validate
   that the combination doesn't feel slot-machine-y to our
   knowledge-worker wedge (different vibe than the language-learning
   audience).
4. **Tone scoring confidence display.** When the prosody worker is
   offline, Tone scores are LLM-only and flagged
   `prosodyAvailable: false`. The UI should badge those scores
   visibly so users implicitly trust prosody-grounded Tone scores
   more — design surface TBD.
