// Phase 4 (Edit #1) — image context uploads for Build a Rep.
//
// Users prep from photos: a printed job posting, a slide, a whiteboard,
// an event schedule. We turn the image into TEXT once at upload time
// (same contract as pdf/docx parsing: best-effort, capped, never blocks
// the flow) so the rest of the pipeline stays text-only.
//
// Uses OpenAI vision directly (the shared claude.ts facade is text-only
// by design; a one-shot image→text extraction doesn't need the
// provider-fallback machinery). Failure of any kind returns null and
// the upload records parse_status="failed".

import { VISION_IMAGE_MIMES } from "@/lib/prep/parse-constants";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";
const VISION_TIMEOUT_MS = 25_000;
const VISION_MAX_TOKENS = 900;

// Single source of truth lives in src/lib/prep/parse.ts.
const SUPPORTED_IMAGE_MIME = new Set<string>(VISION_IMAGE_MIMES);

/**
 * Extract prep-relevant text from an uploaded image. Returns plain text
 * (legible text transcribed + a short description of prep-relevant
 * content) or null on any failure.
 */
export async function extractImageContextText(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !SUPPORTED_IMAGE_MIME.has(mimeType)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: VISION_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This image was uploaded as context for preparing a communication event (interview, presentation, pitch, meeting). Transcribe ALL legible text in it, then add a one-paragraph description of anything else relevant to event preparation (what the document/slide/photo is, names, dates, numbers). Plain text only, no markdown, no commentary about image quality.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${buffer.toString("base64")}`,
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
