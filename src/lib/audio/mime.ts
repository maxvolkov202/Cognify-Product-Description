/**
 * Audio MIME normalization for the rep-audio upload path.
 *
 * `MediaRecorder` reports a PARAMETERIZED media type — Chrome/Edge send
 * `audio/webm;codecs=opus`, Safari `audio/mp4` (sometimes with its own
 * codecs parameter). The `rep-audio` Supabase Storage bucket matches its
 * `allowed_mime_types` against the FULL contentType string, so the
 * parameterized form never matches and Storage rejects the write with
 * "mime type audio/webm;codecs=opus is not supported".
 *
 * That is why `reps.audio_url` was NULL for every rep from ~2026-07-24:
 * the upload 500'd, and because upload is best-effort the rep still saved
 * and graded. In-session playback uses a local blob URL, so the breakage
 * only showed when listening back to a PAST rep.
 *
 * We normalize here rather than widening the bucket allowlist: the codec
 * parameter set is open-ended and varies by browser and version, so an
 * enumeration of parameterized variants is a treadmill that breaks again
 * on the next browser that adds one. Stripping parameters is closed-form.
 */

/** The types the `rep-audio` bucket accepts, verbatim. Keep in sync with
 *  the bucket's `allowed_mime_types` — a value here that the bucket does
 *  not allow turns a clean 415 back into an opaque 500 from Storage. */
export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
] as const;

export type AllowedAudioMimeType = (typeof ALLOWED_AUDIO_MIME_TYPES)[number];

/**
 * Strip media-type parameters and normalize case/whitespace:
 * `"audio/webm;codecs=opus"` → `"audio/webm"`, `" AUDIO/MP4 "` → `"audio/mp4"`.
 *
 * Per RFC 9110 the type/subtype is case-insensitive, so lowercasing is
 * safe and makes the allowlist comparison exact.
 */
export function normalizeAudioMime(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.split(";")[0]!.trim().toLowerCase();
}

/** True when the NORMALIZED type is one the bucket will accept. Callers
 *  should normalize first — this deliberately does not, so a caller can't
 *  accidentally validate one string and upload a different one. */
export function isAllowedAudioMime(
  normalized: string,
): normalized is AllowedAudioMimeType {
  return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(normalized);
}

/**
 * Storage-key extension for a normalized audio type. Exact match rather
 * than the previous `includes()` chain: `includes` is order-dependent and
 * would mis-file any future type whose subtype embeds an earlier branch's
 * name. Unknown types fall back to `bin`, which is unreachable while the
 * route validates against the allowlist first but keeps this total.
 */
export function audioExtensionFor(normalized: string): string {
  switch (normalized) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "mp4";
    case "audio/mpeg":
      return "mp3";
    case "audio/wav":
      return "wav";
    default:
      return "bin";
  }
}
