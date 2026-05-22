/**
 * Phase 4 — RAG knowledge retrieval for the scoring pipeline.
 *
 * Given a rep's transcript + the dimensions being scored, retrieve the
 * top-K most relevant knowledge chunks from cognify_v2.knowledge_chunks
 * via pgvector cosine similarity, then re-rank to guarantee at least
 * one chunk per scored dimension (coverage guarantee).
 *
 * The retrieved chunks are injected into the scoring user message as a
 * RAG CONTEXT block — supplemental anchors that supplement (but don't
 * override) the cached system-prompt rubric.
 *
 * Why no framework: direct OpenAI embedding API + raw SQL pgvector
 * cosine query. Per Saraev's lesson, frameworks add complexity without
 * adding intelligence; the model handles the heavy lifting.
 *
 * Timeout: 1.5s. On timeout or any error, returns [] and the scoring
 * call proceeds without RAG context (graceful degradation — never
 * blocks the rep).
 */

import OpenAI from "openai";
import postgres from "postgres";
import type { SkillDimension } from "@/types/domain";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.RAG_RETRIEVE_TIMEOUT_MS ?? "1500",
  10,
);
const DEFAULT_TOP_K = parseInt(process.env.RAG_RETRIEVE_TOP_K ?? "8", 10);
const DEFAULT_RETURN_COUNT = parseInt(
  process.env.RAG_RETRIEVE_RETURN_COUNT ?? "6",
  10,
);

export type RetrievedChunk = {
  id: string;
  sourceFile: string;
  section: string;
  content: string;
  tokenCount: number;
  /** Tag bag: { kind, topic, section_slug }. */
  tags: Record<string, string>;
  /** Cosine similarity to the query embedding, ∈ [0, 1]. Higher = more similar. */
  similarity: number;
};

// Singletons — initialized lazily on first call so import doesn't cost
// when the route isn't used. Different from the DB client used by
// drizzle: this is a separate connection because we're issuing raw SQL
// with the vector operator that drizzle's query builder doesn't
// natively support.
let _openai: OpenAI | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

function openai(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key, maxRetries: 0 });
  return _openai;
}

function sql(): ReturnType<typeof postgres> | null {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  _sql = postgres(url, { prepare: false });
  return _sql;
}

async function embedQuery(text: string): Promise<number[] | null> {
  const client = openai();
  if (!client) return null;
  // Cap query text for embedding — text-embedding-3-small supports
  // ~8K tokens but we don't need the full transcript context for the
  // retrieval (the system prompt + rubric set the frame; the query
  // just needs to match the content's themes).
  const trimmed = text.slice(0, 6000);
  const resp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  });
  const vec = resp.data[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIMS) return null;
  return vec;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Re-rank top-K by coverage: ensure each scoredDim has at least one
 *  chunk (where a chunk "covers" a dim if tags.topic === dim). Greedy
 *  selection from the cosine-ordered list — keep the top per-dim
 *  coverage chunk, then fill remaining slots with the next-best by
 *  similarity regardless of dim.
 *
 *  Phase B follow-up: when `preferredDim` is set (muscle-group rep with
 *  a known exercise dimension), the highest-similarity chunk matching
 *  that dim wins slot 0, ahead of the rest of the coverage loop. The
 *  remaining coverage passes are unchanged so the other 5 dims still
 *  get representation. Falls through silently when no matching chunk
 *  exists. */
function rerankForCoverage(
  rows: RetrievedChunk[],
  scoredDims: SkillDimension[],
  returnCount: number,
  preferredDim: SkillDimension | null,
): RetrievedChunk[] {
  const picked: RetrievedChunk[] = [];
  const usedIds = new Set<string>();
  // Pass 0: preferred-dim slot. Highest-similarity chunk tagged with
  // the exercise's dimension takes priority over the standard coverage
  // order.
  if (preferredDim) {
    const top = rows.find((r) => r.tags.topic === preferredDim);
    if (top) {
      picked.push(top);
      usedIds.add(top.id);
      if (picked.length >= returnCount) return picked;
    }
  }
  // Pass 1: coverage — best chunk per scored dim (skip the preferred
  // dim since pass 0 already covered it).
  for (const dim of scoredDims) {
    if (dim === preferredDim) continue;
    const match = rows.find(
      (r) => !usedIds.has(r.id) && r.tags.topic === dim,
    );
    if (match) {
      picked.push(match);
      usedIds.add(match.id);
      if (picked.length >= returnCount) return picked;
    }
  }
  // Pass 2: fill remaining slots with the highest-similarity chunks
  // regardless of dim.
  for (const r of rows) {
    if (usedIds.has(r.id)) continue;
    picked.push(r);
    usedIds.add(r.id);
    if (picked.length >= returnCount) break;
  }
  return picked;
}

/** Test-only export. The rerank ordering is the part we can validate
 *  without the embedding API + pgvector roundtrip; tests construct
 *  synthetic chunks and assert the slot 0 / coverage / fill order. */
export const __rerankForCoverageForTests = rerankForCoverage;

export type RetrieveInput = {
  transcript: string;
  scoredDims: SkillDimension[];
  /** Total return count. Defaults to RAG_RETRIEVE_RETURN_COUNT env (6). */
  returnCount?: number;
  /** Internal top-K to retrieve before coverage re-ranking. Defaults to
   *  RAG_RETRIEVE_TOP_K env (8). Must be >= returnCount. */
  topK?: number;
  /** Per-call timeout. Defaults to RAG_RETRIEVE_TIMEOUT_MS env (1500ms). */
  timeoutMs?: number;
  /** Phase B follow-up — when set, the rerank pins the highest-similarity
   *  chunk whose `tags.topic === preferredDim` as slot 0. Used by the
   *  muscle-group scoring path so an exercise like "kill-the-filler"
   *  prioritizes the conciseness knowledge chunk above generic top-K.
   *  Null / undefined keeps the legacy coverage-only behavior. */
  preferredDim?: SkillDimension | null;
};

export type RetrieveResult = {
  chunks: RetrievedChunk[];
  /** Wall-clock duration of the embed + query (excludes prompt-build
   *  overhead). Telemetry uses this. */
  durationMs: number;
  /** Cause of empty result when chunks.length === 0. null when chunks
   *  is populated. */
  failureReason:
    | null
    | "no_openai_key"
    | "no_database"
    | "embed_failed"
    | "query_failed"
    | "timeout";
};

/**
 * Phase 4 entry point. Embed the transcript, query top-K via cosine
 * similarity, re-rank for per-dim coverage, return chunks.
 *
 * Graceful degradation: on any failure (no API key, DB down, OpenAI
 * embed call fails, timeout), returns { chunks: [], failureReason: <why> }
 * and lets the caller proceed without RAG context.
 */
export async function retrieveKnowledgeForRep(
  input: RetrieveInput,
): Promise<RetrieveResult> {
  const start = Date.now();
  const returnCount = input.returnCount ?? DEFAULT_RETURN_COUNT;
  const topK = Math.max(input.topK ?? DEFAULT_TOP_K, returnCount);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const client = openai();
  if (!client) {
    return { chunks: [], durationMs: 0, failureReason: "no_openai_key" };
  }
  const db = sql();
  if (!db) {
    return { chunks: [], durationMs: 0, failureReason: "no_database" };
  }

  try {
    const work = (async () => {
      // 1. Embed the query.
      const queryEmb = await embedQuery(input.transcript);
      if (!queryEmb) {
        throw new Error("embed_failed");
      }

      // 2. Cosine similarity top-K via pgvector. <=> is cosine distance
      //    (0 = identical, 1 = orthogonal); 1 - distance = cosine
      //    similarity for length-normalized vectors.
      const embStr = `[${queryEmb.join(",")}]`;
      type Row = {
        id: string;
        source_file: string;
        section: string;
        content: string;
        token_count: number;
        tags: Record<string, string>;
        distance: number;
      };
      const rows = (await db<Row[]>`
        SELECT
          id::text,
          source_file,
          section,
          content,
          token_count,
          tags,
          (embedding <=> ${embStr}::vector) AS distance
        FROM cognify_v2.knowledge_chunks
        WHERE (tags->>'kind') IN ('skill', 'framework', 'domain')
        ORDER BY embedding <=> ${embStr}::vector
        LIMIT ${topK}
      `) as Row[];

      const ranked: RetrievedChunk[] = rows.map((r) => ({
        id: r.id,
        sourceFile: r.source_file,
        section: r.section,
        content: r.content,
        tokenCount: r.token_count,
        tags: r.tags,
        similarity: Math.max(0, 1 - Number(r.distance)),
      }));

      // 3. Re-rank for coverage.
      return rerankForCoverage(
        ranked,
        input.scoredDims,
        returnCount,
        input.preferredDim ?? null,
      );
    })();

    const chunks = await withTimeout(work, timeoutMs, "RAG retrieve");
    return {
      chunks,
      durationMs: Date.now() - start,
      failureReason: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason: RetrieveResult["failureReason"] =
      /timed out/i.test(msg) || /\babort/i.test(msg)
        ? "timeout"
        : /embed_failed/.test(msg)
          ? "embed_failed"
          : "query_failed";
    console.warn(`[rag] retrieve failed (${reason}):`, msg.slice(0, 200));
    return {
      chunks: [],
      durationMs: Date.now() - start,
      failureReason: reason,
    };
  }
}

/** Render retrieved chunks as an XML-tagged block for the score prompt's
 *  user message. The block is uncached (chunks change per rep). The
 *  cached system prompt's RUBRIC remains canonical when chunks and
 *  rubric conflict — that contract is stated in the scoring system prompt
 *  via the "RAG CONTEXT (additional anchors…)" header. */
export function renderRagContextBlock(chunks: RetrievedChunk[]): string | null {
  if (chunks.length === 0) return null;
  const body = chunks
    .map(
      (c) =>
        `<chunk source="${c.sourceFile}" section="${c.section}" topic="${c.tags.topic ?? "?"}">\n${c.content}\n</chunk>`,
    )
    .join("\n\n");
  return `RAG CONTEXT (additional anchors retrieved for this rep — use as supplemental signals, but the RUBRIC above remains canonical when they disagree):\n\n${body}`;
}
