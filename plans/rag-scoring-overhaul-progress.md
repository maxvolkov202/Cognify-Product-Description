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

## Phase 0 — Instrumentation & Baseline `[~]` (code complete, awaiting checkpoint)

**Why first:** Need numbers before changing anything. Can't tell if improvements helped without baseline.

**Changes:**
- [x] Drizzle migration `0015_scoring_telemetry.sql` — applied to DB, verified 18 columns, 0 rows
- [x] `anthropic.messages.createWithMetrics` wrapper in `src/lib/ai/claude.ts` returns { response, metrics } (modelUsed, modelDurationMs, promptSizeBytes, input/output/cache tokens, fallbackFired)
- [x] `scoreRepWithMetrics` in `src/lib/ai/score.ts` — computes prompt size, captures validation timing, returns { score, metrics }. `scoreRep` stays as thin backward-compat wrapper.
- [x] Categorize failures via `categorizeFailure()` in `src/lib/scoring/telemetry.ts` — buckets: none, timeout, rate_limit_429, validation_failed, truncated, openai_fallback_used, mock_fallback_both_failed, network_error, unknown
- [x] `writeScoringTelemetry()` helper — fire-and-forget, safeDb-wrapped, never blocks response
- [x] /api/score and /api/score-internal both write telemetry on success AND failure paths
- [x] New `/api/score/health/stats` endpoint — p50/p95/p99 latency, fallback rates, cache hit rate, failure_reason distribution over 1h/24h/7d windows
- [x] Structured `[ai] call: model=… promptBytes=… cacheRead=… durMs=… fallback=…` log line per call
- [x] Typecheck passes, test suite passes (12/12)
- [x] Committed as `656022ef`

**Checkpoint 0:** ✅ baseline captured 2026-05-21 (against degraded provider state)

Baseline source: `scripts/phase-baseline.mjs` replays a fixed 10-rep subset from `scripts/calibration/reference-reps.json` through `/api/score`. Same subset will be re-run at every subsequent phase. Persisted as `plans/baselines/phase-0.json` and `phase-0-degraded-openai-only.json` (the pre-refill snapshot).

**Phase 0 canonical baseline (10 reps):**
- Latency total p50/p95/p99: **7175 / 9480 / 9480 ms**
- Latency model p50/p95/p99: **7172 / 9463 / 9463 ms**
- Avg prompt size: **39050 bytes**
- Cache hit rate: **0.0%**
- Mock-fallback rate: **10.0%** (1 of 10; OpenAI fallback returned JSON missing transcriptStart/transcriptEnd → Zod rejected)
- OpenAI-fallback rate: **90.0%**
- Anthropic-served rate: **0.0%**

**Important caveat:** baseline is against the OpenAI fallback path, not the canonical Anthropic-happy path. Anthropic returns `credit_balance_too_low` on every scoring call despite the user's $53 balance + $498 monthly headroom. Probable workspace/key mismatch (the cheap probe to `/api/score/health` succeeds, but real scoring calls fail). User to verify key's workspace at https://console.anthropic.com/settings/keys matches the refilled billing workspace.

**Phase 0 also caught a small classifier bug:** the mock-fallback row from a ZodError landed in the `unknown` bucket instead of `validation_failed` because the regex didn't match Zod-issue-array signatures. Patched in `src/lib/scoring/telemetry.ts` — categorizer now matches by `name === "ZodError"` AND by Zod-issue-shape patterns (`"code":"invalid_type"`, `"received":"undefined"`, `"path":["callouts"…]`).

Proceeding to Phase 1 with OpenAI as the de-facto serving model. When Anthropic comes back online (workspace fix), the cache discipline + Haiku speed will be an additional 3-5x win on top of every other phase improvement — bigger gains, not blocked work.

---

## Phase 1 — Tight Timeouts & Faster Fallback `[x]` shipped 2026-05-21

**Changes:**
- [x] `AbortController` on Anthropic call, 5s default (env `SCORING_ANTHROPIC_TIMEOUT_MS`). Tuned from initial 8s after baseline showed Anthropic returns credit_balance errors in <500ms.
- [x] Recognize AbortError as fallback-eligible in `claude.ts` wrapper
- [x] OpenAI fallback gets 12s `AbortController` timeout (env `SCORING_OPENAI_TIMEOUT_MS`). Tuned from initial 6s after baseline showed it clipped healthy responses; will tighten back after Phase 3 cuts prompt size.
- [x] Both-failed path throws combined error preserving both causes ("both providers failed | anthropic: X | openai: Y"), AbortError name preserved on wrapper
- [x] `AnthropicCallMetrics` extended with `underlyingAnthropicError`, `anthropicDurationMs`, `openaiDurationMs`. Telemetry now captures causal context on the happy-fallback path.
- [x] `buildFallbackScore` takes FailureReason → reason-aware callout copy (timeout / rate_limit / validation / network / both-failed get distinct consumer-neutral copy)
- [x] Typecheck + tests pass; baseline re-run committed as `plans/baselines/phase-1.json`

**Phase 1 baseline (10-rep replay):**
- Total p50/p95: **7175ms → 5749ms (−20%) / 9480ms → 8422ms (−11%)**
- Mock-fallback rate: 10% (same count as Phase 0; now correctly categorized as `validation_failed` instead of leaking to `unknown`)
- OpenAI-fallback rate: 90% (unchanged — Anthropic still failing; cache hit rate still 0%; Phase 3 will help most)
- Captured underlying Anthropic error in error_detail on every fallback row (was null before)

---

## Phase 2 — Render Deterministic Dims Immediately `[x]` shipped 2026-05-21

**Changes:**
- [x] `src/lib/scoring/deterministic-client.ts` — explicit client-safe public surface re-exporting extractSignals + scorePacing + scoreThinkingQualityDeterministic. Includes `computeOptimisticDims()` convenience that returns null on <5 words.
- [x] RepSurface.Phase type extended: `scoring` + `processing-async` carry optional `optimisticDims` populated before /api/score fires.
- [x] runScoringPath computes optimisticDims once from word timings and threads them into both phase states.
- [x] New `OptimisticDimensionPreview` component renders the same 6-card grid as DimensionGrid — 2 real DimensionCards + 4 shimmer placeholders. Falls back to existing FeedbackSkeleton when word timings are missing.
- [x] Typecheck + tests pass

**Phase 2 baseline:**
- Frontend-only change. The script measures server-side /api/score latency which doesn't capture the perceptual win.
- phase-2.json p50: 5383ms / p95: 6411ms (within noise of phase-1's 5749/8422; OpenAI was healthier today)
- True Phase 2 measurement: human-eye check — user sees 2 dim cards populated immediately during the scoring loading screen instead of a generic skeleton. Manual verification queued.

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

## Phase 4 — pgvector + RAG Knowledge Retrieval `[x]` shipped 2026-05-21

**Shipped:**
- 0016_pgvector_knowledge_chunks.sql migration: pgvector extension + knowledge_chunks (243 rows: 47 skill + 129 framework + 67 domain), HNSW index
- scripts/embed-knowledge.mjs: chunks markdown on H2, merges short sections, idempotent on (source_file, section, content_hash). Bulk embed cost ~$0.001
- src/lib/ai/rag/retrieve.ts: top-K cosine via pgvector <=>, coverage re-rank (≥1 per scored_dim), 1.5s timeout, graceful degradation
- Wire into scoreRep: FF_RAG_RETRIEVE gate (default ON), runs concurrent with prosody worker
- ragDurationMs + ragChunkCount surfaced through telemetry

**Phase 4 baseline:** total p50 5118→6672ms (+30% expected regression, RAG embed adds ~485ms avg). avg prompt 21KB→26KB. validation_failed 2→0 (cleaner grounding). When Anthropic returns + cache hits land, RAG cost will be largely absorbed.

---

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

## Phase 9 (POST-PLAN) — Muscle-Group Product Pivot `[ ]` (do NOT start until Phase 8 ships)

**This is a stub, not a plan.** After the 8-phase scoring overhaul merges to main, a new focused planning session opens to scope this. Recorded here so it doesn't get lost between sessions.

**What it is:** merge Daily Workout + Skill Lab into a single "brain-gym muscle group per week" adventure-path product. Each communication dimension = one muscle group. Brief daily reps. Habit-building loop. See `~/.claude-personal/projects/.../memory/project_muscle-group-pivot.md` for the long-form description and open questions.

**Why post-plan, not interleaved:**
- 7 of 8 overhaul phases are pure backend (orthogonal to UI pivot)
- Feedback overhaul is foundational — fast/accurate feedback REQUIRED for brief-daily-habit framing
- Pivot is bigger than the feedback fix; deserves its own focused deep-think
- Modification: Phase 2 (deterministic client-side rendering) extracts pure functions but defers UI wire-in until the pivot work

**Process when this starts:** use the parallel-brainstorm pattern (10 sub-agents proposing divergent mechanism designs across UI / progression / session structure / exercise library / db schema), filter, merge into ambitious version. Do NOT bolt onto the scoring overhaul.

---

## Notes & decisions log

- 2026-05-20: Branched off `feat/openai-fallback` (not `main`) because that branch has 20+ scoring/prosody/calibration commits unmerged to main — our work needs to build on the latest scoring state.
- 2026-05-21: Phase 0 baseline first revealed Anthropic credit_balance_too_low on every call → 100% OpenAI fallback. Saved that data as `phase-0-degraded-openai-only.json` as evidence of the pre-fix user experience. After credit refill, re-baselined for the canonical Phase 0 numbers.
- 2026-05-21: Product pivot to muscle-group / adventure-path agreed (max + CTO/CEO team). Scheduled as POST-PLAN Phase 9 stub above. Saved to memory under `project_muscle-group-pivot.md` for cross-session continuity.
- 2026-05-20: Logo polish committed (`06f3df7c`) on `feat/openai-fallback` to clear the workspace before starting.
- 2026-05-20: `Build_mobile_apps_*_transcript.txt` and `nick_saraev_*_transcript.txt` patterns added to .gitignore (Max's local reference materials).
- 2026-05-20: Parallel-brainstorm preference saved to memory (`feedback_parallel-brainstorm.md`) for use NEXT time we scope something big.
