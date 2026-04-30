# Prompt-bank expansion rigs

Two scripts that work together:

1. **`generate-prompts.mjs`** — Claude Opus generator. Bulk-produces N
   candidate prompts for a single (bucket × theme) batch grounded in 6
   voice exemplars pulled from the live bank. Output: JSONL under
   `scripts/generated/`.
2. **`triage-prompts.mjs`** — Interactive CLI to keep / cut / edit each
   candidate. Output: a TS snippet of approved prompts ready to paste
   into the live bank.

## Prerequisites

- `ANTHROPIC_API_KEY` set in `.env.local` (the dev workspace key).
  Workspace must have credits allocated — otherwise the generate call
  returns `credit balance too low`.

## Generate

```bash
# Workout bank (themes: work | life | abstract)
node scripts/generate-prompts.mjs workout simplify abstract 100
node scripts/generate-prompts.mjs workout structure work 100
node scripts/generate-prompts.mjs workout reinforce life 100

# Pressure bank (settings: work | public | personal)
node scripts/generate-prompts.mjs pressure pushback work 50
node scripts/generate-prompts.mjs pressure time_compression public 30
node scripts/generate-prompts.mjs pressure stakes_raise personal 25

# Vertical bank (theme arg ignored; pass `-` or `all`)
node scripts/generate-prompts.mjs vertical sales - 75
node scripts/generate-prompts.mjs vertical healthcare - 60
```

Each run writes a JSONL file:
`scripts/generated/<bank>_<bucket>_<theme>.jsonl`

## Triage

```bash
node scripts/triage-prompts.mjs scripts/generated/workout_simplify_abstract.jsonl
```

Per-candidate keys:
- `y` / `enter` — keep
- `n` / `space` — cut
- `e` — edit (inline prompt for the new text, then keep)
- `q` — save progress and quit (resume support is automatic)
- `?` — show key reference

Resume: progress is saved to `<input>.progress.json` after every 10
decisions. Re-running the same command picks up where you stopped.

Output: `<input>.kept.ts` — paste the snippet into the appropriate
bucket array in `src/lib/ai/prompts/{workout,pressure,verticals}.ts`.
The script reads the live bank to find the highest existing index for
that bucket and emits ids starting from `${bucket}_${nextIndex zero-padded
to 3 digits}` so id collisions are impossible.

## Volume targets (Phase A goals)

- **Workout**: 9 rep types × ~80 prompts (~720 total). Stratified across
  work / life / abstract — aim for roughly 27 per theme per bucket so
  the picker's stratified-by-theme sampling has a deep pool from each.
- **Pressure**: 5 archetypes × ~40 prompts (~200 total). Stratified
  across work / public / personal. Authoring weight skews `work`
  because the live exemplars do.
- **Vertical**: 8 verticals × ~50 prompts (~400 total). Stakeholder
  rotation drawn from `VERTICALS[id].stakeholders` in
  `src/lib/onboarding/constants.ts`.

Total target: ~1320 new prompts (~1620 with the existing 296).

The freshness math (see `~/.claude-personal/plans/jolly-giggling-dahl.md`):
at 80 per workout bucket × per-user prompt history (already shipped),
freshness lasts ~30+ daily sessions per dominant rep type before
saturation. The picker's saturation fallback then serves seen prompts
predictably so the slate is never empty.

## Voice rules (canonical, mirrored in the generator)

The generator's system prompt restates these rules verbatim. If you
edit the rules in the bank file headers, also update
`scripts/generate-prompts.mjs`.

**Workout**:
- Concrete: name the setting, audience, stakes.
- Realistic: lines a real person would actually say.
- General-life flavored — not vertical-gated.

**Pressure**:
- Concrete + realistic.
- Archetype-clean: the mechanism is visible IN the prompt, not assumed.
- Time-honest: time_compression names the budget explicitly.
- Audience-explicit: audience_switch names BOTH audiences by role.

**Vertical**:
- Vertical-anchored: every prompt names a stakeholder or scenario the
  practitioner actually faces.
- Single-sentence, ≤140 chars.

## Anti-patterns (auto-rejected at review)

- "as a [persona]" — no role-playing framing.
- "the methodology of …" — corporate filler.
- "talk about X" / "discuss X" — too abstract.
- "explore your thoughts on …" — no introspection prompts.
- Multi-sentence exposition before the actual prompt.
- Hedge phrases ("perhaps", "you might want to").

## Spot-check after triage

Before pasting a kept-snippet into the live bank, scan it for:

- **Voice drift**: read 5 in a row out loud. Do they all sound like
  the existing exemplars? If two feel stiff, edit them in the snippet
  before pasting.
- **Theme accuracy**: every workout prompt actually fits its theme.
- **Duplicates**: text-search the live bank for any line that already
  exists. The generator dedupes against the 6-exemplar sample but not
  against the entire bank.

## Cost

A 100-candidate Opus call is roughly 5–8K input + 5–8K output tokens.
At Opus pricing that's a small dollar amount per batch. The actual
expansion (~25 batches) totals a few dollars in compute — the human
review time is the bottleneck, not the credits.
