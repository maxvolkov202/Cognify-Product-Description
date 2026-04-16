# Skill: Relevance

> "Did the rep actually address the prompt?"

Relevance is the dimension that catches drift. The speaker was asked one question; they need to answer *that* question, not a related one, not a tangent, not whatever came to mind. It sounds obvious until you grade fifty reps and realize how often speakers end on a different topic than they started.

## Definition

The rep's content directly engages with the prompt from the opening through the close. Every point serves the main question. Tangents earn their place or don't exist. The close restates, reinforces, or answers the prompt.

Relevance is **net-new** in the v2-beta.1 rubric — previous versions assumed prompt-addressing implicitly, which meant off-topic reps still got decent clarity and structure scores. Relevance is the explicit check that the rep is *about* the thing it was supposed to be about.

## Experts and sources

- **Matt Abrahams** (Stanford GSB), *Think Faster, Talk Smarter* (2023) — "Listen. Most spontaneous-speaking failures are misreadings of what was actually asked." The explicit source for treating relevance as a separate discipline from clarity.
- **Barbara Minto**, *The Pyramid Principle* (1987) — "Answer-first" framing is implicitly a relevance discipline: state the answer first, then you can't drift, because the answer has already been delivered.
- **Amazon behavioral interview methodology** — interviewers explicitly listen for whether the STAR story *answers the question*. A good story about leadership doesn't count if the question was about conflict. Amazon's internal guidance is relentless on this.
- **Gayle Laakmann McDowell**, *Cracking the PM Interview* — specifically flags "answering a related but different question" as a top-five interview failure mode.
- **The Heath Brothers**, *Made to Stick* — the "Core" in SUCCES: strip the message to its essence and make sure what you're saying is what matters. If you're making three points and only one answers the question, you have two waste points.
- **Aristotle**, *Rhetoric* — the classical concept of *kairos* (the opportune moment) is adjacent: say the right thing at the right time, which means saying *this* thing because *this* is what was asked.

## What great relevance sounds like

- Direct engagement with the prompt in the first 10 seconds
- Every sentence can be traced back to the prompt ("this matters because you asked about…")
- The close restates or reinforces the answer to the original question
- Tangents are either absent or earn their place by reinforcing the main point
- If the prompt has two parts, both get addressed proportionally

## What low relevance sounds like

- The rep starts on-topic and drifts to a related-but-different topic by the midpoint
- The closing is about something the speaker found interesting, not what was asked
- A strong opening followed by a long tangent the speaker never recovers from
- Answering a simpler version of the question rather than the actual one
- Going meta — talking about *how* you'd answer instead of *answering*

## Signals (hybrid, LLM-heavy)

Relevance is the most LLM-dependent dimension in the rubric because it requires semantic judgment: what was the prompt asking, and did the transcript address it?

Deterministic contributions:
- **Prompt-transcript token overlap** — does the transcript contain any of the prompt's content words? (Weak signal but useful for the empty-transcript case.)
- **Topic-coherence heuristic** — do the first quarter and last quarter of the transcript mention similar topics? (Proxy for "no drift.")
- **Tangent detection** — does the transcript contain phrases like "anyway", "where was I", "what was the question" — explicit drift markers.

LLM layer:
- Given the prompt and the transcript, does the rep answer the prompt?
- Is the close on-topic or drifted?
- Are there tangents that never return to the main question?

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Directly addresses the prompt from opening through close. Every point earns its place. Closing restates or reinforces the answer. |
| **80** | Answers the prompt well. One small tangent but quickly returns. |
| **60** | Answers the prompt, but drifts at the end or wastes 20–30% of the rep on unrelated material. |
| **40** | Starts on-topic but ends on a different topic. The question is only half-answered. |
| **20** | Answers a different question than the one asked, or never gets to the answer at all. |

## Exemplar callouts

- *(positive)* "Every point in this rep ties back to the prompt. The close restates the main answer. That's relevance discipline."
- *(warn)* "You drifted from the pricing question at 0:45 into a tangent about onboarding. The drift was interesting but cost you half the rep."
- *(critical)* "The prompt asked how you'd handle a skeptical executive. The rep answered how you'd handle a technical audience. These aren't the same — the register and the argument are both different."

## Common failure modes

- **Topic drift** — starting on-topic, ending on something else
- **Question-swap** — answering a related-but-different question (easier or more interesting to the speaker)
- **Going meta** — talking *about* the answer instead of giving it
- **Prompt-miss** — misreading what was actually asked (re-reading the prompt out loud first is a cheap fix)
- **The two-part miss** — when a prompt has two parts and the speaker only addresses one

## Antipatterns to flag in scoring

- "Well, that's an interesting question, but actually I think the more important thing is…"
- "Related to that…" followed by a tangent
- "Let me take a step back…" (usually means drift is coming)
- Ending with "…anyway, that's what I wanted to say" when it's not what was asked
- "Off the top of my head…" (permission to be loose)

## Frameworks that train relevance

- **Minto Pyramid** (`minto.md`) — Answer-first framing makes relevance almost impossible to fail: if sentence one is the answer, you can't drift
- **BLUF** (`bluf.md`) — same logic, tighter
- **STAR** (`star.md`) — the Result node is specifically the prompt's answer; well-trained STAR users restate the Task in the Result to prove relevance
- **PREP** (`prep.md`) — the restated Point at the end is a relevance check: *"Here's what I said, which is what you asked about"*

## See also

- `clarity.md` — overlapping skill; relevance is about *which* point you made, clarity is about *how* it lands
- `structure.md` — a well-structured rep is usually relevant; drift is often a structure failure in disguise
- `behavioral-interview.md` — the domain where relevance is stressed hardest
