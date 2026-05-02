# Skill: Structure

> "Visible scaffolding — opening, flow, close."

Structure is the skill of making your argument *findable*. A well-structured rep has shape the listener can follow without working for it: you know where you are, where you've been, and where you're going. Most rambling isn't a content problem — it's a structure problem.

## Definition

The listener can reconstruct the argument without effort. Structure is present when there's a clear opening that establishes direction, logical connectors between points, and a close that lands the main point. It is absent when the speaker jumps between topics without visible scaffolding.

## Why we chose this

Structure makes ideas portable — the listener can repeat your point to someone else. We chose it because it's the single biggest predictor of whether a meeting recap or a pitch will land twice. The signals are observable: transition-marker rate, opening-position score, and arc-completion. Trainable through repeated drills like BLUF and Three-Act Close, where the constraint forces the structural muscle that holistic feedback can't develop fast enough. Fundamental because organization is the difference between content that travels and content that evaporates.

## Experts and sources

- **Barbara Minto**, *The Pyramid Principle* (1987) — the definitive work on structured business communication; MECE, pyramid principle, SCQA
- **Chip Heath & Dan Heath**, *Made to Stick* (2007) — SUCCES principles, especially *Simple* and *Concrete*
- **Jerry Weissman**, *Presenting to Win* (2003/2011) — "verbal links" as explicit signposting; 75 techniques
- **Nancy Duarte**, *Resonate* (2010) — the contrast sparkline, "what is" vs "what could be"
- **Chris Anderson**, *TED Talks* (2016) — the through-line principle (every talk has exactly one idea)
- **Carmine Gallo**, *Talk Like TED* (2014) — the rule of three, three-act structure
- **Dale Carnegie** — the oldest guidance on speech structure still in wide circulation
- **Aristotle**, *Rhetoric* — ethos/pathos/logos, the original three-part structure

## What great structure sounds like

- An opening that establishes direction in the first 10 seconds ("Three things about the migration. First…")
- Logical connectors between points — "because", "therefore", "which brings us to", "the second reason"
- Consistent ordering (chronological, causal, or importance — pick one and stick to it)
- A closing that reinforces the main point (the "point-restated" in PREP, the close in CDI)
- Visible scaffolding the listener can feel without being told about it

## What low structure sounds like

- No visible opening or closing — the rep just starts and stops
- Topic jumps without connective tissue — one idea ends, another begins, no bridge
- Random ordering — ideas in whatever sequence they occurred to the speaker
- Missing transitions — "so… uh… also…"
- Opening that doesn't establish direction ("so there's been a few things going on…")

## Signals

Structure is primarily LLM-scored — it requires semantic understanding of the argument's shape. Deterministic contributions:
- **Connector-word density** — presence of "first/second/third", "because", "therefore", "which brings us to"
- **Opening-quality heuristic** — does the first 10 seconds contain a direction-establishing clause?
- **Closing-quality heuristic** — does the last 10 seconds restate or reinforce the opening?
- **Framework-adherence score** (scenario mode only) — did the rep hit each framework node in order?

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Clear opening, logical flow with visible connectors, confident close. Listener could transcribe the outline. |
| **80** | Structure present but could be sharper — one weak transition or a less-than-crisp close. |
| **60** | Structure is there but fragile. The listener works harder than they should to follow the argument. |
| **40** | Ideas arrive in no obvious order. No visible opening or close. |
| **20** | Stream of consciousness. No scaffolding at all. |

## Exemplar callouts

- *(positive)* "Strong opening — 'three things about the migration' gave the listener a hook and a count in the first four seconds."
- *(warn)* "The transition at 0:45 from context to decision was unsigned — listener had to work to notice you'd moved on."
- *(critical)* "The rep ends on a tangent about scaling. The main point from the opening never gets restated, which means 30% of listeners will walk away with the wrong summary."
- *(positive, scenario mode)* "All three CDI nodes landed in order — Context in the first 15s, Decision at 0:30, Impact in the closing."

## Common failure modes

- **No opening** — starting mid-thought ("so with the migration…")
- **No closing** — trailing off instead of landing ("so… yeah, that's what's going on")
- **Topic jumping without bridges** — switching ideas with no transition word
- **Chronological structure when importance structure would land better** — telling the story in the order it happened instead of the order that matters
- **Missing the through-line** — trying to make three points at once instead of one

## Antipatterns to flag in scoring

- "Anyways…"
- "And then…" as the only connector
- "So…" as opener
- "So… yeah" as closer
- "One more thing…" added at the end
- Listing without ordering ("a few thoughts: X, Y, Z…" without structure)

## Frameworks that train structure

Structure is the skill trained *hardest* by Cognify's framework library. Every framework in the library is a structure scaffold. The most load-bearing for structure:

- **SCQA** (`scqa.md`) — the most rigorous structural framework
- **Minto Pyramid** (`minto.md`) — Answer → Reasons → Evidence
- **CDI** (`cdi.md`) — Context → Decision → Impact
- **ADR** (`adr.md`) — the full 4-node decision framework
- **PREP** (`prep.md`) — the Toastmasters scaffold, specifically for impromptu
- **BLUF** (`bluf.md`) — ruthless compression of structure into 3 nodes
