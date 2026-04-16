# Cognify — Speech & Thinking Frameworks

> This is the research catalog of communication frameworks Cognify teaches. Every framework here is backed by real pedagogy, consulting practice, rhetoric theory, or executive-communication tradition. Each has a clear origin, an explicit "when to use", and 3–5 nodes with actionable guidance per node. The framework library in `src/lib/ai/frameworks-library.ts` is the machine-readable version of this document.

## Why frameworks, not scripts

Cognify's core pedagogy (from `PRODUCT.md`): users don't memorize words, they internalize **structures for thinking**. A framework is a named, reusable shape the brain can load when pressure hits. "Context → Decision → Impact" is a muscle. Once trained, it's available in any high-stakes moment.

Every framework below satisfies three criteria:
1. **Named** — it has a handle you can retrieve under pressure
2. **Small** — 3–5 nodes, fits in working memory
3. **General** — works across many scenarios, not a script for one

## The 15 core frameworks

### Decision & technical communication

#### 1. CDI — Context → Decision → Impact
**Origin:** Engineering decision records (ADRs / RFCs), popularized by infrastructure teams at Thoughtworks and Heroku.
**When to use:** Explaining a technical decision to non-technical audiences. Design reviews. Post-mortems.
**Nodes:**
- **Context** — the background the listener needs before the decision makes sense
- **Decision** — the choice you made, stated plainly
- **Impact** — the consequences and tradeoffs, honestly

#### 2. ADR — Context → Options → Decision → Consequences
**Origin:** Architecture Decision Records (Michael Nygard, 2011). The canonical format for capturing why engineering teams chose what they chose.
**When to use:** When alternatives matter — you're explaining not just what you chose but what you considered and rejected.
**Nodes:**
- **Context** — the problem and constraints
- **Options** — the alternatives you considered
- **Decision** — the one you picked
- **Consequences** — what you accept, what you give up

### Consulting & analysis

#### 3. SCQA — Situation → Complication → Question → Answer
**Origin:** Barbara Minto, *The Pyramid Principle* (1987). The backbone of McKinsey/BCG/Bain writing and presenting.
**When to use:** Any executive audience. Strategy discussions. Recommendations. Briefings where the listener needs to feel the tension before hearing your answer.
**Nodes:**
- **Situation** — where things stand today, accepted facts
- **Complication** — what's changed or what's at risk
- **Question** — the implicit question the audience is now asking
- **Answer** — your recommendation

#### 4. Minto Pyramid — Answer First → Reasons → Evidence
**Origin:** Also Barbara Minto. The short-form cousin of SCQA for time-constrained communication.
**When to use:** Executive memos. First 30 seconds of any meeting with a senior leader. When the listener needs the punchline and will drill in if they want more.
**Nodes:**
- **Answer** — lead with your conclusion
- **Reasons** — three supporting reasons, mutually exclusive
- **Evidence** — data or logic backing each reason

### Sales & persuasion

#### 5. PSPA — Problem → Solution → Proof → Ask
**Origin:** Modern B2B sales methodology (Challenger Sale, SPIN derivatives).
**When to use:** Product pitches. Discovery calls. Any moment you need someone to commit to a next step.
**Nodes:**
- **Problem** — the pain the buyer is feeling today
- **Solution** — how your thing addresses it specifically
- **Proof** — evidence it works (case, number, demo)
- **Ask** — the next step you want them to take

#### 6. FAB — Feature → Advantage → Benefit
**Origin:** Classic sales training, dating back to Xerox PARC's 1960s sales programs.
**When to use:** Product demos. Feature explanations. When you need to translate "what it does" into "why they should care".
**Nodes:**
- **Feature** — what the thing actually is
- **Advantage** — what it does better than the alternative
- **Benefit** — what it means for the customer's life or work

#### 7. AIDA — Attention → Interest → Desire → Action
**Origin:** Elias St. Elmo Lewis, 1898. The oldest persuasion framework still in wide use, originally for advertising copy.
**When to use:** Opening talks. Cold pitches. Marketing copy. Any moment you need to earn the listener's attention before you have their trust.
**Nodes:**
- **Attention** — the hook that makes them stop scrolling
- **Interest** — the reason they should keep listening
- **Desire** — why they'd want this to be true for them
- **Action** — the thing you're asking them to do

### Feedback & interpersonal

#### 8. BIE (SBI) — Behavior → Impact → Expectation
**Origin:** Center for Creative Leadership, 1990s. One of the most-taught feedback frameworks in corporate L&D.
**When to use:** Giving tough feedback. Performance conversations. Calling out something a colleague did that affected the team.
**Nodes:**
- **Behavior** — the specific observed behavior, no interpretation
- **Impact** — the effect it had on the work, team, or outcome
- **Expectation** — what you need to happen going forward

### Interview & narrative

#### 9. STAR — Situation → Task → Action → Result
**Origin:** Behavioral interviewing methodology, Amazon / Google / Microsoft hiring bars.
**When to use:** Any "tell me about a time when" question. Performance-review self-assessments. Résumé bullet writing.
**Nodes:**
- **Situation** — the context you were in
- **Task** — what you were specifically responsible for
- **Action** — what you did (not what the team did — what *you* did)
- **Result** — the outcome, with numbers if possible

#### 10. Past / Present / Future — Where I've been → Where I am → Where I'm going
**Origin:** Classic narrative structure, used in introductions, career conversations, and keynote openers.
**When to use:** Self-introductions. Interview openers ("tell me about yourself"). Career narrative framing. When establishing credibility and trajectory.
**Nodes:**
- **Past** — one line of relevant history, not your biography
- **Present** — what you're doing now that connects to the moment
- **Future** — where you're heading, why this matters

### Executive briefing

#### 11. BLUF — Bottom Line → Context → Next Step
**Origin:** US military communication doctrine. Adopted widely in consulting and executive briefings for its ruthless compression.
**When to use:** Emails to executives. Quick updates in meetings. Any moment you have ≤ 60 seconds.
**Nodes:**
- **Bottom Line** — the one sentence they need to hear
- **Context** — the minimum background to make it make sense
- **Next Step** — what you need from them

#### 12. PREP — Point → Reason → Example → Point
**Origin:** Toastmasters International impromptu speaking methodology.
**When to use:** Answering a question you didn't prepare for. Group discussions. Quick responses where you need structure but don't have time to plan.
**Nodes:**
- **Point** — state your point directly
- **Reason** — one sentence of why you believe it
- **Example** — a concrete case that proves it
- **Point** — restate your point, tighter this time

### Argument & reflection

#### 13. CEI — Claim → Evidence → Implication
**Origin:** Rhetoric and debate traditions (Aristotelian logos, adapted for modern argument).
**When to use:** Debates. Persuasive presentations. Defending a recommendation. Any moment you're making an argument that could be challenged.
**Nodes:**
- **Claim** — the assertion you're making
- **Evidence** — the data, reasoning, or example that supports it
- **Implication** — why it matters to your audience specifically

#### 14. What / So What / Now What
**Origin:** Driscoll's reflective practice model (1994), widely used in retrospectives and learning conversations.
**When to use:** Retrospectives. Learning debriefs. Explaining an experience and what it means. Turning observation into action.
**Nodes:**
- **What** — what happened, objectively
- **So What** — what it means, why it matters
- **Now What** — what changes as a result

### Status & updates

#### 15. Progress / Plans / Problems — Done → Next → Blocked
**Origin:** Agile/Scrum standups, popularized by Ken Schwaber in the late 1990s.
**When to use:** Status meetings. Weekly updates. Any moment you need to tell a group where things stand without over-sharing.
**Nodes:**
- **Progress** — what got done since last update
- **Plans** — what's happening next
- **Problems** — what's blocked or at risk

---

## Difficulty ladder (for Cognify's progression system)

- **Beginner** (internalize first): PREP, Rule of 3 (implicit), Past/Present/Future, Progress/Plans/Problems
- **Intermediate** (the daily-driver set): CDI, BIE, STAR, PSPA, BLUF, FAB, What/So What/Now What
- **Advanced** (higher-leverage when earned): SCQA, Minto Pyramid, CEI, AIDA, ADR

Cognify's prompt scheduler targets frameworks from the user's current difficulty tier, then gradually introduces the next tier as baseline scores climb.

## Mapping frameworks to workout prompts

Every prompt in `src/lib/ai/workout-prompts.ts` is tagged with the one framework that makes sense for it. Rules of thumb:

- **Technical or decision-making prompts** → CDI or ADR
- **Executive briefings or status** → BLUF or Progress/Plans/Problems
- **Sales or persuasion** → PSPA, FAB, AIDA
- **Interview questions** → STAR or Past/Present/Future
- **Feedback conversations** → BIE
- **Impromptu or quick-answer** → PREP
- **Consulting / strategic framing** → SCQA or Minto
- **Argument / debate** → CEI
- **Retros / learning** → What/So What/Now What

When a user enters a custom scenario in Mode 03 (Scenario Training), Claude Opus 4.6 picks from this same library and falls back to composing a custom framework only when nothing in the library fits.

## Why not more frameworks?

There are dozens of named communication frameworks in the wild (Toulmin, Cicero's six-part oration, the Hero's Journey, Gap–Bridge–Ask, Strategic Storytelling, etc.). Cognify deliberately caps the library at 15 because:

1. **Working memory** — users can only hold ~4 frameworks actively. A library of 50 is a catalog, not a training system.
2. **Pedagogical integrity** — each framework needs enough reps to stick. Adding more dilutes the reps per framework.
3. **Mastery, not breadth** — the goal is internalization, not framework trivia.

As Cognify collects usage data from real learners, frameworks that don't earn their place (low adoption, poor outcome lift) will be pruned. New frameworks enter only on evidence of teachability.
