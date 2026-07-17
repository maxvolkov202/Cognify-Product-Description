// PRD v3 Phase 5 — Build a Rep context-upload parsing (PRD §7.4).
//
// Uploads are optional; parsing is best-effort. A failed parse never
// blocks the preparation flow — the event just personalizes less.
// Raw files land in Supabase Storage; only the extracted text (capped)
// is injected into Preparation Plan / coaching generation.

/** Hard cap on stored parsed text. Resumes/JDs are a few thousand chars;
 *  the cap only bites on pasted decks or long docs, where the head of
 *  the document carries most of the personalization value anyway. */
export const PREP_PARSED_TEXT_CAP = 50_000;

/** Per-file upload cap (bytes). Matches the recording-upload ceiling
 *  and stays comfortably under Vercel's request-body limit. */
export const PREP_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export const PREP_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".txt",
  ".md",
  // Edit #1 — photo-library uploads (job postings, slides, whiteboards,
  // schedules). Parsed to text via vision at upload time.
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

/** The file-picker accept attribute. `image/*` (not just extensions)
 *  is what makes iOS offer the photo library. */
export const PREP_ACCEPT_ATTR = ".pdf,.docx,.pptx,.txt,.md,image/*";

export type ParseResult =
  | { status: "parsed"; text: string }
  | { status: "failed"; text: null }
  | { status: "unsupported"; text: null };

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
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)
  ) {
    return mimeType;
  }
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
    return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".gif")) return "image/gif";
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
