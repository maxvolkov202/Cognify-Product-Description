---
name: Iterative self-test loop playbook
description: When Max asks to "run through tests" or "do another loop", follow the saved playbook at plans/cognify-iterative-self-test-loop.md — don't re-ask what he wants tested
type: feedback
originSessionId: 6a0c6a8f-8307-4c9c-8a60-6d52e2fa8f7a
---
When Max says something like "run through a bunch of tests yourself", "do another round", "keep looping", or "test it again" in the Cognify project, the instruction is load-bearing: execute the loop defined in `C:\Users\MaxVolkov\.claude-personal\plans\cognify-iterative-self-test-loop.md`.

**Why:** Max explicitly said "add it to the plan so I dont have to repeat it" — he doesn't want to re-explain the testing cadence each time. This is a durable preference, not a one-shot instruction.

**How to apply:**
- Read the playbook first, then run it top to bottom
- Produce the notes file it specifies
- Triage findings into the 3 buckets (no-brainer / small-but-judgment / bigger-thought)
- Fix no-brainers in-loop; list the rest for Max to pick
- Stop looping per the "When to stop" rules in the playbook, don't keep going past them
- If the playbook itself needs updating (new probe ideas, new edge cases), edit the plan file — don't add to memory
