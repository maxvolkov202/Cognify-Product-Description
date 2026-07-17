// PRD v3 Phase 5 — Build a Rep context-upload parsing (PRD §7.4).
//
// Uploads are optional; parsing is best-effort. A failed parse never
// blocks the preparation flow — the event just personalizes less.
// Raw files land in Supabase Storage; only the extracted text (capped)
// is injected into Preparation Plan / coaching generation.

// Client-safe constants + the ParseResult type live in ./parse-constants
// (no node: imports) so client components can import them without dragging
// this module's node-only document extractors into the browser bundle.
// Re-exported here so existing server-side `@/lib/prep/parse` imports keep
// working unchanged.
export {
  PREP_PARSED_TEXT_CAP,
  PREP_UPLOAD_MAX_BYTES,
  PREP_ACCEPTED_EXTENSIONS,
  PREP_ACCEPT_ATTR,
  IMAGE_MIME_BY_EXT,
  VISION_IMAGE_MIMES,
} from "./parse-constants";
export type { ParseResult } from "./parse-constants";

import {
  PREP_PARSED_TEXT_CAP,
  IMAGE_MIME_BY_EXT,
  VISION_IMAGE_MIMES,
} from "./parse-constants";
import type { ParseResult } from "./parse-constants";

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, PREP_PARSED_TEXT_CAP);
}

/** Extract plain text from an uploaded context document. Dispatches on
 *  mime type first, file extension as fallback (browsers are sloppy
 *  about docx/md mime types). */
export async function parseContextFile(
  buffer: Buffer,
  mimeType: string | null,
  fileName: string,
): Promise<ParseResult> {
  const lower = fileName.toLowerCase();
  const kind = detectKind(mimeType, lower);
  try {
    switch (kind) {
      case "pdf": {
        const { extractText, getDocumentProxy } = await import("unpdf");
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { text } = await extractText(pdf, { mergePages: true });
        const normalized = normalize(
          Array.isArray(text) ? text.join("\n") : text,
        );
        return normalized.length > 0
          ? { status: "parsed", text: normalized }
          : { status: "failed", text: null };
      }
      case "docx": {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        const normalized = normalize(result.value ?? "");
        return normalized.length > 0
          ? { status: "parsed", text: normalized }
          : { status: "failed", text: null };
      }
      case "pptx": {
        // Phase 11.E3 — zero-dependency zip/XML extraction (slides +
        // speaker notes). Malformed decks throw -> "failed" (best-effort
        // per PRD §7.4).
        const { extractPptxText } = await import("./pptx");
        const normalized = normalize(extractPptxText(buffer));
        return normalized.length > 0
          ? { status: "parsed", text: normalized }
          : { status: "failed", text: null };
      }
      case "text": {
        const normalized = normalize(buffer.toString("utf-8"));
        return normalized.length > 0
          ? { status: "parsed", text: normalized }
          : { status: "failed", text: null };
      }
      case "image": {
        // Edit #1 — vision extraction (transcribed text + a short
        // prep-relevant description). Model unavailable → "failed",
        // never blocks the upload.
        const { extractImageContextText } = await import(
          "@/lib/ai/prep/image-context"
        );
        const mime = normalizeImageMime(mimeType, lower);
        if (!mime) return { status: "unsupported", text: null };
        const text = await extractImageContextText(buffer, mime);
        const normalized = normalize(text ?? "");
        return normalized.length > 0
          ? { status: "parsed", text: `[From image ${fileName}]\n${normalized}` }
          : { status: "failed", text: null };
      }
      default:
        return { status: "unsupported", text: null };
    }
  } catch {
    return { status: "failed", text: null };
  }
}

/** Resolve a usable image mime from the browser mime or extension
 *  (some pickers hand over empty mime types for photos). */
function normalizeImageMime(
  mimeType: string | null,
  lowerName: string,
): string | null {
  if (
    mimeType &&
    (VISION_IMAGE_MIMES as readonly string[]).includes(mimeType)
  ) {
    return mimeType;
  }
  for (const [ext, mime] of Object.entries(IMAGE_MIME_BY_EXT)) {
    if (lowerName.endsWith(ext)) return mime;
  }
  return null;
}

function detectKind(
  mimeType: string | null,
  lowerName: string,
): "pdf" | "docx" | "pptx" | "text" | "image" | "unsupported" {
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    lowerName.endsWith(".pptx")
  ) {
    return "pptx";
  }
  if (
    mimeType?.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return "text";
  }
  if (
    mimeType?.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif)$/.test(lowerName)
  ) {
    return "image";
  }
  return "unsupported";
}
