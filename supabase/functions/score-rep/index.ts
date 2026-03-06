import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://deno.land/x/openai@v4.24.0/mod.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let repId: string | undefined

  try {
    const body = await req.json()
    repId = body?.repId

    if (!repId) {
      return new Response(
        JSON.stringify({ error: "Missing repId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: rep, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("id", repId)
      .single()

    if (repError || !rep) {
      return new Response(
        JSON.stringify({ error: "Rep not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    if (rep.status !== "pending") {
      return new Response(
        JSON.stringify({ message: "Rep already processed or processing" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const { data: claimed, error: claimError } = await supabase
      .from("reps")
      .update({ status: "processing" })
      .eq("id", repId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle()

    if (claimError || !claimed) {
      return new Response(
        JSON.stringify({ message: "Rep already processed or processing" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    try {
      if (!rep.audio_url) {
        throw new Error("Missing audio_url")
      }

      const raw = rep.audio_url as string
      const filePath = raw.startsWith("http")
        ? (() => {
            const url = new URL(raw)
            const pathAfterBucket = url.pathname.split("/rep-audio/")[1]
            return pathAfterBucket ? pathAfterBucket.split("?")[0] : null
          })()
        : raw

      if (!filePath) {
        throw new Error("Invalid audio_url path")
      }

      const { data: audioFile, error: downloadError } =
        await supabase.storage.from("rep-audio").download(filePath)

      if (downloadError || !audioFile) {
        throw new Error("Audio download failed")
      }

      const audioBuffer = await audioFile.arrayBuffer()
      const file = new File(
        [audioBuffer],
        "recording.webm",
        { type: "audio/webm" }
      )

      const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! })

      console.log("[score-rep] Before Whisper transcription", { repId })
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
      })
      console.log("[score-rep] After Whisper transcription", { repId })

      const transcript = transcription.text ?? ""
      const transcriptWordCount = transcript.trim().split(/\s+/).filter(Boolean).length

      const vertical = rep.vertical ?? ""
      const scenario = rep.scenario ?? ""
      const audience = rep.audience ?? ""
      const framework = rep.framework ?? ""

      const systemPrompt = `You are an expert evaluator of executive communication.

Score the speaker using this rubric.

DELIVERY (0–100)
- pace: speaking speed appropriate for clarity
- clarity: articulation and intelligibility
- filler_words: frequency of "um", "uh", "like"
- confidence: certainty and authority
- pauses: effective pauses instead of filler words
- tone: professional and engaging vocal tone

CONTENT (0–100)
- clarity: clear main message
- structure: logical progression of ideas
- brevity: concise communication without rambling
- confidence: decisive recommendation

Scoring guidelines:
90–100 = exceptional executive communication
70–89 = strong but improvable
50–69 = average
below 50 = weak communication

Return STRICT JSON only.

JSON structure:
{
  "overall_score": number,
  "delivery": {
    "pace": number,
    "clarity": number,
    "filler_words": number,
    "confidence": number,
    "pauses": number,
    "tone": number,
    "overall_delivery": number
  },
  "content": {
    "clarity": number,
    "structure": number,
    "brevity": number,
    "confidence": number
  }
}`

      console.log("[score-rep] Before GPT scoring call", { repId })
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `
Vertical: ${vertical}
Scenario: ${scenario}
Audience: ${audience}
Framework: ${framework}

Transcript:
${transcript}
`,
          },
        ],
        response_format: { type: "json_object" },
      })
      console.log("[score-rep] After GPT scoring call", { repId })

      const contentText = chatResponse.choices[0]?.message?.content
      if (!contentText) {
        throw new Error("GPT returned empty content")
      }

      let scores: {
        overall_score: number
        delivery: {
          pace: number
          clarity: number
          filler_words: number
          confidence: number
          pauses: number
          tone: number
          overall_delivery: number
        }
        content: {
          clarity: number
          structure: number
          brevity: number
          confidence: number
        }
      }

      console.log("[score-rep] Before JSON parse", { repId })
      try {
        scores = JSON.parse(contentText) as typeof scores
      } catch {
        throw new Error("GPT response is not valid JSON")
      }
      console.log("[score-rep] After JSON parse", { repId })

      const delivery = scores.delivery ?? {}
      const content = scores.content ?? {}
      const deliveryScore = Number(delivery.overall_delivery) || 0
      const contentClarity = Number(content.clarity) || 0
      const contentStructure = Number(content.structure) || 0
      const contentBrevity = Number(content.brevity) || 0
      const contentConfidence = Number(content.confidence) || 0
      const contentScore =
        (contentClarity + contentStructure + contentBrevity + contentConfidence) / 4

      const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0)
      const overallScore = num(scores.overall_score)
      const finalContentScore = Math.round(contentScore * 100) / 100

      const diagnosisPrompt = `You are analyzing executive communication.

Identify the primary communication issue in the transcript.

Return JSON:

{
  "primary_issue": "short description",
  "evidence": "specific quote or behavior from transcript",
  "impact": "why this weakens the communication",
  "recommended_focus": "the highest-leverage improvement"
}

Focus on the single most important issue.`

      const diagnosisResponse = await openai.chat.completions.create({
        model: "gpt-4.1",
        temperature: 0.2,
        messages: [
          { role: "system", content: diagnosisPrompt },
          {
            role: "user",
            content: `
Vertical: ${vertical}
Scenario: ${scenario}
Audience: ${audience}
Framework: ${framework}

Transcript:
${transcript}
`,
          },
        ],
        response_format: { type: "json_object" },
      })

      const diagnosisText = diagnosisResponse.choices[0]?.message?.content

      let diagnosis: {
        primary_issue?: string
        evidence?: string
        impact?: string
        recommended_focus?: string
      } | null = null

      if (diagnosisText) {
        try {
          diagnosis = JSON.parse(diagnosisText)
        } catch {
          diagnosis = null
        }
      }

      let feedbackGood: string | null = null
      let feedbackImprove: string | null = null
      let nextFocus: string | null = null

      const coachingSystemPrompt = `You are an elite executive communication coach.

Your goal is to help the speaker improve ONE skill per rep.

Training philosophy:
• Improvement comes from focusing on ONE change at a time.
• Choose the highest-leverage improvement.
• Be concrete and actionable.

Context:
Vertical: ${vertical}
Scenario: ${scenario}
Audience: ${audience}
Framework: ${framework}

Scores:
Overall: ${overallScore}
Delivery: ${deliveryScore}
Content: ${finalContentScore}

Diagnosis:
Primary Issue: ${diagnosis?.primary_issue ?? "unknown"}
Evidence: ${diagnosis?.evidence ?? "unknown"}
Impact: ${diagnosis?.impact ?? "unknown"}
Recommended Focus: ${diagnosis?.recommended_focus ?? "unknown"}

Transcript:
${transcript}

Instructions:

1. Identify what the speaker did well.
2. Identify the single biggest improvement opportunity.
3. Provide one clear instruction for the next rep.

Focus rules:
• Choose ONE improvement only.
• Prefer behaviors that can be practiced immediately.
• Avoid generic advice.

Examples:

Example 1
feedback_good: Clear recommendation and confident tone.
feedback_improve: The answer rambles before reaching the main point.
next_focus: State your recommendation in the first sentence.

Example 2
feedback_good: You explained the idea clearly and logically.
feedback_improve: Frequent filler words reduce authority.
next_focus: Pause instead of saying "um" or "uh".

Return STRICT JSON only.

{
  "feedback_good": "1–2 sentences",
  "feedback_improve": "1–2 sentences",
  "next_focus": "ONE clear instruction"
}`

      console.log("[score-rep] Before GPT coaching call", { repId })
      try {
        const coachingResponse = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: coachingSystemPrompt },
            { role: "user", content: "Generate the feedback JSON." },
          ],
          response_format: { type: "json_object" },
        })
        const coachingText = coachingResponse.choices[0]?.message?.content
        if (coachingText) {
          const parsed = JSON.parse(coachingText) as {
            feedback_good?: string | null
            feedback_improve?: string | null
            next_focus?: string | null
          }
          feedbackGood =
            typeof parsed.feedback_good === "string" ? parsed.feedback_good : null
          feedbackImprove =
            typeof parsed.feedback_improve === "string" ? parsed.feedback_improve : null
          nextFocus =
            typeof parsed.next_focus === "string" ? parsed.next_focus : null
        }
      } catch (coachingErr) {
        console.warn("[score-rep] Coaching JSON parse or call failed, using nulls", coachingErr)
        feedbackGood = null
        feedbackImprove = null
        nextFocus = null
      }
      console.log("[score-rep] After GPT coaching call", { repId })

      console.log("[score-rep] Before rep update", { repId })
      const { error: repUpdateError } = await supabase
        .from("reps")
        .update({
          transcript,
          transcript_word_count: transcriptWordCount,
          overall_score: overallScore,
          delivery_score: deliveryScore,
          content_score: finalContentScore,
          status: "completed",
          feedback_good: feedbackGood,
          feedback_improve: feedbackImprove,
          next_focus: nextFocus,
        })
        .eq("id", repId)
      if (repUpdateError) {
        throw new Error(`Rep update failed: ${repUpdateError.message}`)
      }
      console.log("[score-rep] After rep update", { repId })

      console.log("[score-rep] Before delivery_scores upsert", { repId })
      const { error: deliveryUpsertError } = await supabase
        .from("delivery_scores")
        .upsert(
          {
            rep_id: repId,
            pace: num(delivery.pace),
            clarity: num(delivery.clarity),
            filler_words: num(delivery.filler_words),
            confidence: num(delivery.confidence),
            pauses: num(delivery.pauses),
            tone: num(delivery.tone),
            overall_delivery: deliveryScore,
          },
          { onConflict: "rep_id" }
        )
      if (deliveryUpsertError) {
        throw new Error(`delivery_scores upsert failed: ${deliveryUpsertError.message}`)
      }
      console.log("[score-rep] After delivery_scores upsert", { repId })

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    } catch (processingErr) {
      console.error("[score-rep] Error after processing started:", processingErr)

      try {
        await supabase
          .from("reps")
          .update({ status: "failed" })
          .eq("id", repId)
      } catch (updateErr) {
        console.error("[score-rep] Failed to set rep status to failed:", updateErr)
      }

      return new Response(
        JSON.stringify({ error: "Internal Server Error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
  } catch (err) {
    console.error("[score-rep] Outer error (before or without processing):", err)

    if (repId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        )
        await supabase
          .from("reps")
          .update({ status: "failed" })
          .eq("id", repId)
      } catch (updateErr) {
        console.error("[score-rep] Failed to set rep status to failed:", updateErr)
      }
    }

    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
