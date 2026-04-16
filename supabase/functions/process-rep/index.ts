// Supabase Edge Function: process-rep
// Runs in Deno, triggered by the frontend after insertPendingRep returns.
// Orchestrates: claim rep → transcribe (Deepgram REST) → invoke Next.js
// internal scoring endpoint → write results → flip status.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY")!;
const INTERNAL_API_URL = Deno.env.get("INTERNAL_API_URL")!; // e.g. https://cognifygym.com or http://host.docker.internal:3333 for local
const INTERNAL_SCORING_SECRET = Deno.env.get("INTERNAL_SCORING_SECRET")!;

const SIGNED_URL_TTL_SECONDS = 300;

type ProcessBody = { repId: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "cognify_v2" },
  });

  let repId: string;
  try {
    const body = (await req.json()) as ProcessBody;
    repId = body.repId;
    if (!repId) throw new Error("repId required");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "bad_request", message: String(e) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // 1. Claim the rep (optimistic lock — only succeeds if status='pending')
  const { data: claimed, error: claimErr } = await admin
    .from("reps")
    .update({ status: "processing" })
    .eq("id", repId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (claimErr || !claimed) {
    return new Response(
      JSON.stringify({
        error: "not_claimable",
        message: claimErr?.message ?? "rep not in pending state",
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }

  try {
    // 2. Extract transcript text. The insertPendingRep action puts the raw
    //    transcript in reps.transcript.text (Deepgram transcription already
    //    happened client-side before insertPendingRep). If a frame had to
    //    retranscribe, it would happen here via Deepgram REST — skipped for
    //    now since we're already getting transcripts from the Next.js flow.
    const transcript = (claimed.transcript as { text?: string } | null)?.text ?? "";
    const snapshot = (claimed.framework_snapshot as Record<string, unknown> | null) ?? {};
    const frameworkNodes = (snapshot["nodes"] as Array<{ label: string; description: string }> | undefined);
    const frameworkId = snapshot["id"] as string | undefined;
    const timeBudgetMs = snapshot["timeBudgetMs"] as number | undefined;
    const words = snapshot["words"] as Array<{ word: string; startMs: number; endMs: number }> | undefined;

    // 3. Call back into Next.js for the actual Claude scoring. The internal
    //    endpoint handles knowledge base, rubric, and writes dimension_scores
    //    + callouts + progress_snapshots.
    const scoreRes = await fetch(`${INTERNAL_API_URL}/api/score-internal`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": INTERNAL_SCORING_SECRET,
      },
      body: JSON.stringify({
        repId,
        transcript,
        promptText: claimed.prompt_text,
        durationMs: claimed.duration_ms,
        timeBudgetMs,
        frameworkId,
        frameworkNodes,
        words,
      }),
    });

    if (!scoreRes.ok) {
      const text = await scoreRes.text().catch(() => "");
      throw new Error(`scoring endpoint returned ${scoreRes.status}: ${text.slice(0, 200)}`);
    }

    const { score } = (await scoreRes.json()) as {
      score: { composite: number; modelVersion: string; rubricVersion: string };
    };

    // 4. Finalize the rep row — composite score + model/rubric versions,
    //    flip status to completed. dimension_scores and callouts were
    //    already inserted by /api/score-internal.
    await admin
      .from("reps")
      .update({
        status: "completed",
        composite_score: score.composite,
        model_version: score.modelVersion,
        rubric_version: score.rubricVersion,
      })
      .eq("id", repId);

    return new Response(
      JSON.stringify({ status: "completed", composite: score.composite }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    // Flag the rep as failed so the client UI can show a retry option.
    await admin.from("reps").update({ status: "failed" }).eq("id", repId);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[process-rep] failed", message);
    return new Response(
      JSON.stringify({ status: "failed", error: message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
