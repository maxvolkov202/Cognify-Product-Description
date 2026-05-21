#!/usr/bin/env node
/**
 * Phase 6 — seed reference_reps from scripts/calibration/reference-reps.json.
 *
 * Reads the 48 hand-calibrated reference reps, embeds each transcript
 * via OpenAI text-embedding-3-small (same model as knowledge_chunks),
 * upserts into cognify_v2.reference_reps keyed by ref_id.
 *
 * Idempotent: re-running skips rows whose ref_id + transcript hash
 * already exist. New reps in the JSON file get added; transcripts that
 * change get re-embedded and updated.
 *
 * Usage:
 *   node scripts/seed-reference-reps.mjs
 *   node scripts/seed-reference-reps.mjs --dry-run
 *
 * Cost: ~$0.0003 for the full 48-rep bulk embed. Negligible.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import postgres from "postgres";
import OpenAI from "openai";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REF_PATH = resolve(__dirname, "calibration", "reference-reps.json");
const DRY_RUN = process.argv.includes("--dry-run");

const EMBEDDING_MODEL = "text-embedding-3-small";

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function buildTags(rep) {
  return {
    kind: rep.kind, // 'band' | 'independence'
    band: rep.expected?.band ?? null,
    // Heuristic dim profile: which dim is the highest, which is the
    // lowest. Lets retrieval optionally bias toward reps with the
    // same shape as the rep being scored.
    ...(rep.expected?.dimensions
      ? (() => {
          const entries = Object.entries(rep.expected.dimensions);
          entries.sort((a, b) => b[1] - a[1]);
          return {
            top_dim: entries[0]?.[0],
            bottom_dim: entries[entries.length - 1]?.[0],
          };
        })()
      : {}),
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!dbUrl || !openaiKey) {
    console.error("DATABASE_URL and OPENAI_API_KEY required");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const bank = JSON.parse(readFileSync(REF_PATH, "utf-8"));
    const reps = bank.reps;
    console.log(`[seed-reference-reps] loaded ${reps.length} reps from ${REF_PATH}`);

    // Pull existing ref_ids + transcript hashes so we can skip unchanged
    // entries. notes column doubles as the transcript hash storage so
    // we don't need an extra column. (Slightly hacky but the notes
    // column is otherwise unused in seed entries.)
    const existing = await sql`
      SELECT ref_id, notes FROM cognify_v2.reference_reps
    `;
    const existingMap = new Map();
    for (const r of existing) existingMap.set(r.ref_id, r.notes);

    const toEmbed = [];
    for (const rep of reps) {
      const transcriptHash = sha256(rep.transcript);
      const cachedHash = existingMap.get(rep.id);
      if (cachedHash === transcriptHash) continue; // already up to date
      toEmbed.push({ ...rep, transcriptHash });
    }

    console.log(`[seed-reference-reps] ${toEmbed.length} new/changed reps (${reps.length - toEmbed.length} unchanged)`);

    if (DRY_RUN) {
      console.log("[seed-reference-reps] --dry-run; would embed:");
      for (const r of toEmbed.slice(0, 5)) {
        console.log(`  ${r.id} (${r.kind}, ${r.transcript.length} chars)`);
      }
      return;
    }

    if (toEmbed.length === 0) {
      console.log("[seed-reference-reps] nothing to do.");
      return;
    }

    // Batch embed. Reference transcripts are short (~10-60s of speech)
    // so a single batch covers all 48 comfortably.
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < toEmbed.length; i += BATCH) {
      const batch = toEmbed.slice(i, i + BATCH);
      console.log(`[seed-reference-reps] embedding batch ${i / BATCH + 1} (${batch.length})...`);
      const resp = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map((r) => r.transcript),
      });

      for (let j = 0; j < batch.length; j++) {
        const rep = batch[j];
        const emb = resp.data[j]?.embedding;
        if (!emb || emb.length !== 1536) {
          console.warn(`[seed-reference-reps] bad embedding for ${rep.id}; skipping`);
          continue;
        }
        const embStr = `[${emb.join(",")}]`;
        const tags = buildTags(rep);

        // Upsert: insert or update on ref_id conflict. notes carries
        // the transcript hash so re-runs can skip unchanged entries.
        await sql`
          INSERT INTO cognify_v2.reference_reps
            (ref_id, transcript, duration_ms, prompt_text,
             known_scores, known_feedback, tags, embedding, notes)
          VALUES (
            ${rep.id},
            ${rep.transcript},
            ${rep.durationMs},
            ${rep.promptText},
            ${sql.json(rep.expected ?? {})},
            ${sql.json(rep.assertions ? { assertions: rep.assertions } : {})},
            ${sql.json(tags)},
            ${embStr}::vector,
            ${rep.transcriptHash}
          )
          ON CONFLICT (ref_id) DO UPDATE SET
            transcript = EXCLUDED.transcript,
            duration_ms = EXCLUDED.duration_ms,
            prompt_text = EXCLUDED.prompt_text,
            known_scores = EXCLUDED.known_scores,
            known_feedback = EXCLUDED.known_feedback,
            tags = EXCLUDED.tags,
            embedding = EXCLUDED.embedding,
            notes = EXCLUDED.notes
        `;
        inserted += 1;
      }
    }

    console.log(`[seed-reference-reps] upserted ${inserted} reps.`);

    const summary = await sql`
      SELECT tags->>'kind' as kind, COUNT(*)::int as n
      FROM cognify_v2.reference_reps
      GROUP BY tags->>'kind'
      ORDER BY tags->>'kind'
    `;
    console.log("[seed-reference-reps] bank summary:");
    for (const row of summary) console.log(`  ${row.kind.padEnd(15)} ${row.n}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[seed-reference-reps] fatal:", err);
  process.exit(1);
});
