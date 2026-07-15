# Cognify v2 — Claude Code Instructions

Cognify is a communication gym: users complete spoken reps, get AI coaching, retry, and improve.
Next.js 15 + Supabase Postgres (Drizzle, schema `cognify_v2`) + Anthropic/OpenAI + Deepgram.

## Source of truth

**`plans/prd/cognify-system-change-v2-2026-07.md` is the product spec and the logic behind every
system.** When making a product-behavior decision, read the relevant PRD section first and follow it
over convenience or existing code patterns. If the PRD is ambiguous or conflicts with code, surface
the conflict to Max instead of guessing.

- Active build tracker: `plans/system-change-v2-progress.md` (phases, decision log D20–D23, per-phase
  verify checklists). Update it as work lands.
- Naming bridge (PRD terms ↔ code ↔ DB): `plans/prd/terminology-map.md`. User-facing copy uses PRD
  terms; code/DB identifiers stay stable (e.g. UI "Pacing" = code `delivery`).
- Prompt authoring rules: `docs/prompt-design-canon.md`. Every practice prompt must be answerable by
  ANY adult from their real life — no assumed jobs, possessions, or biography. Vertical-flavored,
  never vertical-locked.

## Standing decisions (do not relitigate)

- Hidden-skill taxonomy: the PRD §5.5 ~149-skill taxonomy is canonical (D20).
- Prompt slate = 5 options (D21, overrides PRD's 4/6).
- Grading: OpenAI primary, single unified pass, tone/pacing graded from audio; Anthropic fallback (D22).
- Legacy prompt System A (`src/lib/ai/prompts/*`, rep-type planners) is being retired (D23).

## Engineering conventions

- Never commit to main; branch per phase, PR + review before merge. Run `/code-review` before each PR.
- All v2 features are flag-gated (`src/lib/flags.ts`, `FF_*`); flags default ON outside production,
  OFF in prod until Phase 6 promotion. Server-resolve flags — pure client code never reads env.
- **Calibration guardrail:** scoring prompts must stay byte-identical for reference reps — render
  optional blocks (retry/event/coaching-memory/calibration) only when present. If you change any
  scoring prompt or model, re-run the calibration suite and note it in the tracker.
- DB enums are append-only. Pure logic lives in `src/server/lib/` / `src/lib/` and is unit-tested;
  server actions stay thin and owner-scoped. Best-effort writes (XP, profile folds, quests) go
  outside the core rep transaction — never let them fail a rep save.
- User-facing copy: plain language, no em-dashes, no communication-theory jargon (Grice/STAR/etc.
  live under the hood only — PRD §11.3).
- Prod env vars: beware the trailing-newline gotcha (`echo | vercel env add` corrupts values —
  verify with `vercel env pull` + grep, then smoke a flag-dependent surface).

## Definition of done (PRD "Working with Claude Code")

Behaves as the PRD defines · integrates with existing systems · meets PRD §11 Product Standards ·
tests + lint green · tracker updated · Max given a concrete verify checklist.
