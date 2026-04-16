# Skill: Tone

> "Calibration to audience and constraints."

Tone is the skill of *sounding right for the room*. Same content, same structure, same confidence — but delivered in the wrong register, it fails. An engineer-speak explanation to a CFO is a tone failure even if everything else is perfect. Tone is the hardest dimension to score objectively and the most valuable to train.

## Definition

Register matches the listener. Warmth, seriousness, or formality is appropriate to the audience and the moment. Technical detail is calibrated to the listener's expertise. Emotional weight matches the stakes. The listener's takeaway: *this person gets me*.

This dimension was called "adaptability" in v2-alpha.1. The rename to "tone" is a user-facing-language win — users think about tone, not adaptability — and aligns with how the team specifies scoring in the April 2026 replan.

## Experts and sources

- **Chris Voss**, *Never Split the Difference* (2016) — tactical empathy, calibrated questions, mirroring, labeling. The modern definitive work on *listening-under-fire* and tone-matching in adversarial conversations. See `negotiation.md`.
- **Dan Pink**, *To Sell Is Human* (2012) — attunement; perspective-taking as a trainable skill.
- **Matt Abrahams** (Stanford GSB), *Think Faster, Talk Smarter* (2023) — the audience-first mindset shift: *"what does the audience need to hear?"* not *"what do I want to say?"*
- **Deborah Tannen**, *That's Not What I Meant!* (1986) and *You Just Don't Understand* (1990) — foundational sociolinguistic research on register, pragmatics, and conversational style across contexts.
- **Daniel Goleman**, *Emotional Intelligence* (1995) — the EQ foundation for recognizing and responding to emotional cues.
- **Nancy Duarte**, *Resonate* (2010) — "persuasion doesn't start with you, it starts with your audience."
- **Jerry Weissman**, *Presenting to Win* — the WIIFY principle ("What's In It For You?") forces audience-first framing.
- **Kim Scott**, *Radical Candor* (2017) — tone calibration for feedback conversations. Too much "care personally" without "challenge directly" is the tone failure called ruinous empathy.
- **George Herbert Mead** — perspective-taking as the foundation of social cognition (classical source for the psychological work).

## What great tone sounds like

- Audience-appropriate vocabulary — technical with engineers, outcome-focused with execs, simple and empathetic with customers
- Emotional register matches the stakes — serious for crisis, warm for onboarding, neutral for status
- Respects stated constraints — time limit, formality level, things to avoid
- Uses calibrated questions or labels (from Voss) when the audience is resistant or tense
- Specificity calibrated to listener expertise — more detail for someone who'll drill in, less for someone who'll trust and move on
- Shows awareness that the listener has their own interests, not just the speaker's

## What low tone sounds like

- Same register regardless of audience — engineer-speak to the CFO, marketing-speak to the engineer
- Ignoring stated constraints ("I know you said 60 seconds, but…")
- Self-centered framing — *"what I want to tell you"* instead of *"what you need to hear"*
- Missing emotional cues — pressing forward with a pitch while the listener is clearly distressed
- Generic delivery — the rep that could have been played as a recording for any audience
- Monotone delivery across an emotional moment
- Flat tone for good news or upbeat tone for bad news

## Signals (hybrid, LLM-heavy)

Tone is the **least deterministically-scorable dimension**. It requires semantic understanding of audience context and register matching — deterministic signals alone can't tell you whether the vocabulary fits the listener.

What the deterministic layer *can* contribute:
- **Audience-context match** — if the scenario specified an audience, does the rep's register match? (LLM-assisted via audience metadata injection.)
- **Constraint compliance** — did the rep stay within stated time / length / tone constraints? (Deterministic.)
- **Register indicators** — jargon-density relative to audience expertise (hand-tuned by domain lexicons, deterministic).
- **Emotional-cue language** — presence of labels, calibrated questions, empathy phrases when stakes are high.

Because tone is LLM-dependent, it has a **reduced default weight (0.75)** in the composite score for the v2-beta.1 rubric. The weight will rise as calibration against blind-listener rankings matures.

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Perfect register match. Mid-rep adjustment visible when audience cues shift. Emotional intelligence evident. Constraints respected without strain. |
| **80** | Register appropriate. Constraints met. No visible adjustment needed (audience was stable). |
| **60** | Register mostly appropriate but one mismatch (jargon, formality, emotional register). Constraints met. |
| **40** | Clear register mismatch. Constraints stretched or ignored. Generic delivery. |
| **20** | Wrong audience entirely — same rep regardless of who's listening. |

## Exemplar callouts

- *(positive)* "Strong audience read — you swapped the technical frame for the budget frame the moment you mentioned the CFO would be in the room."
- *(positive)* "The label at 0:34 — 'it sounds like timeline matters more to you than price' — was straight out of Voss's tactical empathy playbook. That line is what moves a negotiation."
- *(warn)* "The jargon density was calibrated for a peer engineer, but the scenario said 'non-technical stakeholder.' That register gap is the #1 thing to adjust on the retry."
- *(critical)* "The rep went 25 seconds over the stated budget. Constraint-compliance is part of tone — respecting the time you were given is the first thing audiences notice."

## Common failure modes

- **Register blindness** — speaking the same way regardless of audience
- **Ignoring constraints** — "I know you said X, but…"
- **Self-centered framing** — leading with "I want to tell you" instead of "you need to know"
- **Missing cues** — not noticing the listener is bored, tense, or confused (in audio-only mode, cues come from the scenario's stated context)
- **Pitch-mode lock** — stuck in sales-pitch mode when the moment calls for conversation
- **Emotional tone-deafness** — delivering good news with flat tone or bad news with upbeat tone

## Antipatterns to flag in scoring

- "I just want to quickly cover…"
- "Let me walk you through…"
- "I know I'm going long, but…"
- Opening with "So…" and diving into content with no audience acknowledgment
- Pressing forward after an audience cue has clearly shifted
- Using the same opening regardless of context

## How to train tone

Cognify trains tone through **scenario variety**: Daily Workout rotates audience contexts (engineer, exec, customer, team, peer) so every rep is a register test. The user's **personas** selection from onboarding feeds into the scoring system prompt so the evaluator knows which audiences the user typically faces.

**Build a Rep** is the primary tone gym — the user specifies audience, outcome, and constraints, and scoring checks adherence explicitly. This is where the user gets to *practice* calibration rather than just be scored on it.

**External validation** (the blind-ranking flow) implicitly tests tone because listeners naturally notice register mismatch — even when they can't articulate why, they rank a tone-mismatched rep lower.

## Frameworks that train tone

- **BIE** (`bie.md`) — Behavior → Impact → Expectation — forces audience-perspective (the Impact node is entirely about the receiver)
- **PSPA** (`pspa.md`) — Problem → Solution → Proof → Ask — each node is audience-facing, not speaker-facing
- **SCQA** (`scqa.md`) — Question node demands imagining the audience's perspective explicitly

## See also

- `negotiation.md` — the domain MD where tone is stressed hardest
- `cold-calling.md` — another high-tone-stakes domain
- `tough-feedback.md` — tone under emotional weight
- `confidence.md` — adjacent delivery dimension; confident delivery without tone match still fails
