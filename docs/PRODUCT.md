# Cognify — Product Vision

## The problem

Communication is the #1 most in-demand skill globally (LinkedIn, 2024). Yet less than 50% of graduates meet employer expectations. Under pressure, even smart, well-prepared people lose structure — they ramble, overthink, and lose the thread.

It's not a knowledge problem. It's a practice problem. There is no system to practice communication the way you practice the guitar, lifting weights, or a new language. Existing tools either teach theory (courses), analyze delivery after the fact (Yoodli, Orai), or simulate specific scenarios (Hyperbound). Nothing trains the underlying skill.

## The solution

Cognify is a gym for communication. Short, structured reps. Instant feedback. Compounding improvement. Three modes, one core loop.

### The core practice loop

Every rep in every mode:

```
Prompt → Think → Speak → Instant feedback → (Retry) → Advance
```

- **Prompt**: Text with optional metadata (audience, tone, constraints). Large type, countdown.
- **Think**: 3-second ready countdown. No notes.
- **Speak**: Voice capture with visible timer and waveform.
- **Feedback**: Scoring across six dimensions with transcript-anchored callouts.
- **Retry**: Re-run with previous weaknesses highlighted.
- **Advance**: Next rep in the session, or exit to dashboard.

### Mode 01 — Daily Workout

The habit engine. 10 minutes, 4–5 reps, every day.

- One-tap start. Zero typing.
- Spaced repetition — prompts target the user's weakest skills.
- Difficulty ramps as baseline scores rise.
- End of session: composite score, deltas, "what improved / what to watch", streak updated.

### Mode 02 — Skill Lab

Isolate one skill. Drill it. No session cap.

- Six skill tiles: Clarity · Structure · Conciseness · Thinking on the spot · Handling pressure · Adaptability
- Per-skill drill banks specifically designed to stress the target skill
- Scoring scoped to the target skill for signal clarity
- Prominent "Run another" — volume is the point

### Mode 03 — Scenario Training (the marquee feature, the IP core)

User types a real scenario. Cognify generates a framework for thinking, not a script.

1. **Scenario input**: Large text field. Example chips. "What do you need to handle?"
2. **Context drawer**: Audience, key points, desired outcome, constraints.
3. **Framework generation**: Claude Opus 4.6 analyzes the scenario and picks or composes a framework (CDI, SCQA, PSPA, BIE, custom). Each framework has named nodes with one-line descriptions.
4. **Framework preview**: User can swap frameworks or edit nodes.
5. **Rep**: User speaks holding the framework in mind. Framework nodes visible as a subtle on-screen anchor.
6. **Structural-adherence feedback**: Net-new scoring dimension — did the user hit each framework node? In order? With the right emphasis?
7. **Refine**: Run again. Cognify surfaces a diff: "Your 2nd attempt landed the Impact node you skipped the first time."

## The six trainable skills

| Skill | What it means | What a low score looks like |
| --- | --- | --- |
| **Clarity** | Ideas land on the first hearing; no ambiguity. | Listener has to re-interpret; words like "thing", "stuff", unspecified pronouns. |
| **Structure** | Ideas follow a logical flow; openings, transitions, closings are visible. | Jumping between topics, no visible scaffolding, weak openings. |
| **Conciseness** | Maximum signal per word. | Filler, hedge words, repetition, going over time. |
| **Thinking on the spot** | Generating coherent responses without preparation. | Long pauses, verbal backtracking, "let me start over". |
| **Handling pressure** | Staying sharp when the stakes feel real. | Voice tightening, rushing, losing previously-made points. |
| **Adaptability** | Adjusting message to audience and feedback mid-stream. | Same delivery regardless of audience cues or constraints. |

## Cross-cutting improvements (over v1)

These directly address the advisory meeting feedback.

### 1. Progress visualization

v1 shows a single rep's score. v2 shows improvement over time, with evidence.

- Per-skill line charts over 7/30/90 days
- Streak heat map
- Cohort percentile
- **Side-by-side rep comparison**: play rep #1 next to rep #5 on the same prompt
- Quantified improvement receipts after every session

### 2. External validation mode — the measurability flagship

Directly implements David's validation suggestion (5 sessions + unbiased listener ranking).

- User runs 5 reps on a topic over a week
- System generates a public blind-ranking link (anonymized, randomized)
- Unbiased listener ranks them without seeing scores
- Aggregated ranking returned: "4 of 5 listeners ranked your 5th attempt as the clearest"
- Works as pitch proof, enterprise validation artifact, and viral shareable

### 3. Scoring rigor

- Transparent methodology (see [`SCORING_METHODOLOGY.md`](./SCORING_METHODOLOGY.md))
- Every callout anchored to a transcript timestamp (click to replay)
- User-configurable skill weights
- Model-stable rubric (real trend lines, not noise)
- Doubles as the provisional patent's process documentation

### 4. Baseline onboarding

- First session: 60-second self-introduction
- Scored across all six skills → user's baseline
- Goal setting (interviews / pitches / meetings / feedback / presentations)
- First Daily Workout personalized from baseline + goal

### 5. Enterprise surface

- Admin portal: team roster, team-wide scores, individual drill-down
- Calibration sessions: assign same scenario to all members, review side-by-side
- Exportable PDF progress reports for L&D justification to CFO
- ROI calculator on `/for-teams`
- SSO deferred until first pilot demands it

### 6. Friction killers

- Mobile-first (portrait on iPhone)
- One-tap start from home screen (PWA)
- Taste-before-signup: 3 reps without an account
- Quick Rep mode: 1 rep, 60 seconds

## The flywheel

```
Practice → Visible progress → Real-world confidence →
Real-world result (got the job, nailed the pitch) →
Shareable proof → Referral → New user starts practicing
```

Every feature feeds one of these five steps. Features that don't feed the flywheel get cut.
