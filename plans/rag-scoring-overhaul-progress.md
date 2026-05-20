# RAG + Scoring Overhaul — Progress Tracker

> **Branch:** `feat/rag-scoring-overhaul` (off `feat/openai-fallback`)
> **Started:** 2026-05-20
> **Goal:** Faster feedback, better calibration, knowledge-aware grading, learning-over-time loop.
> **Constraint:** No frameworks (LangChain/LlamaIndex/etc.). Direct pgvector + OpenAI embeddings + raw SQL. Per Saraev's "frameworks are inversely correlated with revenue."

If picking up across sessions: read this file first, find the current phase, resume there. Each phase has a `status:`, a definition-of-done, and a checkpoint protocol.

---

## Phase status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete, user-confirmed at checkpoint
- `[!]` blocked — see notes

---

## Phase 0 — Instrumentation & Baseline `[ ]`

**Why first:** Need numbers before changing anything. Can't tell if improvements helped without baseline.

**Changes:**
- [ ] Drizzle migration: `scoring_telemetry` table (rep_id, prompt_size_bytes, cache_read_tokens, cache_creation_tokens, model_duration_ms, validation_duration_ms, total_server_duration_ms, model_used, failure_reason enum, created_at)
- [ ] Wrap Anthropic call in `scoreRep` with timing + size capture
- [ ] Categorize mock-fallback triggers by reason: `none`, `timeout`, `rate_limit_429`, `validation_failed`, `truncated`, `openai_fallback_used`, `mock_fallback_both_failed`, `network_error`
- [ ] Extend `/api/score/health` endpoint: p50/p95/p99 latency, mock-fallback rate, OpenAI-fallback rate, cache-hit rate over 1h/24h/7d windows
- [ ] Server log line on every Anthropic call: `[score] anthropic: model=<x>, promptBytes=<n>, cacheRead=<y>, durMs=<z>, failureReason=<r>`
- [ ] Verify telemetry row written for happy path AND every fallback path

**Checkpoint 0:**
- Dev server runs at http://localhost:3333
- User runs 5–10 reps in /workout
- Then hits `/api/score/health` to see numbers
- User confirms baseline numbers before Phase 1 begins

---

## Phase 1 — Tight Timeouts & Faster Fallback `[ ]`

**Changes:**
- [ ] `AbortController` wrapping Anthropic call in `messagesCreateWithFallback`, 8s default timeout (env `SCORING_ANTHROPIC_TIMEOUT_MS`)
- [ ] Extend `shouldFallback()` in `claude.ts` to recognize `AbortError` / `DOMException` name `AbortError`
- [ ] OpenAI fallback gets its own 6s `AbortController` timeout
- [ ] Both-failed path writes specific `failureReason` to telemetry instead of generic "Unknown error"
- [ ] Improve `buildFallbackScore` callout copy: differentiate by reason (timeout vs validation vs both-failed)
- [ ] Add specific `failureReason` field to `RepScore` type so the UI can render contextual messaging

**Checkpoint 1:**
- Dev server restart
- User runs 5 reps; one should be a long/complex rep to test the timeout
- User confirms mock-fallback rate dropped and remaining mock callouts have better copy

---

## Phase 2 — Render Deterministic Dims Immediately `[ ]`

**Changes:**
- [ ] Create `src/lib/scoring/deterministic-client.ts` — re-exports `scorePacing`, `scoreThinkingQualityDeterministic`, `extractSignals` from a client-safe path. Verify no Node-only deps (`node:crypto`, `fs`, etc.)
- [ ] Update WorkoutPlayer (or whichever component owns rep submit): on rep end, compute delivery + thinking_quality locally from word timings
- [ ] DimensionGrid: accept `optimisticDims?: { delivery, thinking_quality }` prop; render those cards immediately with real scores; show shimmer skeleton on the other 4 until server response arrives
- [ ] On server response: replace optimistic with canonical (they'll match — both compute from same pure functions, but server is source of truth)

**Checkpoint 2:**
- Dev server restart
- User does 3+ reps
- Confirms delivery + thinking_quality cards appear <500ms post-rep
- Confirms remaining 4 dim cards fill in when LLM responds

---

## Phase 3 — Slim Knowledge Anchors `[ ]`

**Changes:**
- [ ] Rename `src/lib/ai/knowledge/skills/*.md` → `*-full.md` (preserve rich content for Phase 4 RAG)
- [ ] Write new slim `skills/*.md` files, ~1.5KB each. Structure:
  - Header + 1-line definition
  - "What HIGH X sounds like" — 6 signal-only bullets
  - "What LOW X sounds like" — 6 signal-only bullets
  - "Edge case rules" — 4 bullets
- [ ] Update `loadLlmScoredSkillKnowledge()` to consume slim variant
- [ ] `scripts/build-knowledge.mjs`: emit BOTH `SKILLS_BLOCKS` (slim) and `SKILLS_BLOCKS_FULL` (rich, used by Phase 4 ingestion)
- [ ] Bump `RUBRIC_VERSION` in `src/lib/scoring/rubric.ts` to `v3.3.0` with comment explaining the slim-down + RAG transition
- [ ] Verify cache_control works — new content rebuilds cache once, then warm

**Checkpoint 3:**
- Dev server restart
- User runs 5 reps in 2–3 different domains
- Eyeball feedback quality side-by-side (optional: git stash → test with full → unstash → test with slim → compare 3 reps)
- User confirms quality didn't regress + latency dropped on cache miss

---

## Phase 4 — pgvector + RAG Knowledge Retrieval `[ ]`

**Database (Drizzle migration):**
- [ ] Enable `pgvector` extension in Supabase
- [ ] Table `knowledge_chunks(id, source_file, section, content, token_count, tags jsonb, embedding vector(1536), content_hash, created_at)`
- [ ] HNSW index: `CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)`

**Build pipeline:**
- [ ] `scripts/build-knowledge-chunks.mjs` — splits `*-full.md` on H2, caps at ~800 tokens, tags by kind+topic+section, emits manifest with content_hash
- [ ] `scripts/embed-knowledge.mjs` — batch-embed via OpenAI `text-embedding-3-small`, upsert on (source_file, section, content_hash) — idempotent
- [ ] Wire both into `npm run build:knowledge` (or add `npm run build:knowledge:embed` if separating)

**Runtime:**
- [ ] `src/lib/ai/rag/retrieve.ts` — `retrieveKnowledgeForRep({ transcript, scoredDims, frameworkId?, domain? }): Promise<RetrievedChunk[]>`
  - Embed transcript (one call, ~$0.000002/rep)
  - Cosine similarity top-K with HNSW
  - Re-rank for coverage: ≥1 chunk per scored_dim if possible
  - Return ~4–6 chunks (~3–5 KB)
  - 1.5s timeout; on failure return `[]` and log telemetry
- [ ] Wire into `scoreRep` user message as `RAG CONTEXT` block (XML-tagged: `<chunk source="..." section="...">...</chunk>`)
- [ ] Cached system prompt unchanged (rubric is canonical when conflicts; RAG is supplemental anchors)

**Checkpoint 4:**
- Dev server restart, run `npm run build:knowledge:embed` once to populate chunks table
- User runs 10 reps across different domains (sales, behavioral interview, exec briefing, etc.)
- User confirms feedback quality at least as good as Phase 3; latency comparable or better (slim prompt + small RAG injection)

---

## Phase 5 — Streaming + Two-Stage Scoring `[ ]`

**Scoring split:**
- [ ] `scoreRepStage1(input)` — 6 dim scores + primaryFocusDimension + headlineTone. `max_tokens: 300`. Pure scoring, no copywriting.
- [ ] `scoreRepStage2(input, stage1)` — headline + 3 callouts + didWell/didntLand/nextRepFocus + nextRepHint. `max_tokens: 1800`. Stage1 fed in as context.

**Streaming:**
- [ ] `/api/score` becomes SSE (`text/event-stream`)
- [ ] Event sequence: `scores` → `headline` → `callout` (x3) → `bullets` → `complete`
- [ ] Use partial-JSON parsing (or stage 2 streams natural-text fields one-by-one if cleaner)
- [ ] Client switches to `EventSource`; DimensionGrid + ScoreHero + FeedbackPanel update progressively

**Fallback:**
- [ ] Stage 1 fail → full mock-fallback (same as today)
- [ ] Stage 2 fail (after Stage 1 succeeded) → render scores + "Detailed feedback unavailable" notice (NOT full mock)

**Checkpoint 5:**
- Dev server restart
- User runs 10 reps
- Confirms headline visible in ~1–2s, full feedback ~4–5s

---

## Phase 6 — Few-Shot Exemplar Retrieval `[ ]`

**Database:**
- [ ] Table `reference_reps(id, source_rep_id, transcript, duration_ms, known_scores jsonb, known_feedback jsonb, tags jsonb, embedding vector(1536), promoted_at, promoted_by, notes)`

**Seeding:**
- [ ] `scripts/seed-reference-bank.mjs` — pull from `score_corrections` where verdict ∈ {confirmed_accurate, should_be_lower, should_be_higher} with corrected_composite. Bootstrap 15–25 refs.
- [ ] /ops/review-queue: "Promote to reference bank" button

**Retrieval:**
- [ ] `retrieveSimilarReps({ transcript, scoredDims })` — top-2 cosine, similarity > 0.7 threshold, 1s timeout
- [ ] Inject into Stage 2 prompt only, XML-tagged as `<example similarity="...">...</example>`

**Admin:**
- [ ] Minimal `/ops/reference-bank` list page (list + filter + promote/demote/notes)

**Checkpoint 6:**
- Dev server restart
- User does 5 reps where similar refs should exist
- Confirms feedback feels more consistent + tone calibrated

---

## Phase 7 — Aggregate Drift Detection + Auto-Proposals `[ ]`

**Drift cron:**
- [ ] `/api/cron/weekly-callout-drift` — group callout_corrections by (dim, sub_skill, verdict) over 7d, flag >25% wrong rate, write to `callout_drift_reports` table

**Auto-proposal cron:**
- [ ] `/api/cron/calibration-proposals` — for each flagged dim, Claude generates 3 candidate rubric edits, each run against calibration harness (existing infra), ranked by improvement, surfaced to ops UI

**Ops UI:**
- [ ] `/ops/calibration/drift` — drift report viz
- [ ] `/ops/calibration/proposals` — list of proposed edits + harness scores + "Ship" button

**Checkpoint 7:**
- Dev server restart
- User reviews drift report + first auto-proposal
- Confirms loop is functional (doesn't need a "good" proposal to confirm — just need it to generate)

---

## Phase 8 — Verification + Production Merge `[ ]`

**Pre-merge:**
- [ ] Full calibration harness run, side-by-side vs `feat/openai-fallback`, drift <±5pt tolerance on all 20+ reference reps
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (dna-signals, dna-pure-helpers, session-types, pressure-orchestrator)
- [ ] Smoke test: workout, focus mode, pressure rep, framework rep, scenario training, /ops pages
- [ ] Telemetry: mock-fallback rate <2%, p95 latency target met (TBD baseline-dependent)

**Merge:**
- [ ] Determine target: merge into `feat/openai-fallback` first, then bubble up, OR rebase onto `main` and merge directly?
- [ ] Squash-merge
- [ ] Monitor `/api/score/health` for 24h post-merge

---

## Notes & decisions log

- 2026-05-20: Branched off `feat/openai-fallback` (not `main`) because that branch has 20+ scoring/prosody/calibration commits unmerged to main — our work needs to build on the latest scoring state.
- 2026-05-20: Logo polish committed (`06f3df7c`) on `feat/openai-fallback` to clear the workspace before starting.
- 2026-05-20: `Build_mobile_apps_*_transcript.txt` and `nick_saraev_*_transcript.txt` patterns added to .gitignore (Max's local reference materials).
- 2026-05-20: Parallel-brainstorm preference saved to memory (`feedback_parallel-brainstorm.md`) for use NEXT time we scope something big.
