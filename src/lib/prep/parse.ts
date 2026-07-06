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
  ".txt",
  ".md",
] as const;

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
      case "text": {
        const normalized = normalize(buffer.toString("utf-8"));
        return normalized.length > 0
          ? { status: "parsed", text: normalized }
          : { status: "failed", text: null };
      }
      default:
        return { status: "unsupported", text: null };
    }
  } catch {
    return { status: "failed", text: null };
  }
}

function detectKind(
  mimeType: string | null,
  lowerName: string,
): "pdf" | "docx" | "text" | "unsupported" {
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
    mimeType?.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return "text";
  }
  return "unsupported";
}
