# Cognify — Knowledge Base Developer Guide

> Practical guide for extending and testing `src/lib/ai/knowledge/`. If you're touching anything in that directory, start here.

## What it is

The knowledge base is a versioned, source-controlled library of markdown files that grounds Cognify's AI pipelines. Every time Claude generates a framework, scores a rep, or produces a callout, it pulls the relevant knowledge blocks into its context via the Anthropic prompt cache.

Three properties distinguish it from an inline rubric:

1. **Versioned** — every change is a git diff, reviewable and rollback-able
2. **Cached** — stable knowledge blocks cache-hit across users and sessions; the cost model is O(1) in knowledge, O(n) in users
3. **Explainable** — the knowledge that grounded any scoring decision is discoverable by a patent examiner, an enterprise buyer, or a user debugging their own score

## Directory structure

```
src/lib/ai/knowledge/
  index.ts            — typed loader + resolveKnowledge()
  README.md           — overview for developers browsing the directory
  frameworks/         — one .md per framework (CDI, SCQA, BIE, STAR, …)
  skills/             — one .md per scoring dimension
  domains/            — one .md per domain context (cold-calling, exec-briefing, …)
  patterns/           — cross-cutting communication patterns
  prompts/            — system-prompt templates per pipeline stage
```

## File format conventions

Plain markdown, no frontmatter required. Each file's filename becomes its ID (minus `.md`). Suggested section order:

### frameworks/*.md

1. Title + one-line description
2. When to use
3. The nodes (numbered)
4. Exemplar phrasing
5. Common failure modes
6. Antipatterns
7. Origin
8. See also (cross-references to other knowledge files)

### skills/*.md

Filenames must match the `SkillDimension` enum exactly: `clarity.md`, `structure.md`, `conciseness.md`, `thinking_on_the_spot.md`, `handling_pressure.md`, `adaptability.md`. The loader resolves by filename → dimension.

1. Definition
2. Experts and sources
3. What great looks like
4. What low looks like
5. Signals (deterministic contribution)
6. Scoring boundaries (20 / 40 / 60 / 80 / 95 table)
7. Exemplar callouts
8. Common failure modes
9. Antipatterns
10. Frameworks that train this skill

### domains/*.md

1. Overview — why this domain matters for Cognify
2. Staple sources
3. Current practitioners (with their signature frameworks + verbatim-where-attributed exemplars)
4. Core principles — synthesized across sources
5. Common failure modes
6. Exemplar phrasings
7. Antipatterns
8. Sources (numbered or bulleted, each cited with year)

## How to add a new knowledge file

```bash
# 1. Create the file in the right category
# Example: add a new domain for "design-review"
vim src/lib/ai/knowledge/domains/design-review.md

# 2. Follow the section-order convention for that category (see above)

# 3. If this file's content would change scoring outputs, bump the rubric version
vim src/lib/scoring/rubric.ts   # bump RUBRIC_VERSION

# 4. Test that it loads
curl "http://localhost:3333/api/debug/knowledge?stage=prompt_gen&domainHint=design-review" | jq

# 5. Commit with a clear message
git add src/lib/ai/knowledge/domains/design-review.md
git commit -m "knowledge: add design-review domain (staple: Will Larson, Camille Fournier)"
```

## How it's wired into the pipelines

`src/lib/ai/knowledge/index.ts` exports three primary functions:

- `loadFrameworks() / loadSkills() / loadDomains() / loadPatterns()` — bulk loaders, one per category
- `loadSkill(id) / loadFramework(id) / loadDomain(id)` — single-file loaders by ID
- `resolveKnowledge(query)` — pipeline-stage-aware resolver that returns the right blocks for the right stage
- `renderBlocks(blocks)` — formats a list of blocks for inclusion in a Claude system prompt

The AI pipeline files (`src/lib/ai/framework.ts`, `src/lib/ai/score.ts`) import `resolveKnowledge` + `renderBlocks` and include the rendered output in the system prompt with `cache_control: { type: "ephemeral" }`. Because the knowledge blocks are stable across calls, they cache-hit on the second and subsequent requests, making the cost O(1) in knowledge size.

### Example: framework generation pipeline

```ts
import { resolveKnowledge, renderBlocks } from "./knowledge";

const knowledge = resolveKnowledge({
  stage: "framework_gen",
  domainHint: inferDomain(scenarioInput),
});
const knowledgeBlock = renderBlocks(knowledge);

const response = await anthropic.messages.create({
  system: [
    { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: knowledgeBlock, cache_control: { type: "ephemeral" } },
  ],
  messages: [{ role: "user", content: userPrompt }],
});
```

## Testing a change

The fastest way to verify your knowledge file loads correctly is the debug route:

```bash
# Check that a specific skill file loads
curl "http://localhost:3333/api/debug/knowledge?stage=score_skill&skill=clarity"

# Check framework generation resolves correctly for a domain
curl "http://localhost:3333/api/debug/knowledge?stage=framework_gen&domainHint=cold-calling"

# Check callout composer resolution
curl "http://localhost:3333/api/debug/knowledge?stage=callout_compose"
```

The debug route returns block IDs, categories, content lengths, and the full rendered prompt chunk. You should see:
- Your new file's ID in the block list
- A non-zero content length
- The full rendered block included in the `rendered` field

If the file is missing from the response, either the filename doesn't match the expected ID convention or the loader's readdir is failing silently. Check `readdirSync` permissions first.

## Sourcing and attribution policy

**Cognify uses ideas. Cognify does not use copyrighted prose.**

Every knowledge file is **original synthesis** written by the Cognify team. We read the sources, extract the pedagogically-useful signals (principles, failure modes, exemplar structures, attributed names), and rewrite in Cognify's voice.

What's OK:
- **Ideas and frameworks** — frameworks like SCQA, CDI, BIE, STAR are in the public domain as intellectual concepts, even when the books introducing them are copyrighted
- **Facts and research findings** — "Gong found that stating the reason for a call makes cold calls 2.1× more successful" is a fact, not copyrightable content
- **Short attributed quotes** — brief verbatim quotes (under 50 words) used for educational commentary with clear attribution fall under fair use
- **Named attribution** — naming a practitioner and describing their signature contribution is factual reporting, not infringement

What's not OK:
- **Long verbatim passages** — no extended quotes from any copyrighted work
- **Unattributed borrowing** — every idea traced to a specific author is named
- **Paraphrasing so close it's effectively copying** — the synthesis must be in Cognify's voice, not a thinly-disguised reprint

The public-facing `/about/references` page lists all sources with titles and years for full transparency.

## Versioning policy

If a knowledge change would **alter scoring outputs**, bump `RUBRIC_VERSION` in `src/lib/scoring/rubric.ts`. Past rep scores stay tagged with the version they were scored under, so trend lines remain honest.

Changes that require a version bump:
- Adding or removing a signal from a skill file
- Changing scoring boundary thresholds
- Adjusting dimension weights

Changes that do NOT require a version bump:
- Adding a new domain file (doesn't affect existing scoring)
- Adding a new framework file
- Clarifying wording without changing substance
- Fixing a typo

## Relation to the provisional patent prep

The knowledge base is one of the artifacts the provisional patent filing will reference. The claim of novelty includes:

- A structured knowledge base that grounds LLM scoring in named practitioner frameworks
- Calibration of signal weights against blind-listener ranking data
- Pipeline-stage-aware knowledge resolution

When you add a new domain or framework file, you're contributing to the IP surface. Keep sourcing clean, attribution explicit, and the synthesis original.

## Debug and troubleshooting

**File not loading:**
- Check filename matches the expected pattern (no caps, hyphens or underscores per category convention)
- Check readdirSync can see the file (permissions, case-sensitivity on deploy target)
- Hit `/api/debug/knowledge` and check the block list

**Prompt getting too big:**
- Use narrower `resolveKnowledge` queries (single skill instead of all skills, specific domain hint instead of all domains)
- Check prompt cache hit rates — if you're seeing the full knowledge block counted on every call, caching isn't working

**Scoring behavior changed unexpectedly after a knowledge edit:**
- You probably needed to bump `RUBRIC_VERSION` and forgot. Re-scoring old audio returns different numbers because the rubric changed but the version wasn't tracked.
- Revert the change or bump the version retroactively and backfill a migration note.

## See also

- `src/lib/ai/knowledge/README.md` — quick overview for directory-browsing developers
- `docs/SCORING_METHODOLOGY.md` — the scoring rubric this knowledge base feeds
- `docs/PATENT_NOTES.md` — the patent filing context
- `docs/DEV_NOTES.md` — dev-server operational runbook
