/**
 * Phase 6 — few-shot exemplar retrieval from cognify_v2.reference_reps.
 *
 * Given a rep's transcript, return the top-K most-similar reference reps
 * (operator-calibrated transcripts with known-good scores). The matches
 * are injected into Stage 2's prompt as XML-tagged exemplars so the
 * copywriting model can see what gold-standard feedback looks like on
 * a similarly-shaped rep.
 *
 * Similarity threshold: a chunk is "useful" as an exemplar only if its
 * cosine similarity exceeds 0.7 — below that, the reference rep is
 * different enough that it'll mislead more than help. When no
 * references clear the threshold, returns []; Stage 2 falls back to
 * the rubric + RAG anchors only.
 *
 * Timeout: 1s. On any failure (no key / DB down / embed fail / timeout)
 * returns []; Stage 2 proceeds without exemplars.
 */

import OpenAI from "openai";
import postgres from "postgres";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.RAG_REFREPS_TIMEOUT_MS ?? "1000",
  10,
);
const DEFAULT_TOP_K = parseInt(process.env.RAG_REFREPS_TOP_K ?? "2", 10);
const SIMILARITY_THRESHOLD = parseFloat(
  process.env.RAG_REFREPS_SIMILARITY_THRESHOLD ?? "0.7",
);

export type ReferenceRepMatch = {
  refId: string;
  transcript: string;
  promptText: string;
  durationMs: number;
  knownScores: Record<string, unknown>;
  knownFeedback: Record<string, unknown> | null;
  tags: Record<string, string>;
  similarity: number;
};

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

export type RetrieveReferenceRepsInput = {
  transcript: string;
  topK?: number;
  timeoutMs?: number;
  /** Optional similarity floor override. Defaults to 0.7. */
  similarityThreshold?: number;
};

export type RetrieveReferenceRepsResult = {
  matches: ReferenceRepMatch[];
  durationMs: number;
  failureReason:
    | null
    | "no_openai_key"
    | "no_database"
    | "embed_failed"
    | "query_failed"
    | "timeout"
    | "below_threshold";
};

export async function retrieveSimilarReps(
  input: RetrieveReferenceRepsInput,
): Promise<RetrieveReferenceRepsResult> {
  const start = Date.now();
  const topK = input.topK ?? DEFAULT_TOP_K;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const threshold = input.similarityThreshold ?? SIMILARITY_THRESHOLD;

  const client = openai();
  if (!client) {
    return { matches: [], durationMs: 0, failureReason: "no_openai_key" };
  }
  const db = sql();
  if (!db) {
    return { matches: [], durationMs: 0, failureReason: "no_database" };
  }

  try {
    const work = (async () => {
      const trimmed = input.transcript.slice(0, 6000);
      const embResp = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: trimmed,
      });
      const queryEmb = embResp.data[0]?.embedding;
      if (!queryEmb || queryEmb.length !== EMBEDDING_DIMS) {
        throw new Error("embed_failed");
      }

      const embStr = `[${queryEmb.join(",")}]`;
      type Row = {
        ref_id: string;
        transcript: string;
        prompt_text: string;
        duration_ms: number;
        known_scores: Record<string, unknown>;
        known_feedback: Record<string, unknown> | null;
        tags: Record<string, string>;
        distance: number;
      };
      const rows = (await db<Row[]>`
        SELECT
          ref_id,
          transcript,
          prompt_text,
          duration_ms,
          known_scores,
          known_feedback,
          tags,
          (embedding <=> ${embStr}::vector) AS distance
        FROM cognify_v2.reference_reps
        ORDER BY embedding <=> ${embStr}::vector
        LIMIT ${topK}
      `) as Row[];

      return rows
        .map<ReferenceRepMatch>((r) => ({
          refId: r.ref_id,
          transcript: r.transcript,
          promptText: r.prompt_text,
          durationMs: r.duration_ms,
          knownScores: r.known_scores,
          knownFeedback: r.known_feedback,
          tags: r.tags,
          similarity: Math.max(0, 1 - Number(r.distance)),
        }))
        .filter((r) => r.similarity >= threshold);
    })();

    const matches = await withTimeout(work, timeoutMs, "Reference-reps retrieve");
    return {
      matches,
      durationMs: Date.now() - start,
      failureReason: matches.length === 0 ? "below_threshold" : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason: RetrieveReferenceRepsResult["failureReason"] =
      /timed out/i.test(msg) || /\babort/i.test(msg)
        ? "timeout"
        : /embed_failed/.test(msg)
          ? "embed_failed"
          : "query_failed";
    console.warn(`[rag/refreps] retrieve failed (${reason}):`, msg.slice(0, 200));
    return {
      matches: [],
      durationMs: Date.now() - start,
      failureReason: reason,
    };
  }
}

/**
 * Render exemplars as a compact XML-tagged block. Transcript is
 * truncated to ~600 chars so the prompt stays bounded — the model
 * needs the SHAPE (high-level structure) of the reference rep, not the
 * full text. knownScores compressed to a one-line tuple per rep.
 */
export function renderReferenceRepsBlock(
  matches: ReferenceRepMatch[],
): string | null {
  if (matches.length === 0) return null;
  const body = matches
    .map((m) => {
      const scoreLine = formatScoreLine(m.knownScores);
      const transcriptPreview =
        m.transcript.length > 600
          ? m.transcript.slice(0, 600) + "…"
          : m.transcript;
      const feedbackHint = m.knownFeedback
        ? `\nKnown feedback themes: ${renderFeedbackHint(m.knownFeedback)}`
        : "";
      return `<example similarity="${m.similarity.toFixed(2)}" ref="${m.refId}" band="${m.tags.band ?? "?"}">\nPrompt: ${m.promptText}\n${scoreLine}\nTranscript: "${transcriptPreview}"${feedbackHint}\n</example>`;
    })
    .join("\n\n");
  return `REFERENCE EXEMPLARS (operator-calibrated reps with shape similar to this one. Use as anchors for tone, specificity, and where to draw band thresholds — NOT as templates to copy):\n\n${body}`;
}

function formatScoreLine(scores: Record<string, unknown>): string {
  const dims = scores.dimensions as Record<string, number> | undefined;
  const composite = scores.composite as number | undefined;
  if (!dims) return `Composite: ${composite ?? "?"}`;
  const parts = ["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"]
    .map((d) => (dims[d] != null ? `${d.slice(0, 4)}=${dims[d]}` : null))
    .filter(Boolean);
  return `Composite: ${composite ?? "?"} | ${parts.join(" ")}`;
}

function renderFeedbackHint(feedback: Record<string, unknown>): string {
  // The seed file's known feedback shape varies. Just pull out any
  // "themes" or "antipatterns" mentions; otherwise omit.
  const assertions = feedback.assertions as Array<{ rationale?: string }> | undefined;
  if (assertions && assertions.length > 0) {
    return assertions
      .map((a) => a.rationale)
      .filter(Boolean)
      .slice(0, 3)
      .join(" / ");
  }
  return "n/a";
}
