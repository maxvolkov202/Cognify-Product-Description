# Framework: Situation → Task → Action → Result (STAR)

The behavioral-interview backbone. Used by Amazon, Google, Microsoft, and most mature tech hiring processes for "tell me about a time when…" questions.

## When to use

- Any behavioral interview question ("tell me about a time…", "describe a situation where…", "walk me through how you…")
- Performance-review stories
- Résumé bullets (compressed form)
- Promotion packets

## The nodes

1. **Situation** — the context you were in. One sentence. Not your full biography.
2. **Task** — what *you specifically* were responsible for. Not the team, not the company — you.
3. **Action** — what *you personally* did. Every sentence should start with "I", not "we".
4. **Result** — the outcome, with **numbers** whenever possible. Reasonable estimates beat vague wins.

## Exemplar phrasing

> "I was the tech lead on checkout for an ecommerce platform doing $2M/day in revenue. [**Situation**] During Black Friday we saw a 30% spike in abandoned carts and I was asked to figure out why within 48 hours. [**Task**] I pulled the funnel data, identified that a new address validator was timing out for 15% of users, rolled back the validator behind a feature flag, and instrumented the fallback path. [**Action**] Abandoned carts dropped from 30% above baseline back to normal within four hours, recovering approximately $180K in same-day revenue. I also wrote the post-mortem and added a canary deploy gate that caught two similar issues in the next six months. [**Result**]"

## Common failure modes — all verified in the 2025–2026 Amazon interview literature

- **"We" instead of "I"** — interviewers explicitly listen for first-person ownership. Switch every "we decided" to "I recommended" or "I initiated."
- **Situation bloat** — the #1 STAR mistake. Don't set the scene for 90 seconds. One line.
- **Vague Action** — "we worked together and figured it out" tells the interviewer nothing. Specifics about what *you* did.
- **Missing Result numbers** — "approximately 30% reduction" beats "significant improvement." Estimates are fine; vague adjectives are not.
- **No learning layer** — especially for Amazon's "Are Right A Lot" principle, the story should include what you'd do differently or what you learned. Candidates dodge this because the question feels like it's about the mistake; it's actually about the *recovery and process improvement*.

## Amazon-specific notes

- Each story should map to **at least one** Amazon Leadership Principle (bonus if two).
- Prepare **2 stories per principle** — 8–10 well-prepared stories will cover almost any behavioral question.
- Quantified Results are effectively required.

## Antipatterns

- "So the team was in a situation where we had to…" (we + situation bloat)
- "And then we eventually figured it out and things got better" (no numbers, no action detail)
- Leading with the Result ("I saved $180K by…") — that's elevator-pitch form; STAR builds to the Result

## Origin

Developed in the 1970s as part of structured behavioral interviewing methodology; adopted and popularized by Amazon, Google, and Microsoft in the 2000s. Validated by decades of IO-psych research on behavioral versus situational interviewing.

## Sources

- Amazon Interview Guidelines (Amazon leadership-principles behavioral interview guide, 2025–2026)
- Gayle Laakmann McDowell, *Cracking the PM Interview*
- Tryexponent.com and Interview Kickstart 2026 Amazon behavioral guides
