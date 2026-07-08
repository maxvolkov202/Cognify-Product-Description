import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeProgression,
  fallbackProgression,
  type ProgressionInput,
} from "@/lib/ai/progression";
import { rateLimit } from "@/lib/ratelimit";
import { currentUser } from "@/lib/session/current-user";
import { shouldHardFailOnMissingKey, warnMissingKey } from "@/lib/env";
import { log, serializeErr } from "@/lib/log";

export const runtime = "nodejs";
export const maxDuration = 25;

const dimensionEnum = z.enum([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
]);

const repSummarySchema = z.object({
  composite: z.number().min(0).max(100),
  dimensions: z
    .array(
      z.object({
        dimension: dimensionEnum,
        score: z.number().min(0).max(100),
      }),
    )
    .length(6),
  topWeakness: z
    .object({
      dimension: z.enum([
        "clarity",
        "structure",
        "conciseness",
        "thinking_quality",
        "delivery",
        "tone",
        "structural_adherence",
      ]),
      title: z.string().max(200),
      body: z.string().max(500),
      quote: z.string().max(500).nullable(),
      suggestedRewrite: z.string().max(500).nullable(),
    })
    .nullable(),
  transcript: z.string().min(1).max(10000),
});

const bodySchema = z.object({
  previous: repSummarySchema,
  current: repSummarySchema,
  promptText: z.string().min(1).max(600),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in to use this endpoint." },
      { status: 401 },
    );
  }
  const rl = await rateLimit(`user:${user.id}:progression`, {
    count: 20,
    window: "1 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many comparison requests." },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json();
    parsed = bodySchema.parse(raw);
  } catch (err) {
    const zodIssues =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : (err as Error)?.message;
    return NextResponse.json(
      { error: "invalid_body", message: zodIssues ?? "Bad request" },
      { status: 400 },
    );
  }

  const input: ProgressionInput = parsed;

  // Phase 14 — provider-agnostic gate: EITHER configured provider can
  // serve this analysis (the shim resolves primary/fallback).
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    if (shouldHardFailOnMissingKey()) {
      log.error({
        event: "progression.missing_key",
        msg: "No AI provider key configured in production",
      });
      return NextResponse.json(
        {
          error: "missing_key",
          message:
            "Progression analysis is unavailable — no AI provider key (ANTHROPIC_API_KEY or OPENAI_API_KEY) is configured on this deployment.",
        },
        { status: 503 },
      );
    }
    warnMissingKey("ANTHROPIC_API_KEY or OPENAI_API_KEY");
    return NextResponse.json(fallbackProgression(input));
  }

  try {
    const result = await analyzeProgression(input);
    return NextResponse.json(result);
  } catch (err) {
    log.error({
      event: "progression.claude_failed",
      err: serializeErr(err),
    });
    return NextResponse.json(fallbackProgression(input));
  }
}
