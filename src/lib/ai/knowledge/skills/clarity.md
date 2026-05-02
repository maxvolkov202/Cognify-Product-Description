# Skill: Clarity

> "Ideas land on the first hearing. No ambiguity. Concrete language."

Clarity is the dimension where the listener doesn't have to re-interpret. They don't mentally rewind, they don't ask you to repeat, they don't lean to their neighbor and whisper "wait, what?" Clarity is the first job of communication and the most commonly under-trained skill in professional speech.

## Definition

Ideas transmitted without friction. A clear speaker is understood the first time by an audience-appropriate listener. This is not about speaking slowly or using small words — it's about every sentence being *resolvable* the moment it's heard.

## Why we chose this

Clarity is foundational because every other dimension depends on it — a brilliant argument lost on the listener doesn't move anyone. We picked it because the failure mode is concrete and trainable: jargon density, abstract-noun ratio, and pronoun resolution all surface as measurable signals in any 60-second response. Daily reps build the pattern of stating the main point first and grounding abstract claims with concrete examples — the single most asked-for skill in our internal coaching feedback.

## Experts and sources

- **Steven Pinker**, *The Sense of Style* (2014) — "classic style" prose, concrete over abstract, the curse of knowledge
- **George Orwell**, "Politics and the English Language" (1946) — six rules for clear writing; arguably the clearest thinking-about-clarity ever published
- **Strunk & White**, *The Elements of Style* (1918/1959) — "Omit needless words"
- **William Zinsser**, *On Writing Well* (1976) — clarity as discipline, not gift
- **Barbara Minto**, *The Pyramid Principle* (1987) — MECE reasoning, exec register
- **Steve Krug**, *Don't Make Me Think* (2000) — cognitive-load principles that translate directly from UX to speech
- **Nancy Duarte** — the audience-first principle ("persuasion doesn't start with you")
- **Matt Abrahams** (Stanford) — audience-register matching from *Think Faster, Talk Smarter*

## What great clarity sounds like

- Main point stated within the first 10 seconds
- Concrete nouns ("the validation endpoint", "the Tuesday deploy", "the checkout flow") instead of abstract ones ("the system", "the process", "stuff")
- Unambiguous pronouns — every "it", "they", "that" has a visible antecedent
- Audience-appropriate vocabulary — more on this in `tone.md`, but audience mismatch is the single most common clarity failure mode
- No throat-clearing preambles ("so basically what I want to say is…")

## What low clarity sounds like

- Unresolved pronouns — "and *it* kind of became a problem because *they* wanted *that* to work differently"
- Abstract nouns where concrete would work — "there's a situation with the thing we're trying to solve"
- Jargon density mismatched to audience — engineering jargon to a CFO, marketing jargon to an engineer
- Listener-pauses-to-re-interpret moments

## Signals (deterministic contribution)

- **Filler-word rate** degrades clarity (also hits conciseness)
- **Pronoun-reference density** — high pronoun counts without proportional noun anchors is a risk signal
- **Hedge rate** — "kind of", "sort of", "maybe" blur claims
- **Sentence-length variance** — extreme long or short both hurt

The LLM layer (Claude Sonnet in the hybrid scoring architecture) scores semantic clarity on top of these signals.

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Every sentence lands on first hearing. Main point in opening 10s. Concrete, audience-appropriate, zero re-interpretation needed. |
| **80** | Clear with one or two moments where the listener has to work slightly harder than they should. |
| **60** | Main point lands, but takes longer than it should. Some ambiguity, but recoverable. |
| **40** | Listener is working to follow. Multiple re-interpretation moments. Main point becomes clear only at the end, or not at all. |
| **20** | Listener is lost. Main point never resolves. |

## Exemplar callouts

- *(positive)* "Strong concrete opener — 'the checkout flow timed out for 15% of users' is exactly the specificity this moment needed."
- *(warn)* "The pronoun 'it' at 0:34 has no clear antecedent — listener has to guess whether you mean the migration or the validation."
- *(critical)* "By 1:15, the main point still hasn't landed. We've heard context, tangent, and qualifier, but not the decision you're asking for."

## Common failure modes

- **Abstract noun dependency** — "the system", "the process", "the situation", "the thing"
- **Pronoun soup** — too many it/they/that without antecedents
- **Audience mismatch** — register wrong for the listener
- **Preamble** — "So basically, what I want to say is…"
- **Curse of knowledge** — forgetting the listener doesn't have your context

## Antipatterns to flag in scoring

- "Basically…"
- "The thing is…"
- "What I mean by that is…"
- "Let me explain what I mean…"
- "You know what I mean?"
- "So yeah…" as opener

## Frameworks that train clarity

Every framework trains some clarity, but the hardest-hitting are:
- **BLUF** (`bluf.md`) — forces the point into sentence one
- **Minto Pyramid** (`minto.md`) — Answer-first, no preamble
- **PREP** (`prep.md`) — Point-first, Point-restated
- **CEI** (`cei.md`) — Claim-first, no hedging
