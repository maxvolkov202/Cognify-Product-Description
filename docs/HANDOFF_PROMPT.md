# Cognify v2 — Build Handoff Prompt

> Paste into a fresh Claude Code session opened in `C:\Users\MaxVolkov\dev\cognify` to resume work. Self-contained — no prior conversation needed.

---

## The prompt to paste

```
I'm continuing work on Cognify v2. Phases A–D and Waves 1–6 have shipped.
You're picking up a working product, not scaffolding one. Orient first, then
propose and confirm the next wave with me before touching code.

### Orientation (read these first, in this order)

1. `ROADMAP.md` — what's shipped vs. open. Most recent finished work is Wave 6
   (the "improvement pass" across feedback UX, custom scenarios, AI guardrails,
   help/tutorial, deploy docs, friends, ops dashboard, env-aware progression).
2. `docs/PRODUCT.md` — the three modes, the practice loop, the flywheel
3. `docs/SCORING_METHODOLOGY.md` — scoring rubric (6 dimensions)
4. `docs/POSITIONING.md` — tone + copy that's locked
5. `docs/DEPLOY.md` — local → prod pipeline (Vercel + Neon + Resend)
6. `docs/BACKLOG.md` — parked work
7. Glob `src/` to see the current shape

Relevant plan files in `.claude-personal/plans/`:
- `serene-brewing-pancake.md` — Wave 6 plan (most recent)
- `binary-stargazing-reddy.md` — original build plan
- `serene-brewing-pancake-agent-*.md` — session-reconstruction dumps

### What the product is now

Cognify is "the Duolingo for communication." Three modes (Daily Workout,
Build a Rep, Challenge) + progress surfaces + a social layer + an ops
dashboard. The rubric is six dimensions — clarity / structure / relevance
(content) and confidence / pacing / tone (delivery). Rep-to-rep continuity
is real: `planNextRep` steers the next rep toward the previous rep's
weakest dimension.

Positioning is dual-track with a consumer-first lean (per user direction).
Enterprise admin surface is frozen until first pilot demands it.

### Current stack

- Next.js 15 (App Router) + TypeScript strict + Tailwind v4
- Auth.js v5 (Google + Resend magic link)
- Drizzle + Neon Postgres
- Anthropic SDK — Sonnet 4.6 for scoring + progression, Opus 4.6 for
  talking-points / framework generation
- Deepgram (transcription) + Vercel Blob (audio) + Upstash (rate limit)
- Resend for welcome + /help support emails
- Vercel deploy

### Critical invariants (don't break)

- 6 dimensions, 9 rep types, stable IDs — don't rename.
- Scoring never uses Opus. Sonnet only.
- Scoring is grounded in `src/lib/ai/knowledge/skills/*.md`. Don't regenerate
  feedback without knowledge-base grounding — users see "Why this matters"
  popovers on every callout.
- `planNextRep` adjusts the next rep slot based on `previousRep.dimensions`
  — keep that contract if you refactor workout-prompts.ts.
- Callout schema has `quote` and `suggestedRewrite` columns; they're shown
  to the user on every improvement callout.
- Don't mock data in tests. Real Claude calls in integration tests; real
  Deepgram in audio tests.
- Strict TypeScript. No `any`, no broad casts.

### Files you'll probably touch

Product surface:
- `src/components/product/FeedbackPanel.tsx` — feedback UI
- `src/components/product/WorkoutSession.tsx` — state machine
- `src/components/product/RepSurface.tsx` — rep UI
- `src/components/product/CustomScenarioBuilder.tsx` — Quick + Guided modes
- `src/components/product/WhyThisMattersPopover.tsx` — knowledge popover
- `src/components/product/RepFrameworkStrip.tsx` — framework chips + example
- `src/components/product/TutorialClient.tsx` — tutorial wizard

AI pipeline:
- `src/lib/ai/claude.ts`, `score.ts`, `talking-points.ts`, `progression.ts`
- `src/lib/ai/workout-prompts.ts` (has `planNextRep`)
- `src/lib/ai/rep-types.ts` (9 rep types + curated example scenarios)
- `src/lib/ai/knowledge/*` — knowledge base (never change without thought)

Data / queries:
- `src/lib/db/schema.ts`
- `src/lib/db/queries/{user,friends,ops}.ts`

API routes:
- `src/app/api/progression/route.ts` — uses `src/lib/env.ts` for fail mode
- `src/app/api/knowledge/[dim]/route.ts` — powers popover
- `src/app/api/support/route.ts` — contact form → Resend

Pages:
- `src/app/(app)/{dashboard,workout,build-a-rep,progress,friends,ops,tutorial}/page.tsx`
- `src/app/(marketing)/help/page.tsx`

### The TaskCreate/TaskUpdate discipline

Use them. One task per ROADMAP checkbox. Mark `in_progress` when starting,
`completed` when done. Batch independent Write/Edit calls in a single
message. Do not parallelize edits to the same file.

### Verification gauntlet (run before declaring a wave done)

1. `npm run typecheck` — zero errors
2. `npm run lint` — fix or suppress with a justified reason
3. `npm run dev` → smoke the routes you touched + the end-to-end rep flow
4. Real Claude round-trip for any AI-pipeline change (progression,
   talking-points, scoring). Latency budget: Sonnet ≤ 5s, Opus ≤ 15s.

### What to report at the end of a wave

- Which ROADMAP checkboxes ticked
- What was verified
- Any open issues that need the user's input
- Preview URL if deployed

Never commit to git unless explicitly asked.

Start by reading ROADMAP.md. Then ask the user what wave to tackle next,
or propose one based on the open items in Phase E / Waves 1–6. Don't touch
code until the plan is approved.
```

---

## Notes for the user

- This handoff is current as of the end of Wave 6 (post-improvement pass).
- If you want Claude to jump straight into a new wave, replace the last
  paragraph with a specific directive (e.g., "Start Wave 7 — Lighthouse +
  accessibility audit").
- The `/ops` dashboard is operator-only. Seed your account's `is_operator`
  flag to `true` in Neon before expecting it to load.
- Key env vars for a fresh deploy are in `docs/DEPLOY.md`. `/help` contact
  form and welcome emails both require `RESEND_API_KEY`.
