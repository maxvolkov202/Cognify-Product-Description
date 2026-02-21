import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import OpenAI from "https://esm.sh/openai@4.28.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { repId } = await req.json()

    if (!repId) {
      return new Response("Missing repId", {
        status: 400,
        headers: corsHeaders,
      })
    }

    // ✅ Use service role client only
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    })

    // Fetch rep
    const { data: rep, error: repError } = await supabase
      .from("reps")
      .select("*")
      .eq("id", repId)
      .single()

    if (repError || !rep) {
      return new Response("Rep not found", {
        status: 404,
        headers: corsHeaders,
      })
    }

    await supabase
      .from("reps")
      .update({ status: "processing" })
      .eq("id", repId)

    if (!rep.audio_url) {
      throw new Error("Missing audio_url")
    }

    const url = new URL(rep.audio_url)
    const filePath = url.pathname.split("/rep-audio/")[1]

    const { data: audioFile, error: downloadError } =
      await supabase.storage.from("rep-audio").download(filePath)

    if (downloadError || !audioFile) {
      throw new Error("Audio download failed")
    }

  // Convert blob to File for OpenAI
const audioBuffer = await audioFile.arrayBuffer()

const file = new File(
  [audioBuffer],
  "recording.webm",
  { type: "audio/webm" }
)

const transcriptResponse = await openai.audio.transcriptions.create({
  file,
  model: "whisper-1",
})

    const transcript = transcriptResponse.text

    // Scoring
    const scoringResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Return ONLY valid JSON:

{
  "overall_score": number,
  "delivery_score": number,
  "content_score": number,
  "delivery_breakdown": {
    "pace": number,
    "clarity": number,
    "filler_words": number,
    "confidence": number,
    "pauses": number,
    "tone": number,
    "overall_delivery": number
  }
}
`,
        },
        { role: "user", content: transcript },
      ],
    })

    const scores = JSON.parse(
      scoringResponse.choices[0].message.content!
    )

    await supabase.from("reps").update({
      transcript,
      transcript_word_count: transcript.trim().split(/\s+/).length,
      overall_score: scores.overall_score,
      delivery_score: scores.delivery_score,
      content_score: scores.content_score,
      status: "complete",
    }).eq("id", repId)

    await supabase.from("delivery_scores").update({
      pace: scores.delivery_breakdown.pace,
      clarity: scores.delivery_breakdown.clarity,
      filler_words: scores.delivery_breakdown.filler_words,
      confidence: scores.delivery_breakdown.confidence,
      pauses: scores.delivery_breakdown.pauses,
      tone: scores.delivery_breakdown.tone,
      overall_delivery: scores.delivery_breakdown.overall_delivery,
    }).eq("rep_id", repId)

    return new Response(JSON.stringify(scores), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })

  } catch (err) {
    console.error("Edge error:", err)
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    })
  }
})
