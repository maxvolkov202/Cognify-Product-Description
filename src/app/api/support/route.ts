import { NextResponse } from "next/server";
import { z } from "zod";
import { sendSupportRequest } from "@/lib/email/send";
import { rateLimit, getRateLimitIdentifier } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const SupportSchema = z.object({
  fromEmail: z.string().email().max(200),
  fromName: z.string().max(120).optional(),
  topic: z
    .enum(["getting_started", "scoring", "billing", "bug", "feature", "other"])
    .default("other"),
  message: z.string().min(10).max(5000),
  // Honeypot — real users never fill this.
  website: z.string().max(0).optional(),
});

const TOPIC_LABELS: Record<z.infer<typeof SupportSchema>["topic"], string> = {
  getting_started: "Getting started",
  scoring: "Scoring & feedback",
  billing: "Billing",
  bug: "Bug report",
  feature: "Feature request",
  other: "Other",
};

export async function POST(request: Request) {
  const rl = await rateLimit(getRateLimitIdentifier(request), {
    count: 5,
    window: "10 m",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Slow down — try again in a moment." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = SupportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    // Honeypot tripped — pretend it worked so bots don't learn.
    return NextResponse.json({ ok: true });
  }

  const result = await sendSupportRequest({
    fromEmail: parsed.data.fromEmail,
    fromName: parsed.data.fromName ?? null,
    topic: TOPIC_LABELS[parsed.data.topic],
    message: parsed.data.message,
  });

  if (!result.ok && result.reason === "send_failed") {
    return NextResponse.json(
      {
        error: "send_failed",
        message: "Couldn't reach our support inbox. Try again shortly.",
      },
      { status: 502 },
    );
  }

  // If RESEND_API_KEY is missing we still want the UI to succeed in dev —
  // the server-side log captures the request. In prod this branch is
  // impossible because AUTH's welcome email already requires the key.
  return NextResponse.json({ ok: true, delivered: result.ok });
}
