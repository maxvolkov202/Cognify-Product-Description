# Cognify — Prior Art

*Patent-grade survey for provisional prep. Last updated: 2026-04-24.*

This document supplements `PATENT_NOTES.md` with a structured analysis of existing tools in the communication-training space. The aim is to establish what is already public (to inform claim drafting) and, for each precedent, articulate precisely where Cognify's approach doesn't read on it.

The three provisional-claim areas Cognify currently stakes (see `PATENT_NOTES.md`):

- **C1 — Closed-loop training system.** A self-directed training environment that (a) generates a structured thinking scaffold tailored to a user-described scenario, (b) captures the user's spoken attempt against that scaffold under a visible time budget, (c) scores the attempt across a fixed multi-dimensional rubric anchored to transcript timestamps, and (d) biases the next prompt toward the user's weakest dimension so skill acquisition compounds across sessions.
- **C2 — Transcript-anchored multi-dimensional scoring.** A rubric-versioned scoring system that produces per-dimension numeric scores plus transcript-timestamped callouts, each callout tagged with a specific rubric dimension and pinned to a rubric version so historical scores remain stable when the rubric is re-tuned.
- **C3 — Rep-to-rep progression.** Next-rep prompt selection is deterministically biased by the previous rep's lowest-scoring dimension, producing a measurable multi-session improvement curve whose slope is the product artifact itself (not the individual rep score).

Each tool below is mapped against these three claim areas.

---

## 1. Poised (poised.com)

**Accessed:** 2026-04-24 · **Category:** Real-time meeting coach

**Architectural summary.** Poised runs as a desktop / browser overlay during live video calls (Zoom, Meet, Teams). It transcribes the user's speech in real time, extracts features like filler words, pace, assertiveness, and sentiment, and surfaces gentle in-meeting nudges plus a post-meeting report card. Pricing is individual-subscription; a team tier exists for managers viewing aggregate report cards.

**What we share.** Both systems operate on speech transcripts. Both produce dimension-ish scores (confidence, pacing, filler density) and surface them to the user.

**Where Cognify doesn't read on Poised.**

- **C1 (closed-loop training):** Poised has no standalone training mode. Its happy path requires a live meeting. Cognify's happy path is a solo 10-minute rep against a generated prompt — no counterparties, no meeting. The structured thinking scaffold (`talking-points`), the 3-second ready countdown, and the discrete-rep construct are absent from Poised.
- **C2 (transcript-anchored scoring):** Poised surfaces aggregate meeting scores. Its feedback is not organized as timestamp-pinned callouts tagged to a pre-declared multi-dimensional rubric with a pinned rubric version.
- **C3 (rep-to-rep progression):** Poised reports on the meeting that just happened; there is no "tomorrow's meeting will be biased toward your weakest Tuesday dimension" mechanism because the user doesn't schedule meetings via Poised.

**Relevance to claims.** Low overlap. Poised is downstream of the moment (polish, observe); Cognify is upstream (rehearse, compound). Does not read on C1, C2, or C3.

---

## 2. Yoodli (yoodli.ai)

**Accessed:** 2026-04-24 · **Category:** Post-hoc analyzer + rehearsal tool

**Architectural summary.** Yoodli is a standalone recorder and analyzer. The user records a speech, conversation, or practice session (either solo or by uploading a meeting recording). Yoodli then generates a transcript, detects fillers, pauses, and pace, and produces a post-hoc coaching report. It has also added a "practice conversations" mode where the user can rehearse against AI-generated interview prompts.

**What we share.** Yoodli's practice mode and Cognify's Daily Workout share the pattern of prompt → speak → analyze. Both generate transcripts and surface delivery metrics.

**Where Cognify doesn't read on Yoodli.**

- **C1 (closed-loop training):** Yoodli's practice mode does not generate a *user-described* structured thinking scaffold ahead of the rep. The user picks from a static prompt library; the system does not synthesize a framework tailored to the user's specific upcoming scenario (stakeholder, outcome, emotional stakes, time pressure). Yoodli's AI rehearsal partner reacts as a counterparty — it does not author the structure the user is speaking *to*. The structured-scaffold synthesis is a material functional difference.
- **C2 (transcript-anchored scoring):** Yoodli's feedback is predominantly surfaced as session-level metrics (filler count, pacing graph). Individual timestamped callouts exist but are not organized around a fixed multi-dimensional rubric with a pinned version. Scores shift when Yoodli updates its models; historical sessions don't carry a rubric pin.
- **C3 (rep-to-rep progression):** Yoodli does not bias the next prompt toward the user's weakest dimension. Prompts are browsed, not selected by the system.

**Relevance to claims.** Meaningful overlap on C1's surface (prompt + speak + analyze) but doesn't read on the generative-scaffold element or on C2 / C3. The generative-scaffold element is the independent claim we should foreground.

---

## 3. Orai (orai.com)

**Accessed:** 2026-04-24 · **Category:** Public-speaking drill app

**Architectural summary.** Orai is a mobile-first drill app focused on public speaking. The user records short speeches; the app gives feedback on pace, filler words, energy, and clarity. It includes a lesson track (Harvard Business Review has partnered on some content) and gamification around streaks / levels.

**What we share.** Both products treat speaking practice as a repeatable daily habit. Both produce numeric feedback on delivery metrics. Both use streak mechanics.

**Where Cognify doesn't read on Orai.**

- **C1 (closed-loop training):** Orai's prompts are content-drills (give a 30-second elevator pitch; describe your last vacation). There is no user-described scenario intake that generates a bespoke scaffold. Pressure archetypes (Pushback, Time Compression, Audience Switch, Clarifying Interrupt, Stakes Raise) are absent. Orai's feedback does not organize against a six-dimension rubric with a "what" × "how" split.
- **C2 (transcript-anchored scoring):** Orai emphasizes delivery metrics (pace, filler words). "Content" dimensions (clarity, structure, conciseness) are not independently surfaced as scored axes. No rubric-version pin.
- **C3 (rep-to-rep progression):** Orai's lesson track is linear (course-style). The next drill is chosen by course order, not by the user's weakest dimension on the prior rep.

**Relevance to claims.** Orai is the closest consumer-app analog in category and cadence. But its prompt-selection is curriculum-linear, not weakness-biased, and its scoring is delivery-biased, not six-dimension rubric-anchored. Does not read on C1's generative scaffold, C2's rubric-pinning, or C3's weakness bias.

---

## 4. Speeko (speeko.co)

**Accessed:** 2026-04-24 · **Category:** Speech-pattern analyzer

**Architectural summary.** Speeko is a mobile analyzer for spontaneous speaking. The user records; the app analyzes pace, tone, pauses, and word-choice. Recent versions have added prompt libraries for interview and business-communication practice.

**What we share.** Same core loop as Orai. Numeric delivery feedback. Optional prompt library.

**Where Cognify doesn't read on Speeko.**

- **C1 (closed-loop training):** Speeko has no scenario intake or scaffold generator. No pressure-archetype mechanism.
- **C2 (transcript-anchored scoring):** Timestamped highlights exist but are not tagged against a pre-declared multi-dimensional rubric with a pinned version. Speeko's six categories (Energy, Pace, etc.) are all delivery-side; content dimensions are absent.
- **C3 (rep-to-rep progression):** Next-prompt selection is user-driven, not system-biased by the prior rep's weakest dimension.

**Relevance to claims.** Does not read on the novel claim elements. Same sub-lane as Orai with a different product aesthetic.

---

## 5. Toastmasters (toastmasters.org)

**Accessed:** 2026-04-24 · **Category:** Peer-led in-person speaking program (century-old institution)

**Architectural summary.** Toastmasters is a non-profit membership organization that runs weekly in-person meetings where members rotate through prepared speeches, impromptu "Table Topics" (thinking-on-your-feet drills), and peer evaluations using published pathways curricula.

**What we share.** The pedagogical philosophy — short repeated reps under constraints, evaluated against a structured framework, with a focus on impromptu speaking as a distinct skill — is the most aligned precedent. Cognify openly learns from this tradition.

**Where Cognify doesn't read on Toastmasters.**

- Toastmasters is a **human-to-human process**. Evaluation is subjective; feedback is delivered verbally at the end of each meeting. There is no automated transcript, no per-dimension numeric scoring, no transcript-timestamped callouts, no pinned rubric version, and no algorithmic next-prompt selection.
- Toastmasters is **scheduled in-person**, not on-demand. Cognify's "10 minutes, anywhere, compounding" form-factor is orthogonal.

**Relevance to claims.** Toastmasters is useful as evidence that repeated short drills with structured feedback is a century-old pedagogical pattern (defensive citation for the obviousness question). It is not prior art on the automation, the multi-dimensional transcript-anchored rubric, or the rep-to-rep progression mechanic.

---

## 6. Ummo (and similar filler-word trackers)

**Accessed:** 2026-04-24 · **Category:** Single-metric analyzers

**Architectural summary.** Ummo is a single-purpose app that detects "um" / "uh" / "like" fillers and counts them. A small ecosystem of similar apps exists (SpeakUp, FillerFree) that track one or two specific metrics.

**What we share.** Speech-to-metrics.

**Where Cognify doesn't read on Ummo.** Single-metric vs. multi-dimensional is the obvious gap. No scaffold synthesis, no rubric, no progression mechanism, no streak system.

**Relevance to claims.** Negligible. Cited for completeness.

---

## 7. Descript (descript.com) — transcript platform, not training

**Accessed:** 2026-04-24 · **Category:** Audio editor with transcript-based UX

**Architectural summary.** Descript edits audio / video by editing a transcript. It does not coach or train speaking; it is a content-production tool.

**Why it's cited.** Descript pioneered the "transcript is the first-class UI" pattern that Cognify's timestamp-anchored callouts also leverage. We should cite Descript in C2's prior-art survey to pre-empt any "transcript-anchored UI is novel" objection — the transcript-as-UI pattern is not what we claim; we claim the *rubric-pinned, dimension-tagged, callout-attached* use of it.

**Relevance to claims.** Relevant as prior art on the UI pattern, not on the scoring pattern. C2's novelty lives in the rubric-pinning and dimension-tagging, not in timestamp anchoring per se.

---

## 8. VirtualSpeech, Speeko Pro, Interview Warmup (Google)

**Accessed:** 2026-04-24 · **Category:** Category-adjacent (interview / VR / broad-market)

Very briefly: VirtualSpeech uses VR to simulate audiences; Google's Interview Warmup is a free browser tool for interview rehearsal. Neither synthesizes a structured thinking scaffold tied to the user's stated scenario; neither produces a multi-dimensional rubric-pinned score; neither biases the next prompt toward the weakest dimension. Cited for completeness.

---

## Summary table

| Tool | Has scenario-intake scaffold? | Rubric-pinned multi-dim scoring? | Weakness-biased next-rep? |
|---|---|---|---|
| Poised | No | No | No |
| Yoodli | No | Partial (session metrics, no pin) | No |
| Orai | No | No | No |
| Speeko | No | No | No |
| Toastmasters | Structured curriculum (human) | No (human) | No (curriculum-linear) |
| Ummo / filler apps | No | No (single metric) | No |
| Descript | N/A (not training) | N/A | N/A |
| VirtualSpeech / Interview Warmup | No | No | No |
| **Cognify** | **Yes (AI-generated per scenario)** | **Yes (v2.0.0, 6 dimensions, pinned per rep)** | **Yes (weakestDimensionBias feeds next session)** |

---

## Claim-drafting implications

The three novelty elements to foreground in the provisional are:

1. **Generative, scenario-personalized thinking scaffold** — `/api/talking-points` synthesizes a per-user scaffold from free-text scenario + stakeholder + outcome inputs. Reads against Yoodli's static-library practice mode and Orai's prescribed drills.
2. **Rubric-version pinning on historical scores** — every rep carries `reps.rubric_version` so score trend lines remain stable as the rubric evolves. None of the analyzers in this survey do this; their score distributions shift silently with model updates.
3. **Deterministic weakness-biased next-rep selection** — `planTodaysWorkout()` takes `weakestDimensionBias` (sourced from the prior session's lowest-scoring dimension via `getLastSessionWeakestDimension`) and biases next-rep type selection toward drills that train that dimension. None of the surveyed systems do this; prompts are either curriculum-linear (Toastmasters, Orai) or user-browsed (Yoodli).

Combined, these three form the novelty package. Individually each element has adjacent prior art; combined, the closed-loop reads as novel.

See `docs/diagrams/` for the three visual artifacts accompanying this document:

- `closed-loop-training.svg` — the full Cognify rep loop (C1)
- `transcript-anchored-scoring.svg` — the scoring + callout flow (C2)
- `rep-to-rep-progression.svg` — weakness bias + multi-session trajectory (C3)
