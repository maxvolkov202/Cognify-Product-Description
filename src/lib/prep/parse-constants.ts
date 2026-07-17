// PRD v3 Phase 5 — Build a Rep context-upload shared constants (PRD §7.4).
//
// Client-safe half of prep/parse: pure constants + the ParseResult type,
// with NO node: imports. parse.ts (the actual parser) pulls node-only
// document extractors (unpdf/pptx → node:zlib) via dynamic import, so a
// client component that imports a constant straight from parse.ts drags
// that whole chunk into the browser bundle and fails `next build`
// ("Module not found: Can't resolve 'node:zlib'"). Client code
// (PrepEventClient, image-downscale) imports from HERE instead; server
// code can keep importing from parse.ts, which re-exports these.

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

/** Single source of truth for vision-parseable images — drives the
 *  extension detection here, the client-side downscaler's passthrough
 *  check, and the vision module's mime gate. (HEIC is NOT here: the
 *  vision API doesn't take it; the client downscaler transcodes HEIC
 *  to JPEG on browsers that can decode it.) */
export const IMAGE_MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
} as const;

export const VISION_IMAGE_MIMES = [
  ...new Set(Object.values(IMAGE_MIME_BY_EXT)),
] as const;

export type ParseResult =
  | { status: "parsed"; text: string }
  | { status: "failed"; text: null }
  | { status: "unsupported"; text: null };
