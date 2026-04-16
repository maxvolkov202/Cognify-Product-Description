import { NextResponse } from "next/server";
import { getSkillExcerpt } from "@/lib/ai/knowledge/extract";
import type { SkillDimension } from "@/types/domain";

export const dynamic = "force-dynamic";

const VALID_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "relevance",
  "confidence",
  "pacing",
  "tone",
];

function isValidDimension(s: string): s is SkillDimension {
  return (VALID_DIMENSIONS as readonly string[]).includes(s);
}

/**
 * GET /api/knowledge/[dim]
 * Returns a UI-ready excerpt from the skill's knowledge MD — used by the
 * FeedbackPanel "Why this matters" popover to show users the research
 * behind a scoring callout.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dim: string }> },
) {
  const { dim } = await params;
  if (!isValidDimension(dim)) {
    return NextResponse.json(
      {
        error: "unknown_dimension",
        validDimensions: VALID_DIMENSIONS,
      },
      { status: 400 },
    );
  }

  const excerpt = getSkillExcerpt(dim);
  if (!excerpt) {
    return NextResponse.json(
      { error: "no_knowledge_for_dimension", dimension: dim },
      { status: 404 },
    );
  }

  return NextResponse.json(excerpt, {
    headers: {
      // Knowledge MDs change only on deploy — cache aggressively.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
