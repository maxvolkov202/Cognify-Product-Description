# Skill: Pacing

> "Speed, rhythm, and time budget discipline."

Pacing is the dimension that measures whether the rep *moves* correctly — neither rushed nor dragging, finishing within the time budget, with filler and hedges under control. This is the most deterministically-scorable dimension in the rubric. Pacing maps 1:1 to Deepgram's word-level timestamps — WPM, filler rate, quartile variance, time-budget compliance — and is therefore the cleanest path to **model-stable trend lines** (the measurability story David demanded in the April 2026 advisory meeting).

## Definition

WPM is stable across the rep. Filler rate is low. Hedges are rare. The rep finishes within the time budget without rushing the closer or leaving the ending half-baked. Pauses are purposeful (breath, emphasis) rather than panicked (working memory overflow).

## Experts and sources

- **Elizabeth Shriberg** (SRI / Microsoft Research) — foundational work on speech disfluencies and filler-word taxonomy. Her 1994 Switchboard corpus analysis is still the reference for baseline disfluency rates in L1 English speech.
- **Strunk & White**, *The Elements of Style* — Rule 17: *"Omit needless words. Vigorous writing is concise."* The most-quoted rule in English style, and it applies to speech as much as to writing.
- **George Orwell**, "Politics and the English Language" (1946) — *"If it is possible to cut a word out, always cut it out."*
- **William Zinsser**, *On Writing Well* (1976) — Chapter 2, "Simplicity" — clutter as the enemy.
- **US Military BLUF doctrine** — Bottom Line Up Front, engineered for situations where pacing discipline matters more than anywhere else (see `bluf.md`).
- **Matt Abrahams** (Stanford GSB), *Think Faster, Talk Smarter* (2023) — tempo management under impromptu pressure; breath work as a pacing tool.
- **Carmine Gallo**, *Talk Like TED* (2014) — the 18-minute cognitive limit and tempo analysis of 500+ TED talks.

## What great pacing sounds like

- Filler rate under 2 per minute
- Consistent WPM across the rep — final quartile within ±10% of opening quartile
- Finishes within 90–110% of the time budget
- No visible rush in the final sentence
- Hedges are rare ("maybe", "I think", "sort of" — under one per minute)
- Breaks are purposeful — breath, emphasis, giving the listener a beat
- The last sentence lands cleanly — doesn't trail off, doesn't get cut off by time

## What low pacing sounds like

- Filler words: "um", "uh", "like", "you know", "basically", "actually", "literally"
- Hedges: "kind of", "sort of", "I think", "maybe", "I guess", "just"
- Rushing in the final quartile when the clock hits 75% — WPM accelerates sharply
- Voice tightening, pitch rising near time-out
- Going significantly over or under the time budget
- Run-on sentences that could have been three sentences
- Rambling — over-qualifying every claim

## Signals (strongly deterministic — this is pacing's superpower)

Pacing is the **most deterministic dimension** in Cognify. All of its signals come from Deepgram word-level timestamps:

- **Filler rate** = filler_word_count / (duration_ms / 60000)
- **Hedge rate** = hedge_word_count / (duration_ms / 60000)
- **WPM** (words per minute) = word_count / (duration_ms / 60000)
- **Quartile WPM variance** — split the rep into 4 time quartiles, compute WPM per quartile, measure the variance. High variance = unstable pacing.
- **Final-quartile WPM delta** — how much does WPM change in the last quartile vs the median? >30% acceleration is a rush signal.
- **Time-budget compliance** = duration_ms / time_budget_ms. Flag < 0.60 (under-spoken) or > 1.10 (over-time).
- **Long-pause count** — pauses > 1500ms outside natural breath windows.

In the hybrid scoring architecture (Phase 6), pacing will be scored by a **pure deterministic function** of these signals with zero LLM layer. That means its trend lines are mathematically stable across time — the same audio scored today and next month returns the exact same number. **This is the model-stability guarantee that answers David's measurability critique.**

## Filler-word lexicon (English, v1)

Non-lexical: `um`, `uh`, `er`, `ah`, `hmm`
Lexical: `like` (context-sensitive), `you know`, `I mean`, `so`, `basically`, `actually`, `literally`, `honestly`, `right?`

## Hedge lexicon (English, v1)

`I think`, `I guess`, `maybe`, `perhaps`, `probably`, `possibly`, `sort of`, `kind of`, `a bit`, `a little`, `just`, `pretty much`, `more or less`

Both lexicons are versioned and will evolve with calibration data from external-validation rankings.

## Scoring boundaries

| Score | What it looks like |
|---|---|
| **95** | Filler < 2/min. Hedges < 1/min. WPM variance < 10%. Finishes within 95–105% of budget. Final sentence lands. |
| **80** | Filler 2–4/min. Hedges 1–2/min. Minor pacing drift. Within 90–110% of budget. |
| **60** | Filler 4–8/min. Some hedging. Noticeable final-quartile rush. Time budget at the edge. |
| **40** | Filler 8–15/min. Multiple hedges. Clear rush. Over or significantly under budget. |
| **20** | Filler > 15/min. Constant hedging. Unstable pacing. Cut-off ending or abandoned. |

## Exemplar callouts

- *(positive)* "Filler rate 1.4/min — that's tight. Every sentence carried its own weight."
- *(positive)* "Final quartile held steady. You landed the closing at the same pace you opened it. That's the skill."
- *(warn)* "Three 'I think' hedges in the opening 20s weakened a decision you had the right to state plainly."
- *(warn)* "WPM jumped 28% in the final quartile. The timer got in your head. Practice pacing through the countdown, not against it."
- *(critical)* "Filler rate of 11/min is the dominant signal this rep. Cut fillers to cut everything else — confidence, clarity, and relevance all move with it."

## Common failure modes

- **Um/uh filling thinking time** — treat pauses as free; they land better than filler
- **Hedging a claim you actually believe** — "I think maybe we should…" when you mean "we should…"
- **Racing the clock** — speeding up when the timer runs down, instead of deliberately compressing
- **Over-qualification** — "to be honest", "to be fair", "literally", "actually"
- **Cut-off ending** — last sentence incomplete because time ran out

## Antipatterns to flag in scoring

- "Um…" as opener
- "Literally"
- "Basically"
- "Actually" used three or more times
- "I think" + "maybe" in the same sentence
- Any sentence starting with "So…"
- Trailing off with "…and yeah" when the clock hits zero

## Frameworks that train pacing

- **BLUF** (`bluf.md`) — engineered for ruthless compression; the single best pacing drill
- **PREP** (`prep.md`) — forces point-first delivery with a restate at the end — no room to drift or drag
- **Minto Pyramid** (`minto.md`) — Answer-first, three-reason ceiling

## See also

- `confidence.md` — overlapping delivery dimension; low hedges = high confidence AND high pacing
- `thinking-on-the-spot` is now folded into `confidence.md` — pauses and restarts get measured there as cognitive-load signals rather than pacing signals
- `impromptu.md` — the domain MD for when pacing stress is highest
