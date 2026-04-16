# Knowledge base

The grounding layer for Cognify's AI feedback and framework generation. Everything here is markdown, versioned in source control, and loaded into Claude's context via the Anthropic prompt cache.

## Why this exists

A monolithic scoring prompt puts the entire rubric inline on every call. That is brittle (drifts across refactors), expensive (tokens paid per call, not cached), and invisible to version control (every change is a commit to a giant prompt string).

Pulling the knowledge out into structured `.md` files gives us:

- **Versioned rubric** — git log shows every rubric change with diffs
- **Prompt caching** — knowledge blocks are stable, so they cache-hit across users and sessions
- **Focused prompts** — scoring clarity loads the clarity MD + relevant patterns, not the whole rubric
- **Patent-ready documentation** — the knowledge files double as the provisional patent's process docs

## Structure

```
frameworks/     one .md per framework (CDI, SCQA, BIE, ...)
                — pedagogy, when-to-use, failure modes, exemplar
                  phrasings, antipatterns
skills/         one .md per scoring dimension
                — what great looks like, signals, exemplar callouts,
                  scoring boundaries
domains/        one .md per domain context (cold-calling, exec-briefing,
                tough-feedback, ...)
                — staple sources + current practitioners + synthesized
                  guidance
patterns/       cross-cutting communication patterns (strong-opening,
                concrete-evidence, landing-the-close, ...)
prompts/        system prompts per pipeline stage (scoring,
                framework-gen, callout composer, mirror-mode rewrite)
                with prompt-cache markers
```

## How it gets loaded

`src/lib/ai/knowledge/index.ts` is the typed loader. Given a pipeline stage + context, it resolves which files to include:

- **Framework generation** → all `frameworks/*.md` + matched domain
- **Scoring a skill** → that skill's MD + relevant patterns
- **Callout composer** → `patterns/*.md`
- **Prompt generation** → matched domain

The knowledge blocks are stable across users, reps, and days. User input (transcript, signals, scenario text) varies. That split is the cost model: O(1) in knowledge, O(n) in users.

## Sourcing policy

Every `.md` file cites its sources. We draw from three tiers:

1. **Staple / foundational** — canonical books and frameworks (Minto, Heath, Voss, Duarte, CCL, Toastmasters, Amazon LP, etc.)
2. **Current practitioners** — modern coaches, podcasters, and data-backed training orgs (Higher Levels, 30MPC, pclub.io, Josh Braun, Gong Labs, etc.)
3. **Recent research** — 2025-2026 data where the topic evolves fast (cold calling, AI-era selling, feedback science)

Raw source material lives in `/_inbox` (gitignored). Distilled versions live here. Distillation is original synthesis with citations, not copy-paste.

## Versioning

When a knowledge file changes in a way that would shift scoring outputs, bump `RUBRIC_VERSION` in `src/lib/scoring/rubric.ts`. Past rep scores stay tagged with the version they were scored under, so trend lines are honest.
