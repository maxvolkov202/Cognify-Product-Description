# Prompt Design Canon

Author guidance for every future Cognify speaking-prompt authoring run. Wave 2 and R3 broke each of these rules at scale. Phase F (recalibration) is built around them.

---

## The job a prompt does

A prompt has to make the user **start speaking, right now, on the exercise's mechanic, in a way they could repeat tomorrow on a different prompt.**

If the user reads the prompt and thinks any of:
- "I need to imagine a meeting first"
- "I don't have a [boss/client/patient/board] to talk to"
- "I'd need to know more about this scenario"
- "I don't have context for this"
- "I don't have an opinion on this yet"

…then the prompt failed. They will Shuffle past it. If Shuffle is needed too often, the user bounces.

---

## The three rules

### 1. Repeatable on demand — no required setup

A great prompt requires nothing the user doesn't already have in their head. No imagined audience, no specific situation to mentally invent, no domain knowledge they may not have.

**Test:** Would the user be able to start talking within 3 seconds of reading this, with whatever's currently in their head?

| ❌ Setup-heavy | ✅ Repeatable on demand |
| --- | --- |
| "Walk the IC through your reasoning on the goodwill impairment." | "What's a financial decision you'd defend even if it looked wrong on paper?" |
| "Tell your VP why the migration is slipping 2 weeks." | "How do you tell someone something is going to take longer than you said?" |
| "Defend a sentinel event at M&M." | "Talk about a near-miss at work and what you took from it." |
| "Walk the board through Q4 strategy." | "What's the most important call you've made this year?" |
| "Respond to a champion's 'send me pricing' email." | "Why does giving someone what they ask for sometimes lose the deal?" |

**Notice:** the right column doesn't require *any* imagined other person. The user opens their mouth and speaks from their own life.

### 2. The exercise mechanic must be the path of least resistance

Every exercise trains a specific skill move. A great prompt INVITES that move — makes performing the mechanic feel like the natural answer, not extra discipline.

| Exercise mechanic | Prompt shape that pulls the mechanic in |
| --- | --- |
| **Headline First** — lead with the bottom line | Yes/no questions, decision questions, things with a clear top-line answer |
| **Cut by Half** — compress after delivering | Open invitations to ramble; the bigger the natural answer, the better |
| **The Word Budget** — tight word count | Concepts the user knows in detail; pressure to leave things out |
| **Kill the Filler** — no um/like/uh | Anything that triggers thinking-out-loud (provocations, judgment calls) |
| **Steel Man** — argue the opposite well | Things the user has a clear opinion on; the harder the opinion, the better |
| **Strategic Pause** — pause before key points | Provocations that deserve thought; questions you shouldn't answer fast |
| **Silence Over Filler** — embrace silence | Open prompts; the kind where the user is tempted to fill space |
| **Two-Beat Pause** — pause after landings | Things with a punchline shape — the answer wants a beat |
| **Warmth Switch** — soft the tone mid-answer | Topics that start intellectual but have an emotional truth |
| **Explain Like I'm 12** — layperson language | Concepts the user knows deeply but a 12-year-old wouldn't |
| **Prove It** — back claims with evidence | Claims the user might assert; force them to ground it |
| **One Point Only** — single-thread the answer | Open questions tempting multi-thread answers |
| **The Analogy Bridge** — use analogy | Abstract concepts that get clearer through comparison |
| **The 30 Second Rule** — stop at 30s | Anything; the discipline is universal |
| **The Hard Stop** — stop mid-thought | Anything where stopping early is uncomfortable |
| **The Single Sentence** — one-sentence answer | Open questions that resist compression |
| **No Hedging** — direct claims | Things that tempt softening (judgments, predictions) |
| **No Jargon Allowed** — layperson vocab | Vertical-specific concepts the user normally uses jargon for |
| **One Idea Per Response** — one idea | Questions that beg multi-idea answers |

A prompt that ignores the exercise mechanic dilutes the training. "Tell me about your weekend" on Headline First is dead weight — there's no headline shape to land.

### 3. Vertical-flavored, not vertical-locked

The vertical filter should affect **subject matter and reference points**, not require the user to imagine a specific scene from their work.

| ❌ Vertical-locked | ✅ Vertical-flavored |
| --- | --- |
| Sales: "Respond to a CFO asking for a 40% discount in front of the procurement team." | Sales: "Why does giving someone what they ask for sometimes lose the deal?" |
| Healthcare: "Explain to a confused elderly patient why they can't get up alone." | Healthcare: "How do you tell someone they can't do something they want to do?" |
| Finance: "Walk the audit committee through the goodwill impairment KAM." | Finance: "How do you defend a number you're not 100% confident in?" |
| Law: "Cross-examine a hostile expert on his Daubert qualifications." | Law: "What's the right way to discredit someone without seeming personal?" |
| Education: "Lead the IEP meeting where the parent insists their child doesn't need accommodations." | Education: "How do you tell a parent something they don't want to hear?" |

**Notice:** the right column is recognizably about the vertical's themes (sales psychology, clinical communication, financial credibility, courtroom dynamics, parent conversations) but **anyone in that vertical at any level can engage right now**. No specific situation to invent.

---

## The three-archetype mix (per exercise × goal triple)

When authoring 3 prompts for a gap, write one of each archetype:

### A. Universal craft (1 of 3)
Exercises the mechanic, no scenario at all, anyone could engage regardless of vertical.

Examples:
- (Cut by Half) "What do you believe about good work?" — natural ramble, then cut.
- (Headline First) "Should leaders show doubt in public?" — yes/no headline shape.
- (Steel Man) "What's the strongest case against the way you do your job?"
- (Strategic Pause) "What's the truest thing about feedback that no one says out loud?"

### B. Vertical-lensed universal (1 of 3)
Universal *kind* of experience, vertical *theme*. Anyone in the vertical encounters this kind of moment regularly — without imagining a specific scene.

Examples:
- Sales (Steel Man) "Why might a great pitch still lose?"
- Healthcare (One Point Only) "What's the moment you feel most useful in your work?"
- Finance (No Hedging) "When is a forecast worth defending and when is it worth changing?"
- Law (Prove It) "What's the difference between being right and winning?"
- Education (The Analogy Bridge) "What does great teaching look like when no one's watching?"

### C. Light scenario (1 of 3)
Has a situation, but it's a *kind* of situation anyone in the vertical encounters regularly. No specific people, no specific context. Keep these rare — too many = the user has to invent context.

Examples:
- Sales: "Respond to 'send me pricing' without just sending pricing."
- Healthcare: "Tell someone something is going to hurt without scaring them."
- Finance: "Defend a number that came in worse than you forecast."
- Law: "Push back on an unfair characterization of your client."
- Education: "Explain something to a kid who's already decided it's boring."

---

## Tone

- **Conversational, not exam-question.** "Walk through…" sounds like a homework assignment. "Why do…" / "What's the truest…" / "Tell me about…" pulls speech.
- **Provocative, not bland.** A prompt that invites disagreement gets richer answers than one that invites consensus. "Why is most feedback useless?" beats "How can feedback be improved?"
- **Short.** ≤180 chars. Longer prompts read as instructions instead of invitations.
- **Second-person, not third-person scenario.** "You're talking to…" usually means you're writing a scenario. "What do you believe about…" pulls answer directly.

---

## Difficulty

| Difficulty | Definition | Mix target |
| --- | --- | --- |
| **intro** | Anyone could speak to this. No setup. Mechanic is the only challenge. | ~50% |
| **core** | Vertical-flavored but everyday. Slightly harder mechanic. | ~40% |
| **stretch** | Senior-flavored or genuinely hard mechanic. Rare. | ~10% |

Wave 2 ran 30/50/20 and "intro" often meant "still specialist but shorter." That's wrong. Intro should mean **universally repeatable, no jargon, mechanic is the only thing you're working on.**

---

## What to do with the Wave 2 bank

**Don't delete it.** It's authentic to senior practitioners and a small minority of users will want it. Layer the new archetype-mix bank on top via additional inserts. The picker shuffles across the whole `vertical+goal` bank uniformly, so increasing the share of accessible prompts naturally dilutes the senior-heavy ones.

Future audit pass (Phase F3) may prune the most jargon-walled Wave 2 prompts — but only after seeing engagement data on which prompts get selected vs Shuffled past.

---

## Checklist for an authoring run

Before submitting any new prompt, the author (human or sub-agent) confirms:
- [ ] Could the user start speaking within 3 seconds? (Repeatable)
- [ ] Does this prompt pull the exercise mechanic naturally? (Mechanic-aligned)
- [ ] Is the vertical filter affecting subject matter, not requiring an imagined scene? (Vertical-flavored)
- [ ] Is the tone an invitation, not an assignment? (Conversational)
- [ ] ≤180 chars?
- [ ] Difficulty matches the rule above?
- [ ] Unique within the catalog?

If any answer is no → rewrite.
