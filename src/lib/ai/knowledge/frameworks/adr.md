# Framework: Context → Options → Decision → Consequences (ADR)

Architecture Decision Records. A four-node framework for explaining a decision where **the alternatives matter** — where the listener needs to know not only what you chose but what you considered and rejected.

## When to use

- Design reviews (you need to show the decision was deliberate, not arbitrary)
- Post-mortems with forks (we could have done X, we chose Y, here's why)
- RFC presentations
- Any moment someone might ask "why didn't you just…?"
- Technical decisions being explained to someone who will *also* have opinions

## The nodes

1. **Context** — the problem and the constraints operating on it. Same as CDI's Context node, but usually slightly longer because the options need the same constraints to be understandable.
2. **Options** — the alternatives you considered. At least two, ideally three. Each option gets a one-line tradeoff, not a paragraph. This is the distinguishing feature of ADR: you *name* the rejects, not just the winner.
3. **Decision** — the option you picked, stated plainly.
4. **Consequences** — what you accept and what you give up. Same as CDI's Impact node. This is the honesty check — a mature ADR names the real cost, not just the benefit.

## Exemplar phrasing

**Strong:**
> "[Context] We needed real-time leaderboard updates for the validation feature, with expected peak load of 5K concurrent users and a 50-rep history per user. [Options] Three realistic options. First, a Postgres-only approach — simple but doesn't scale past ~1K concurrent. Second, Postgres + Redis sorted sets — moderate complexity, scales well, but adds a second data store to operate. Third, managed service like Liveblocks — zero ops, but $600/mo and a vendor lock. [Decision] We went with Postgres + Redis sorted sets. [Consequences] We get horizontal scale and keep cost flat, at the price of operating Redis and maintaining two sources of truth that we reconcile on write."

## Why ADRs exist

Michael Nygard introduced ADRs in 2011 in a Thoughtworks post titled "Documenting Architecture Decisions," arguing that undocumented decisions become archaeological puzzles six months later. The ADR format was designed for written docs but translates cleanly to live verbal delivery — with the constraint that the **Options** section must be fast, not exhaustive.

## Common failure modes

- **Options bloat** — spending 60 seconds per option in live delivery. Each option gets one sentence. If it needs more, you should be writing a doc, not speaking.
- **No real alternatives** — listing two options where one is obviously bad just to make the chosen one look good. The audience will notice and you'll lose trust. Every option listed should be a genuine candidate.
- **Missing Consequences** — listing the decision without the tradeoffs. Same failure as CDI.
- **Passive-voice decision** — "and we ended up going with Redis" weakens the commitment. "We chose Redis" is the right tone.
- **Defending the rejects** — re-relitigating why option 2 lost. The Options section is a snapshot, not a debate.

## Antipatterns

- "Well, there were a lot of options, so…"
- "I mean, we could have done anything, but…"
- "We kind of just went with Redis because…"
- Listing six options in live delivery (write a doc)

## ADR vs CDI

Use **CDI** (`cdi.md`) when the alternatives are either obvious or uninteresting — three nodes, faster, cleaner.

Use **ADR** when at least one of these is true:
- The audience will ask "why not X?" if X isn't named
- The rejected options are themselves a signal of rigor
- The decision will be reviewed later and the alternatives need to be on record

## Origin

Michael Nygard, "Documenting Architecture Decisions" (2011), Thoughtworks. Originally a written-doc format; adopted widely in engineering orgs and adapted for verbal delivery in design reviews. Gained traction through tools like `adr-tools` and the `docs/adr/` convention in open-source repos.

## See also

- `cdi.md` — the three-node short form when alternatives don't matter
- `cei.md` — Claim → Evidence → Implication, for contested decisions
- `bluf.md` — if the alternatives don't fit in the time you have
