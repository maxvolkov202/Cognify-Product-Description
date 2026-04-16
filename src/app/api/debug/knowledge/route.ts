import { NextResponse } from "next/server";
import {
  resolveKnowledge,
  renderBlocks,
  loadFrameworks,
  loadSkills,
  loadDomains,
  loadPatterns,
  type KnowledgeQuery,
} from "@/lib/ai/knowledge";

/**
 * Debug route for inspecting what the knowledge loader would return
 * for a given pipeline stage. Used during development to verify new
 * knowledge files are loading correctly without triggering the full
 * Claude pipeline.
 *
 * Examples:
 *   GET /api/debug/knowledge                              — catalog of all loaded files
 *   GET /api/debug/knowledge?stage=score_skill&skill=clarity
 *   GET /api/debug/knowledge?stage=framework_gen&domainHint=cold-calling
 *   GET /api/debug/knowledge?stage=callout_compose
 *   GET /api/debug/knowledge?stage=prompt_gen&domainHint=tough-feedback
 *
 * Response shape:
 *   {
 *     stage: "…",
 *     blocks: [{ id, category, contentLength, preview }],
 *     renderedLength: number,
 *     rendered: "…"    // only when ?full=1
 *   }
 */
export const dynamic = "force-dynamic";


const VALID_STAGES = [
  "framework_gen",
  "score_skill",
  "callout_compose",
  "prompt_gen",
] as const;
type ValidStage = (typeof VALID_STAGES)[number];

function isValidStage(s: string): s is ValidStage {
  return (VALID_STAGES as readonly string[]).includes(s);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage");
  const full = url.searchParams.get("full") === "1";

  // No stage → return the full catalog
  if (!stage) {
    const catalog = {
      frameworks: loadFrameworks().map((b) => ({
        id: b.id,
        contentLength: b.content.length,
      })),
      skills: loadSkills().map((b) => ({
        id: b.id,
        contentLength: b.content.length,
      })),
      domains: loadDomains().map((b) => ({
        id: b.id,
        contentLength: b.content.length,
      })),
      patterns: loadPatterns().map((b) => ({
        id: b.id,
        contentLength: b.content.length,
      })),
    };
    const totalFiles =
      catalog.frameworks.length +
      catalog.skills.length +
      catalog.domains.length +
      catalog.patterns.length;
    const totalBytes =
      catalog.frameworks.reduce((a, b) => a + b.contentLength, 0) +
      catalog.skills.reduce((a, b) => a + b.contentLength, 0) +
      catalog.domains.reduce((a, b) => a + b.contentLength, 0) +
      catalog.patterns.reduce((a, b) => a + b.contentLength, 0);
    return NextResponse.json({
      mode: "catalog",
      totals: { files: totalFiles, bytes: totalBytes },
      catalog,
      usage: {
        stages: VALID_STAGES,
        examples: [
          "/api/debug/knowledge?stage=score_skill&skill=clarity",
          "/api/debug/knowledge?stage=framework_gen&domainHint=cold-calling",
          "/api/debug/knowledge?stage=callout_compose",
          "/api/debug/knowledge?stage=prompt_gen&domainHint=tough-feedback",
          "/api/debug/knowledge?stage=score_skill&skill=clarity&full=1",
        ],
      },
    });
  }

  if (!isValidStage(stage)) {
    return NextResponse.json(
      {
        error: "invalid_stage",
        message: `Unknown stage '${stage}'. Valid stages: ${VALID_STAGES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  let query: KnowledgeQuery;
  switch (stage) {
    case "framework_gen": {
      const domainHint = url.searchParams.get("domainHint") ?? undefined;
      query = { stage, domainHint };
      break;
    }
    case "score_skill": {
      const skill = url.searchParams.get("skill");
      if (!skill) {
        return NextResponse.json(
          {
            error: "missing_skill",
            message: "stage=score_skill requires ?skill=<dimension>",
          },
          { status: 400 },
        );
      }
      query = { stage, skill };
      break;
    }
    case "callout_compose": {
      query = { stage };
      break;
    }
    case "prompt_gen": {
      const domainHint = url.searchParams.get("domainHint") ?? undefined;
      query = { stage, domainHint };
      break;
    }
  }

  const blocks = resolveKnowledge(query);
  const rendered = renderBlocks(blocks);

  return NextResponse.json({
    mode: "resolve",
    query,
    blocks: blocks.map((b) => ({
      id: b.id,
      category: b.category,
      contentLength: b.content.length,
      preview: b.content.slice(0, 160).replace(/\s+/g, " ") + "…",
    })),
    renderedLength: rendered.length,
    ...(full ? { rendered } : {}),
  });
}
