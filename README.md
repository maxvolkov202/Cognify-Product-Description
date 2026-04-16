# Cognify

> The Duolingo for communication. Train clear thinking into clear speech.

Cognify is a communication training platform — a gym where users practice real conversations out loud. Short, structured reps. Immediate feedback. Measurable growth. Three modes: Daily Workout, Skill Lab, and Scenario Training.

This repository is the **v2 rebuild** — marketing site plus the full training product — incorporating feedback from the April 2026 advisory meeting with David (ex-IBM, creator of Watson) and Jeffrey (NESSIS).

**v1 lives at** [cognifygym.com](https://cognifygym.com) and is the visual reference for this rebuild.

## What's in here

- Marketing site (dual-track: enterprise L&D primary, consumer secondary)
- Training product (three modes, voice capture, AI feedback, progress tracking)
- Enterprise admin dashboard
- External validation flow — the flagship measurability feature
- Scoring methodology documentation (feeds provisional patent prep)

## Tech stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript strict
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: Postgres (Neon) + Drizzle ORM
- **Auth**: Auth.js v5 (email passwordless + Google OAuth)
- **AI**: Anthropic SDK — Claude Opus 4.6 for framework generation, Claude Sonnet 4.6 for scoring
- **Speech-to-text**: Deepgram (word-level timestamps for transcript-linked feedback)
- **Audio storage**: Vercel Blob
- **Rate limiting + streaks**: Upstash Redis
- **Deploy**: Vercel

Stack rationale lives in `docs/PRODUCT.md`.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in secrets
cp .env.example .env.local

# 3. Push database schema (requires DATABASE_URL set)
npm run db:push

# 4. Run dev server
npm run dev
```

Visit http://localhost:3333.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next dev server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |

## Project structure

```
src/
  app/
    (marketing)/    # Public marketing surface
    (app)/          # Authenticated training product
    (admin)/        # Enterprise admin dashboard
    api/            # Route handlers (transcribe, score, framework)
  components/
    ui/             # shadcn primitives
    marketing/      # Landing-page components
    product/        # Training-mode components
    shared/         # Logo, Nav, Footer
  lib/
    ai/             # Claude + prompt bank
    audio/          # Capture + Deepgram
    db/             # Drizzle schema + queries
    scoring/        # Rubric + composite score logic
    utils/
  server/
    actions/        # Next Server Actions
docs/
  PRODUCT.md
  SCORING_METHODOLOGY.md
  POSITIONING.md
  COMPETITIVE.md
  PATENT_NOTES.md
public/
  logo/
```

## Documentation

| File | Purpose |
| --- | --- |
| [`docs/PRODUCT.md`](./docs/PRODUCT.md) | Product vision, three modes, the practice loop, the flywheel |
| [`docs/SCORING_METHODOLOGY.md`](./docs/SCORING_METHODOLOGY.md) | Scoring rubric, signal definitions, weights — the IP core |
| [`docs/POSITIONING.md`](./docs/POSITIONING.md) | Dual-track copy, hero variants, enterprise narrative |
| [`docs/COMPETITIVE.md`](./docs/COMPETITIVE.md) | Condensed competitive intelligence (Yoodli, Speeko, Hyperbound, etc.) |
| [`docs/PATENT_NOTES.md`](./docs/PATENT_NOTES.md) | Flow diagrams and process docs for the provisional patent filing |
| [`docs/SPEECH_FRAMEWORKS.md`](./docs/SPEECH_FRAMEWORKS.md) | Research catalog of the 15 communication frameworks Cognify teaches |
| [`docs/DEV_NOTES.md`](./docs/DEV_NOTES.md) | **Run, restart, and troubleshoot the dev server** — read this first when anything feels off |
| [`ROADMAP.md`](./ROADMAP.md) | Build phases A–E with status |

## Build phases

See [`ROADMAP.md`](./ROADMAP.md). Currently building **Phase A — Foundation**.

## License

Private. Not for redistribution.
