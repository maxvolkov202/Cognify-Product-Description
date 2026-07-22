---
name: parallel-brainstorm-for-big-plans
description: "When scoping out a big new feature/product idea, spawn 10 parallel sub-agents to enumerate divergent mechanisms before filtering — Max's preference, from Saraev SaaS video"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73bccd9c-54c8-4a40-b51d-d71e6a1fa0ad
---

When planning something big (new product feature, architectural overhaul, growth experiments), spawn ~10 parallel sub-agents and have each one propose ~10 distinct mechanisms across different categories: algorithmic, behavioral, infrastructural, regulatory, psychological, time-based, identity-based, etc. Tell them explicitly "diverge wildly, do not self-censor for feasibility." Filter afterward — most ideas will be junk but the long tail surfaces things you'd never think of alone.

**Why:** Max watched Nick Saraev describe doing this for Clarbo (his $1M ARR power-dialer SaaS). Saraev mined 200-300 ideas from parallel sub-agents to find the predictive-pacing approach that became his core moat. Max liked the framing and wants to use it next time we scope something big.

**How to apply:**
- NOT for runtime / scoring path work (coordination overhead kills the gain)
- YES for: product feature brainstorms, scoping new initiatives, "how could we improve X" questions where the search space is wide
- Use the Agent tool with parallel invocations in one message
- Each agent gets a different category constraint to force divergence
- After ideas come back, Max does the human filter — don't have an agent rank them since the model converges too fast

Related: [[feedback_combine-ideas]] — once filtered, merge the best ideas into the most ambitious version rather than picking conservatively.
