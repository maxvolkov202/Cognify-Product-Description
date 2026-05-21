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

## Priority 1-3 (post-Phase 8) — Provider-peer + ops surfaces + final verification `[~]` 2026-05-21

**Priority 1 — Provider-peer dispatch (`59b3d155`):**
- `SCORING_PROVIDER` env var (anthropic | openai, default anthropic) chooses the canonical scoring primary
- Both providers fully symmetric: either can serve as primary with the other as cross-provider fallback
- Model tagging convention:
    - Anthropic primary: `<model-id>` (unprefixed)
    - Anthropic fallback: `anthropic-fallback:<model-id>` (NEW)
    - OpenAI primary: `openai:<model-id>` (NEW)
    - OpenAI fallback: `openai-fallback:<model-id>` (legacy preserved)
- `OPENAI_FALLBACK_MODEL` default flipped: `gpt-4o` → `gpt-4.1-mini`
- `SCORING_OPENAI_TIMEOUT_MS` default bumped 12000→25000 to fit gpt-4.1-mini's real latency on the scoring prompt
- New `FailureReason` value `anthropic_fallback_used`; `resolveFallbackReason(metrics)` helper detects which provider served as fallback from the model tag
- All 5 telemetry-writing routes use the helper so dashboards distinguish "anthropic primary, openai served" vs "openai primary, anthropic served"
- Non-scoring callers (framework gen, weekly narrative, etc.) unchanged — `create` still goes through the legacy Anthropic-primary `messagesCreateWithFallback`

**Priority 2 — Deferred ops surfaces (`0ed9fb1b`):**
- `/ops/calibration/drift` — reads `callout_drift_reports` written by the Phase 7 cron. Groups rows by week → dimension, surfaces flagged dims (wrong rate ≥25%, n≥4) with per-dim wrong-rate cards.
- `/ops/exemplar-bank` — NEW page for the DB-backed Phase 6 `reference_reps` table (distinct from /ops/reference-bank which lists the JSON calibration seed source). List + promote-by-rep-UUID + per-row notes editor + demote (hard delete).
- "Promote to bank" button on /ops/review-queue submitter — captures gold-standard exemplars without leaving the review screen. Bands as `confirmed` or `promoted` based on the operator's verdict.
- New nav links on /ops landing page for Callout drift + Exemplar bank.

**Priority 3 — Side-by-side provider verification (10-rep replay):**

| Rep | Anthropic primary (composite, latency) | OpenAI primary (composite, latency) | Δ |
|---|---|---|---|
| band-poor-mic-test | 11 / 21.4s | 16 / 25.7s | +5 |
| band-below-rambling-pitch | 70 / 15.6s (mock fallback) | 26 / 28.0s | −44 |
| band-competent-okay-pitch | 82 / 28.6s | 70 / 16.4s | −12 |
| band-strong-clean-pitch | 70 / 17.5s (mock fallback) | 78 / 22.2s | +8 |
| band-excellent-tight-pitch | 70 / 32.6s (mock timeout) | 77 / 15.8s | +7 |
| edge-shallow-but-organized | 70 / 31.3s (mock timeout) | 43 / 17.6s | −27 |
| edge-fast-no-fillers | 70 / 32.0s (mock timeout) | 82 / 13.2s | +12 |
| edge-variety-with-upspeak | 58 / 23.1s | 58 / 14.0s | 0 |
| indep-clear-but-padded | 78 / 18.3s | 80 / 21.4s | +2 |
| qa-strong-pricing-question | 80 / 21.1s | 81 / 26.5s | +1 |

**Latency (10-rep p50 / p95):**
- Anthropic primary: 23.0s / 32.2s (dominated by mock-fallback timeouts from credit_balance still failing → OpenAI fallback)
- OpenAI primary:    21.3s / 27.9s

**Failure mix:**
- Anthropic primary: 5 openai-fallback served, 2 validation_failed (OpenAI returned invalid JSON), 3 timeouts (OpenAI took >25s)
- OpenAI primary:    9 served cleanly, 1 validation_failed (gpt-4.1-mini returned schema-incompliant JSON)

**Findings & flags to Max:**
1. **Anthropic still 100% failing** on the dev key — every primary call returns `credit_balance_too_low` despite Max's refill. Confirms the workspace/key mismatch from the Phase 0 notes hasn't resolved. The credit_balance check fast-fails (<500ms), so the wrapper's fallback kicks in cleanly.
2. **OpenAI primary path is reliable** — `openai:gpt-4.1-mini-2025-04-14` served 9/10 reps successfully end-to-end, with telemetry correctly tagging the new `openai:` prefix and `failureReason: none`.
3. **gpt-4.1-mini is SLOWER than gpt-4o** on the scoring prompt — 21s p50 vs ~7s p50 in the Phase 0 baseline on gpt-4o. The "faster + cheaper" rationale Max captured doesn't hold on latency. Cheaper, yes (gpt-4.1-mini is ~$0.40/M input vs $2.50/M for gpt-4o), but the model is slower per token. Trade-off Max needs to make:
   - Keep `gpt-4.1-mini` default → cheaper, slower (~21s p50)
   - Revert to `gpt-4o` default → 6× more expensive, faster (~7s p50)
   - The new `SCORING_OPENAI_TIMEOUT_MS=25000` default covers gpt-4.1-mini. If reverting to gpt-4o, also reset the timeout to 12s.
4. **Composite drift between providers**: when both produced real scores (excluding mock-fallback rows), drift was +1 to +12 with one outlier at −12. Average +1.6, within ±5 on 5 of 7 real-vs-real pairs. The drift isn't symmetric — gpt-4.1-mini tends to score reps slightly higher than Anthropic Haiku 4.5 (when Anthropic is actually working). Once Anthropic credit is restored, full 48-rep calibration harness can run and gate at ±5.
5. **Telemetry tagging works**: dashboard SQL filters on `model_used` correctly distinguish primary vs fallback for both providers. `/api/score/health/stats` will show non-zero `openaiFallbackRate` only when Anthropic was configured as primary and fell back; the symmetric `anthropic_fallback_used` reason captures the inverse.

**Baselines persisted:**
- `plans/baselines/phase-9a-anthropic.json` — SCORING_PROVIDER=anthropic, 10-rep replay
- `plans/baselines/phase-9b-openai.json` — SCORING_PROVIDER=openai, 10-rep replay (same subset)

**Ready for Max's smoke test:**
- All code committed on `feat/rag-scoring-overhaul` (commits `59b3d155`, `0ed9fb1b`, +1 follow-up)
- Typecheck clean, 12/12 tests pass
- Dev server on port 3333 untouched and still alive for browser smoke
- Branch ready to merge to main once Max approves; do NOT merge without explicit go-ahead per the working constraints

---

## Phase 8 — Verification + Production Merge `[~]` awaiting user decision

**Verification checks (all green):**
- [x] `npm run typecheck` — passes
- [x] `npm test` — 12/12 pass
- [x] `npm run lint` — only the pre-existing UserMenu.tsx warning (not our work)
- [x] /api/cron/weekly-callout-drift smoke test — returns 200, writes drift rows
- [ ] Full calibration harness side-by-side — BLOCKED on Anthropic credit/workspace issue (would compare Phase 8 branch vs main on 48 reference reps)
- [ ] Manual smoke test in browser (workout / focus / pressure / framework / scenario) — handoff to user
- [ ] Telemetry vs target (mock-fallback <2%, p95 latency target) — currently dominated by 100% OpenAI fallback; will revisit when Anthropic resolved

**Latency arc across phases (server-side baseline, 10-rep replay):**

| Phase | p50 (ms) | p95 (ms) | Avg Prompt | Note |
|---|---|---|---|---|
| Phase 0 degraded | 8032 | 15845 | 39 KB | 100% OpenAI fallback, no instrumentation |
| Phase 0 canonical | 7175 | 9480 | 39 KB | Same after restart, instrumentation live |
| Phase 1 | 5749 | 8422 | 39 KB | −20%/−11% via tight timeouts |
| Phase 2 | 5383 | 6411 | 39 KB | Frontend optimistic preview (server unchanged) |
| Phase 3 | **5118** | **5580** | **21 KB** | **−45% prompt size; best snapshot vs baseline** |
| Phase 4 | 6672 | 8222 | 26 KB | RAG quality win, +485ms retrieval cost |
| Phase 5 | 10738 | 11760 | 37 KB | Two-stage adds 2nd LLM call (no cache to amortize) |
| Phase 6 | 12059 | 15161 | 38 KB | +1s few-shot retrieval on stage 2 |

**Why Phases 5+6 look "slower":** the Phase 0 baseline runs 100% on OpenAI fallback (no Anthropic prompt cache). Two-stage scoring + few-shot exemplars are designed to win when (a) Anthropic returns + cache hits land OR (b) client UI consumes /api/score/stage1 then /api/score/stage2 progressively. With Anthropic cache amortizing stage 2's shared blocks, projected latency is ~800ms stage 1 + ~3s stage 2 (~3.8s total) vs today's 12s. With progressive UI, the user sees scores at ~800ms, copy at ~3.8s — vs today's all-or-nothing wait.

**What's ready to merge as-is (no Anthropic dependency):**
- Phase 1: tight timeouts + faster fallback → user-visible win today
- Phase 2: client-side deterministic dim preview → user-visible win today
- Phase 3: slim knowledge anchors → user-visible win today (45% prompt reduction)
- Phase 7: drift detection cron infrastructure (no user-visible change)

**What's ready but value gated on Anthropic+UI:**
- Phase 4: RAG knowledge retrieval (485ms cost, quality benefit)
- Phase 5: two-stage infrastructure (no client UI yet)
- Phase 6: few-shot exemplars (1s stage 2 cost, quality benefit)

**Decision needed (see commit summary):** merge all, merge subset, or hold for Anthropic fix.

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
