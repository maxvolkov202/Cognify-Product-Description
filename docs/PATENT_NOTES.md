# Cognify — Patent Notes

> **Status**: Scaffolding. Fully filled out in Phase D. This document is the handoff artifact for Jeffrey's patent attorney contact when drafting the provisional filing.

## The claim in one paragraph

Cognify is a method and system for training communication skills through a closed-loop process combining (a) structured scenario input capture, (b) algorithmic framework generation from a library of thinking frameworks, (c) timed voice reps held against the generated framework, (d) multi-dimensional semantic scoring with structural-adherence as a distinct dimension, (e) transcript-anchored callouts tied to temporal positions in the user's speech, and (f) a compounding progress loop driven by spaced-repetition scheduling and weakest-skill targeting. The combination of these six stages, operating together as a daily habit system, is the novelty.

## Why it's novel (differentiation from prior art)

Existing prior art covers isolated pieces but not the combined loop:

- **Speech analysis tools** (Yoodli, Speeko, Orai) analyze voice features (filler rate, pacing, tone) after the fact. They do not generate thinking frameworks, do not score structural adherence, and do not drive spaced-repetition scheduling.
- **AI roleplay platforms** (Yoodli enterprise, Hyperbound, SecondNature) simulate a conversation with an AI persona. They do not score the user's structural adherence to an externally generated framework, and their training is scenario-specific rather than foundational.
- **Language learning apps** (Duolingo) apply spaced repetition and daily habits to vocabulary and grammar, not to communication structure or framework adherence.
- **Courseware platforms** (Mindtickle, Coursera) teach theory passively. No rep-based practice loop.

The combination of (framework generation + structural-adherence scoring + spaced-repetition scheduling + daily habit system) applied to communication skill development has not been claimed in the prior art we are aware of.

## The process flow (to be turned into a diagram)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER ONBOARDING                              │
│  60s baseline rep  →  6-dimension baseline scores  →  goal capture   │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    DAILY SCHEDULING ENGINE                           │
│  spaced repetition  +  weakest-skill targeting  →  today's workout   │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
       ┌──────────────────────┼──────────────────────┐
       ↓                      ↓                      ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────────────┐
│ Mode 01      │      │ Mode 02      │      │ Mode 03              │
│ Daily Workout│      │ Skill Lab    │      │ Scenario Training    │
└──────────────┘      └──────────────┘      └──────────────────────┘
       ↓                      ↓                      ↓
       │                      │       ┌─────────────────────────┐
       │                      │       │ Scenario input:         │
       │                      │       │   text + audience +     │
       │                      │       │   key points +          │
       │                      │       │   outcome + constraints │
       │                      │       └─────────────────────────┘
       │                      │                      ↓
       │                      │       ┌─────────────────────────┐
       │                      │       │ Framework generation:   │
       │                      │       │   Claude Opus 4.6       │
       │                      │       │   picks from library or │
       │                      │       │   composes fresh →      │
       │                      │       │   named nodes returned  │
       │                      │       └─────────────────────────┘
       │                      │                      ↓
       ↓                      ↓                      ↓
┌──────────────────────────────────────────────────────────────────────┐
│                         THE CORE PRACTICE LOOP                       │
│   Prompt  →  Think (3s)  →  Speak (timer + waveform)  →  Upload      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│                  SPEECH-TO-TEXT (Deepgram)                           │
│         word-level timestamps  +  prosody features                   │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│                DETERMINISTIC SIGNAL EXTRACTION                       │
│     filler counts · pacing · pauses · duration · restarts            │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│              MULTI-DIMENSIONAL SEMANTIC SCORING                      │
│             Claude Sonnet 4.6 with structured rubric                 │
│    Clarity · Structure · Conciseness · Thinking on the spot ·        │
│    Handling pressure · Adaptability                                  │
│         (+ STRUCTURAL ADHERENCE in scenario mode)                    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│           TRANSCRIPT-ANCHORED CALLOUTS + COMPOSITE SCORE             │
│       each callout ↔ word-level timestamp ↔ audio playback           │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    PROGRESS PERSISTENCE + DIFF                       │
│    per-skill snapshots · rep-to-rep diff · longitudinal series       │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│              EXTERNAL VALIDATION (optional measurability loop)       │
│    5 reps · blind-ranking link · unbiased listener rankings          │
│    aggregated receipt · fed back to user as proof of improvement     │
└──────────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────────┐
│       FEEDBACK TO SCHEDULING ENGINE (the compounding loop)           │
│   weakest-skill signal  →  tomorrow's workout targets the gap        │
└──────────────────────────────────────────────────────────────────────┘
```

## Claim families to draft (rough)

1. **Method claim** — A computer-implemented method for training communication skills, comprising the steps of: receiving a scenario input from a user; generating a thinking framework from a stored library based on the scenario; presenting the framework to the user as a set of named nodes; capturing a timed voice rep from the user held against the framework; transcribing the voice rep with word-level timestamps; computing a structural-adherence score measuring the degree to which the user's transcript followed the framework nodes in order; computing additional per-dimension scores across clarity, structure, conciseness, thinking-on-the-spot, handling-pressure, and adaptability; surfacing feedback callouts anchored to word-level timestamps in the transcript; and updating a user-specific scheduling state that targets future reps at the user's weakest dimension.

2. **System claim** — A system comprising a scenario intake interface, a framework library store, a framework generation module backed by a large language model, a voice capture module, a speech-to-text module, a deterministic signal extraction module, a semantic scoring module backed by a large language model with a structured rubric, a transcript-anchored callout surface, a progress persistence layer, and a spaced-repetition scheduling engine, each coupled so that the output of each module is consumed by the next in a closed loop.

3. **External validation claim** — A method for validating improvement in communication skill training, comprising receiving a sequence of at least N voice reps on a common topic from a single user over a time window; generating a blind-ranking link that presents the reps in a randomized order to unauthenticated third parties; collecting rankings; aggregating the rankings; and presenting the aggregated ranking to the user as a measurement of improvement independent of any machine-generated score.

> These are drafts, not legal claims. The patent attorney will reshape them.

## Open items for Phase D

- [ ] Prior art search (USPTO, Google Patents) for "communication training" + "framework" + "spaced repetition"
- [ ] Freedom-to-operate check around Yoodli, Speeko, Hyperbound filings
- [ ] Provisional filing template draft
- [ ] Inventor list (Max, Hunter, Owen, contributors from Mr. Sides if applicable)
- [ ] Assignment clarity — per the meeting, code ownership needs to be cleaned up with Mr. Sides before filing
- [ ] Flow diagrams exported as SVG for filing attachments
