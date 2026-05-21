#!/usr/bin/env node
/**
 * Phase 4 — chunk + embed the knowledge corpus into cognify_v2.knowledge_chunks.
 *
 * Idempotent: chunks already in the DB (matched by source_file + section
 * + content_hash) are skipped. Only new or changed chunks get embedded.
 *
 * Sources:
 *   - skills-full/*.md       (the rich originals for the 4 LLM-scored dims)
 *   - frameworks/*.md        (15 framework cards)
 *   - domains/*.md           (7 domain-specific guidance docs)
 *
 * Chunking strategy: split each markdown file on H2 (`## `) boundaries.
 * Each section becomes one chunk. Chunks under 200 chars get merged
 * into the previous chunk (so single-line sections like "## Definition"
 * with a one-sentence body don't get embedded in isolation).
 *
 * Embedding model: text-embedding-3-small (1536 dims, $0.02 / 1M input).
 * Length-normalized by OpenAI — dot product = cosine similarity.
 *
 * Usage:
 *   node scripts/embed-knowledge.mjs              # embed all + report new
 *   node scripts/embed-knowledge.mjs --dry-run    # show what would change
 *
 * Cost: one-time bulk embed ~$0.001. Per re-run with no changes: $0.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import postgres from "postgres";
import OpenAI from "openai";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_ROOT = resolve(__dirname, "..", "src", "lib", "ai", "knowledge");
const DRY_RUN = process.argv.includes("--dry-run");

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

// Per-kind source directories. Add new kinds here as the corpus grows.
const SOURCES = [
  { kind: "skill", dir: "skills-full" },
  { kind: "framework", dir: "frameworks" },
  { kind: "domain", dir: "domains" },
];

/** Approximate token count from char count. Close enough for budget
 *  purposes without adding a tokenizer dep. The ratio (~4 chars/token)
 *  holds well for English technical prose. */
function approxTokens(text) {
  return Math.ceil(text.length / 4);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Split a markdown file on `## ` headings. Each section becomes one
 *  candidate chunk. Sections shorter than MIN_CHUNK_CHARS are merged
 *  back into the previous chunk so a section like "## Definition" with
 *  a one-liner doesn't get embedded standalone. */
const MIN_CHUNK_CHARS = 200;
const MAX_CHUNK_CHARS = 3200; // ~800 tokens at 4 char/token

function chunkMarkdown(source, kind, topic) {
  const lines = source.split("\n");
  /** @type {Array<{ section: string; content: string }>} */
  const sections = [];
  let currentTitle = "preamble";
  let currentLines = [];

  for (const line of lines) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      // Flush previous section.
      if (currentLines.length > 0) {
        sections.push({
          section: currentTitle,
          content: currentLines.join("\n").trim(),
        });
      }
      currentTitle = h2[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    sections.push({
      section: currentTitle,
      content: currentLines.join("\n").trim(),
    });
  }

  // Drop empty sections (consecutive H2s, etc.)
  const filled = sections.filter((s) => s.content.length > 0);

  // Merge short sections into the previous one. The preamble (everything
  // above the first H2) is typically the H1 + intro line; merge it into
  // the first real section so the H1 context travels with the first chunk.
  const merged = [];
  for (const s of filled) {
    const last = merged[merged.length - 1];
    if (last && (s.content.length < MIN_CHUNK_CHARS || last.content.length < MIN_CHUNK_CHARS)) {
      last.content = `${last.content}\n\n## ${s.section}\n${s.content}`;
      last.section = `${last.section} + ${s.section}`;
      continue;
    }
    merged.push({ ...s });
  }

  // Hard cap on chunk size. If a section blew past MAX_CHUNK_CHARS,
  // emit a warning — manual review needed to split it.
  const out = [];
  for (const s of merged) {
    if (s.content.length > MAX_CHUNK_CHARS) {
      console.warn(
        `[chunker] WARN: ${topic}/${s.section} is ${s.content.length} chars (>${MAX_CHUNK_CHARS}). Truncating; review and split manually.`,
      );
      s.content = s.content.slice(0, MAX_CHUNK_CHARS);
    }
    out.push({
      section: s.section,
      content: s.content,
      tokenCount: approxTokens(s.content),
      tags: {
        kind,
        topic,
        section_slug: s.section.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    });
  }
  return out;
}

/** Walk SOURCES, read every .md file, chunk it, return a flat array of
 *  chunk descriptors ready for embedding. */
function buildAllChunks() {
  const all = [];
  for (const { kind, dir } of SOURCES) {
    const fullDir = join(KNOWLEDGE_ROOT, dir);
    let files;
    try {
      files = readdirSync(fullDir).filter((f) => f.endsWith(".md"));
    } catch (e) {
      console.warn(`[chunker] skipping ${dir}: ${e.message}`);
      continue;
    }
    for (const file of files) {
      // Topic = filename without extension + "-full" suffix stripped.
      const topic = file.replace(/\.md$/, "").replace(/-full$/, "");
      const text = readFileSync(join(fullDir, file), "utf-8");
      const chunks = chunkMarkdown(text, kind, topic);
      for (const c of chunks) {
        all.push({
          source_file: `${dir}/${file}`,
          ...c,
          content_hash: sha256(c.content),
        });
      }
    }
  }
  return all;
}

async function existingHashes(sql) {
  const rows = await sql`
    SELECT source_file, section, content_hash
    FROM cognify_v2.knowledge_chunks
  `;
  const set = new Set();
  for (const r of rows) set.add(`${r.source_file}|${r.section}|${r.content_hash}`);
  return set;
}

async function embedBatch(openai, texts) {
  const resp = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error("OPENAI_API_KEY not set");
    process.exit(1);
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    console.log(`[embed-knowledge] reading sources from ${KNOWLEDGE_ROOT}`);
    const chunks = buildAllChunks();
    console.log(`[embed-knowledge] built ${chunks.length} chunks across ${SOURCES.length} kinds`);

    const existing = await existingHashes(sql);
    const newChunks = chunks.filter(
      (c) => !existing.has(`${c.source_file}|${c.section}|${c.content_hash}`),
    );
    console.log(`[embed-knowledge] ${newChunks.length} new/changed chunks (${chunks.length - newChunks.length} unchanged, skipped)`);

    if (DRY_RUN) {
      console.log("[embed-knowledge] --dry-run: showing first 5 new chunks");
      for (const c of newChunks.slice(0, 5)) {
        console.log(`  ${c.source_file} | ${c.section} | tokens=${c.tokenCount} | hash=${c.content_hash.slice(0, 8)}`);
      }
      console.log(`[embed-knowledge] dry-run complete; nothing written.`);
      return;
    }

    if (newChunks.length === 0) {
      console.log("[embed-knowledge] nothing to do — all chunks already embedded.");
      return;
    }

    // Batch in groups of 50 to keep request size sane.
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < newChunks.length; i += BATCH) {
      const batch = newChunks.slice(i, i + BATCH);
      console.log(`[embed-knowledge] embedding batch ${i / BATCH + 1} (${batch.length} chunks)...`);
      const embeddings = await embedBatch(openai, batch.map((c) => c.content));
      if (embeddings.length !== batch.length) {
        throw new Error(`embedding count mismatch: got ${embeddings.length} expected ${batch.length}`);
      }
      // Insert one at a time — postgres-js doesn't have great vector
      // bulk-insert support; the per-chunk overhead is small and runs
      // for less than 1 minute total for the whole corpus.
      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        const emb = embeddings[j];
        if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIMS) {
          throw new Error(`bad embedding dims for ${c.source_file}/${c.section}: got ${emb?.length}`);
        }
        // pgvector accepts the canonical "[1.0, 2.0, ...]" string format.
        const embStr = `[${emb.join(",")}]`;
        await sql`
          INSERT INTO cognify_v2.knowledge_chunks
            (source_file, section, content, token_count, tags, embedding, content_hash)
          VALUES
            (${c.source_file}, ${c.section}, ${c.content}, ${c.tokenCount},
             ${sql.json(c.tags)}, ${embStr}::vector, ${c.content_hash})
          ON CONFLICT (source_file, section, content_hash) DO NOTHING
        `;
        inserted += 1;
      }
    }
    console.log(`[embed-knowledge] inserted ${inserted} chunks.`);

    // Print summary by kind.
    const summary = await sql`
      SELECT tags->>'kind' AS kind, COUNT(*)::int AS n,
             SUM(token_count)::int AS total_tokens
      FROM cognify_v2.knowledge_chunks
      GROUP BY tags->>'kind'
      ORDER BY tags->>'kind'
    `;
    console.log("[embed-knowledge] corpus summary:");
    for (const row of summary) {
      console.log(`  ${row.kind.padEnd(12)} ${String(row.n).padStart(4)} chunks  ${String(row.total_tokens).padStart(6)} tokens`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[embed-knowledge] fatal:", err);
  process.exit(1);
});
