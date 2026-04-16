# Framework: Context → Decision → Impact (CDI)

A three-node framework for explaining a technical or strategic decision to any audience — especially one that was not in the room when the decision was made.

## When to use

- Design reviews
- Post-mortems
- Explaining an engineering decision to non-technical stakeholders
- Status updates where a choice needs to feel understandable, not arbitrary

## The nodes

1. **Context** — the background the listener needs before the decision makes sense. Short. Just enough that "we chose X" lands.
2. **Decision** — the choice, stated plainly. No hedging, no "we sort of went with", no "eventually decided". One sentence.
3. **Impact** — the honest consequences and tradeoffs. What you gain *and* what you give up. This is what separates a mature CDI rep from a defensive one.

## Exemplar phrasings

**Strong:**
> "Our p99 latency was hitting 800ms on the checkout path during peak, which broke our SLA. We moved checkout to a dedicated read replica. That cuts p99 under 200ms, at the cost of 30 seconds of replication lag on inventory counts — acceptable because we already reconcile at the payment step."

**Template:**
> "[Context: specific problem with numbers]. We decided to [Decision: the specific choice]. That means [Impact: specific gain] at the cost of [Impact: honest tradeoff]."

## Common failure modes

- **Context bloat** — 90 seconds of background for a 30-second decision. Cut the context in half.
- **Hedging the decision** — "we sort of decided…", "we ended up going with…". Say it plainly: *"We chose X."*
- **Skipping Impact** — ending at the decision. Listeners will ask "…and?" in their heads. Without Impact, the framework is incomplete.
- **Defensive Impact** — hiding the tradeoff to avoid criticism. This loses trust. Honest tradeoffs build it.

## Antipatterns

- Opening with "So basically what we did was…"
- Leading with the tradeoff before stating the decision
- Listing every alternative you considered (that's ADR, not CDI)

## Origin

Derived from Architecture Decision Records (ADRs) as popularized by Michael Nygard (2011), simplified to three nodes for live verbal delivery.

## See also

- `adr.md` — the 4-node version (Context → Options → Decision → Consequences) when alternatives matter
- `bluf.md` — when you have under 60 seconds and need maximum compression
