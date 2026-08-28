/**
 * Grading audit WS1 (§3.1.3) — soft truncation for model prose fields.
 *
 * The scoring response schema caps `coachFocus.behavior/why/action`,
 * `headline`, `dimensions[].feedback` and `nextRepHint` at fixed lengths.
 * Before this module a model reply that ran a few characters over any cap
 * failed Zod, and the WHOLE 8-20 s LLM result was discarded for a mock
 * score (5 of the real-user mock fallbacks since 08-10 were exactly this).
 *
 * Length is a presentation concern, not a scoring one: cut on the last word
 * boundary inside the cap and keep the score. Verbatim fields (quotes,
 * strongerVersion.quote) are deliberately NOT truncated — a shortened quote
 * is no longer verbatim and would fail the transcript grounding check.
 */

/** Cut `s` to at most `max` characters on a word boundary. Returns the
 *  input untouched when it already fits. Never returns an empty string for
 *  non-empty input (falls back to a hard cut when no boundary exists). */
export function softTruncate(s: string, max: number): string {
  if (max <= 0) return "";
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  // The cap may already fall on a word boundary (next char is whitespace);
  // otherwise back up to the last whitespace so we never end mid-word.
  const boundary = /\s/.test(s.charAt(max));
  const cut = boundary ? head.length : head.search(/\s\S*$/);
  const trimmed = (cut > 0 ? head.slice(0, cut) : head).replace(
    /[\s,;:\-–]+$/,
    "",
  );
  return trimmed.length > 0 ? trimmed : head.trimEnd();
}

/** Caps mirrored from `scoringResponseSchema` in score-shared.ts. Keep in
 *  sync — the schema is the contract, this is the pre-parse safety net. */
export const PROSE_CAPS = {
  headline: 200,
  nextRepHint: 60,
  dimensionFeedback: 400,
  coachBehavior: 200,
  coachWhy: 280,
  coachAction: 220,
  implementationNote: 280,
} as const;

/** Apply softTruncate to the prose fields of a raw (pre-Zod) scoring
 *  response object. Tolerant of any shape: non-string / missing fields are
 *  left untouched so Zod still reports real contract violations. Returns
 *  the list of fields that were cut (for telemetry / logs). */
export function softTruncateScoringResponse(parsed: unknown): {
  value: unknown;
  truncated: string[];
} {
  const truncated: string[] = [];
  if (!parsed || typeof parsed !== "object") return { value: parsed, truncated };
  const obj = parsed as Record<string, unknown>;

  const cutField = (
    holder: Record<string, unknown>,
    key: string,
    max: number,
    label: string,
  ) => {
    const v = holder[key];
    if (typeof v !== "string" || v.length <= max) return;
    holder[key] = softTruncate(v, max);
    truncated.push(label);
  };

  cutField(obj, "headline", PROSE_CAPS.headline, "headline");
  cutField(obj, "nextRepHint", PROSE_CAPS.nextRepHint, "nextRepHint");

  const cf = obj.coachFocus;
  if (cf && typeof cf === "object") {
    const c = cf as Record<string, unknown>;
    cutField(c, "behavior", PROSE_CAPS.coachBehavior, "coachFocus.behavior");
    cutField(c, "why", PROSE_CAPS.coachWhy, "coachFocus.why");
    cutField(c, "action", PROSE_CAPS.coachAction, "coachFocus.action");
  }

  const ir = obj.implementationReview;
  if (ir && typeof ir === "object") {
    cutField(
      ir as Record<string, unknown>,
      "note",
      PROSE_CAPS.implementationNote,
      "implementationReview.note",
    );
  }

  if (Array.isArray(obj.dimensions)) {
    obj.dimensions.forEach((d, i) => {
      if (d && typeof d === "object") {
        cutField(
          d as Record<string, unknown>,
          "feedback",
          PROSE_CAPS.dimensionFeedback,
          `dimensions[${i}].feedback`,
        );
      }
    });
  }

  return { value: obj, truncated };
}
