# Framework: Progress → Plans → Problems (PPP)

Standup-style status update. Originated in agile / scrum daily standups and spread across most modern tech organizations as the default weekly-update format. The tightest structure for "here's where things stand" without over-sharing or under-sharing.

## When to use

- Daily standups (originally)
- Weekly status updates to a manager
- Cross-team syncs where you have 60 seconds to report
- Async updates in Slack or email
- Any moment you need to communicate *where work stands* without writing a report

## The nodes

1. **Progress** — what got done since the last update. Concrete, checkable. Not "I worked on X" — "I shipped X, reviewed Y, unblocked Z."
2. **Plans** — what's happening next. What will be true by the next update. Specific.
3. **Problems** — what's blocked or at risk, *and what you need to unblock it*. The second half is non-optional: naming a problem without naming the ask is just complaining.

## Why Problems matters more than it looks

Most people under-report Problems. They downplay blockers to look competent or capable, which means blockers get discovered late and fixed expensively. PPP's quiet genius is that it makes Problems a required field — if you skip it, the update is incomplete.

The second half of the Problems node (*"and what I need to unblock it"*) is what separates a mature PPP rep from a junior one. A junior says "I'm blocked on the API." A senior says "I'm blocked on the API — I need a 15-minute call with Priya's team by EOD Wednesday or this slips to next sprint."

## Exemplar phrasing

**Strong (weekly update to manager):**
> "**Progress:** Shipped the new onboarding flow to 10% of users Tuesday; conversion on the critical step is up 14 points vs control. Cleared all the p0 bugs in the scoring pipeline. Reviewed Priya's PR for the validation endpoint. **Plans:** Ramping the onboarding rollout to 50% on Thursday assuming metrics hold. Finishing the scoring-signal test fixtures by Friday. **Problems:** The Deepgram rate limits are tighter than we expected on the free tier and it's going to slow our test runs starting next week. I need a decision on whether to move to paid tier by Wednesday — either answer works, but I can't plan around an undecided one."

**Strong (daily standup, compressed):**
> "**Yesterday:** finished the signal extractor + unit tests. **Today:** wiring it into the scoring route. **Blocked:** nothing, but watch for the Deepgram rate-limit call tomorrow — I'll need a decision."

## Common failure modes

- **Progress as effort report** — "I worked on X for 4 hours" is not progress. "I shipped X" or "I completed X" is progress.
- **Vague Plans** — "continuing to work on the migration" tells the listener nothing. Specific outcomes.
- **Hidden Problems** — reporting all green when there are real risks. This is the #1 reason teams are surprised by slips.
- **Problems without Asks** — naming the blocker without saying what would unblock it
- **Scope bloat** — listing everything you touched instead of what actually moved
- **Passive voice Progress** — "the migration was worked on" instead of "I migrated the users table"

## Antipatterns

- "I worked on a lot of things…"
- "Things are going well…" (information-free)
- "Mostly just tying up loose ends…"
- "Everything's on track" (when it isn't)
- "No blockers" (when there are)
- "Same as yesterday"

## PPP vs similar frameworks

- **STAR** (`star.md`) — for behavioral stories ("tell me about a time…"), not status updates
- **CDI** (`cdi.md`) — for explaining a decision, not reporting status
- **BLUF** (`bluf.md`) — when you have 10 seconds and need the update compressed into one sentence
- **WSW** (`wsw.md`) — for retrospective reflection, not forward-looking status

## Origin

Agile software development, specifically Scrum's daily standup as formalized by Ken Schwaber and Jeff Sutherland in the late 1990s. The original daily standup prescribes three questions: *"What did you do yesterday? What will you do today? Are there any impediments?"* PPP is the lightly renamed variant that spread beyond software into cross-functional weekly updates in the 2000s.

Modern variants exist (Yesterday/Today/Blockers, Accomplishments/Next/Risks) but PPP remains the most common shorthand.

## See also

- `bluf.md` — Bottom Line → Context → Next Step, for highly compressed updates
- `wsw.md` — What → So What → Now What, for retrospective reflection
- `cdi.md` — Context → Decision → Impact, for decision reports
