/**
 * Phase 6 surface — operator-facing queries for the DB-backed
 * cognify_v2.reference_reps table (the few-shot exemplar bank that
 * retrieveSimilarReps reads at scoring time).
 *
 * Separate from /ops/reference-bank (the JSON calibration source) which
 * lists hand-curated seed reps. This module is the runtime exemplar
 * surface: list + promote-from-rep + demote + edit-notes.
 *
 * Embeddings: promote() embeds the transcript via OpenAI
 * text-embedding-3-small (same model the seed script + retrieve use)
 * before insert. Cost: ~$0.000002 per promotion. Negligible.
 */

import { desc } from "drizzle-orm";
import OpenAI from "openai";
import postgres from "postgres";
import { db } from "@/lib/db/client";
import { referenceReps, reps, dimensionScores } from "@/lib/db/schema";
import { sql as drizzleSql, eq } from "drizzle-orm";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

let _openai: OpenAI | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

function openai(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  _openai = new OpenAI({ apiKey: key, maxRetries: 0 });
  return _openai;
}

function rawSql(): ReturnType<typeof postgres> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  _sql = postgres(url, { prepare: false });
  return _sql;
}

export type ExemplarBankRow = {
  id: string;
  refId: string;
  sourceRepId: string | null;
  transcript: string;
  promptText: string;
  durationMs: number;
  knownScores: Record<string, unknown>;
  knownFeedback: Record<string, unknown> | null;
  tags: Record<string, string>;
  promotedAt: Date;
  promotedBy: string | null;
  notes: string | null;
};

/** List all exemplars, newest promotions first. */
export async function listExemplars(): Promise<ExemplarBankRow[]> {
  const rows = await db
    .select({
      id: referenceReps.id,
      refId: referenceReps.refId,
      sourceRepId: referenceReps.sourceRepId,
      transcript: referenceReps.transcript,
      promptText: referenceReps.promptText,
      durationMs: referenceReps.durationMs,
      knownScores: referenceReps.knownScores,
      knownFeedback: referenceReps.knownFeedback,
      tags: referenceReps.tags,
      promotedAt: referenceReps.promotedAt,
      promotedBy: referenceReps.promotedBy,
      notes: referenceReps.notes,
    })
    .from(referenceReps)
    .orderBy(desc(referenceReps.promotedAt));
  return rows as ExemplarBankRow[];
}

/** Quick aggregate stats for the page header. */
export async function getExemplarBankStats(): Promise<{
  total: number;
  promotedFromReps: number;
  seedReps: number;
}> {
  const rows = await db
    .select({
      total: drizzleSql<number>`count(*)::int`,
      promotedFromReps: drizzleSql<number>`count(*) filter (where ${referenceReps.sourceRepId} is not null)::int`,
      seedReps: drizzleSql<number>`count(*) filter (where ${referenceReps.sourceRepId} is null)::int`,
    })
    .from(referenceReps);
  const r = rows[0];
  return {
    total: r?.total ?? 0,
    promotedFromReps: r?.promotedFromReps ?? 0,
    seedReps: r?.seedReps ?? 0,
  };
}

export type PromoteFromRepInput = {
  repId: string;
  promotedBy: string;
  notes?: string | null;
  /** Optional override band tag — defaults to "promoted". */
  band?: string;
};

/** Promote a real production rep into the exemplar bank.
 *
 *  Reads the rep + its dimension scores, embeds the transcript, then
 *  upserts into reference_reps. ref_id is derived from the rep id with
 *  a "promo-" prefix so it's distinguishable from seed entries.
 *
 *  Idempotent: re-promoting the same rep updates the existing row
 *  instead of duplicating. */
export async function promoteRepToExemplar(
  input: PromoteFromRepInput,
): Promise<{ refId: string; created: boolean }> {
  // Load rep + dim scores.
  const repRow = await db
    .select({
      id: reps.id,
      transcript: reps.transcript,
      durationMs: reps.durationMs,
      promptText: reps.promptText,
      composite: reps.compositeScore,
      modelVersion: reps.modelVersion,
      rubricVersion: reps.rubricVersion,
    })
    .from(reps)
    .where(eq(reps.id, input.repId))
    .limit(1);

  const rep = repRow[0];
  if (!rep) {
    throw new Error(`rep ${input.repId} not found`);
  }
  // reps.transcript is JSONB shaped `{ text: string }` (see server/actions/reps.ts).
  // Extract the string body for embedding + storage on the exemplar row.
  const transcriptText =
    rep.transcript &&
    typeof rep.transcript === "object" &&
    "text" in rep.transcript
      ? ((rep.transcript as { text?: string }).text ?? "")
      : "";
  if (!transcriptText || transcriptText.trim().length < 10) {
    throw new Error("rep has no transcript; cannot promote");
  }

  const dimRows = await db
    .select({
      dimension: dimensionScores.dimension,
      score: dimensionScores.score,
    })
    .from(dimensionScores)
    .where(eq(dimensionScores.repId, input.repId));

  const dimensions: Record<string, number> = {};
  for (const d of dimRows) dimensions[d.dimension] = d.score;

  // Embed the transcript text.
  const trimmed = transcriptText.slice(0, 6000);
  const embResp = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
  });
  const emb = embResp.data[0]?.embedding;
  if (!emb || emb.length !== EMBEDDING_DIMS) {
    throw new Error("embedding produced wrong dimensionality");
  }
  const embStr = `[${emb.join(",")}]`;

  const refId = `promo-${input.repId}`;
  const knownScores = {
    composite: rep.composite,
    dimensions,
    band: input.band ?? "promoted",
  };
  const tags = {
    kind: "promoted",
    band: input.band ?? "promoted",
    model_version: rep.modelVersion ?? "unknown",
    rubric_version: rep.rubricVersion ?? "unknown",
  };
  // Empty for promotions (operator-confirmed scores live in knownScores;
  // feedback shape is undefined until canonical-copy promotion lands).
  const knownFeedback = {};

  // Raw SQL for the vector cast. Drizzle has no first-class vector type
  // so we go through postgres directly here.
  const sql = rawSql();
  const result = await sql<{ created: boolean }[]>`
    INSERT INTO cognify_v2.reference_reps
      (ref_id, source_rep_id, transcript, duration_ms, prompt_text,
       known_scores, known_feedback, tags, embedding, promoted_by, notes)
    VALUES (
      ${refId},
      ${input.repId}::uuid,
      ${transcriptText},
      ${rep.durationMs},
      ${rep.promptText},
      ${sql.json(knownScores)},
      ${sql.json(knownFeedback)},
      ${sql.json(tags)},
      ${embStr}::vector,
      ${input.promotedBy}::uuid,
      ${input.notes ?? null}
    )
    ON CONFLICT (ref_id) DO UPDATE SET
      transcript = EXCLUDED.transcript,
      duration_ms = EXCLUDED.duration_ms,
      prompt_text = EXCLUDED.prompt_text,
      known_scores = EXCLUDED.known_scores,
      tags = EXCLUDED.tags,
      embedding = EXCLUDED.embedding,
      promoted_by = EXCLUDED.promoted_by,
      notes = COALESCE(EXCLUDED.notes, cognify_v2.reference_reps.notes)
    RETURNING (xmax = 0) AS created
  `;
  return { refId, created: result[0]?.created ?? true };
}

/** Demote: delete the row. Soft-delete isn't useful here because the
 *  embedding column doesn't carry the operator's intent — if they
 *  decide a rep shouldn't be an exemplar, removing it is the right
 *  outcome. Re-promotion is cheap if they change their mind. */
export async function demoteExemplar(refId: string): Promise<boolean> {
  const result = await db.execute(
    drizzleSql`DELETE FROM cognify_v2.reference_reps WHERE ref_id = ${refId}`,
  );
  // drizzle's execute returns a result with rowCount on the underlying
  // pg driver; treat any successful query as success (idempotent).
  void result;
  return true;
}

/** Update the notes field. Pass null/empty to clear. */
export async function updateExemplarNotes(
  refId: string,
  notes: string | null,
): Promise<boolean> {
  await db.execute(
    drizzleSql`
      UPDATE cognify_v2.reference_reps
      SET notes = ${notes && notes.trim().length > 0 ? notes.trim() : null}
      WHERE ref_id = ${refId}
    `,
  );
  return true;
}
