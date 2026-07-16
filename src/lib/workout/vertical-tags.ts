/**
 * Legacy tag map — the original 864 vertical-flavored prompts (Phase 2
 * seed) were tagged with single keys like "finance", "business",
 * "leadership", "healthcare", "science". The Wave 1 vertical bank
 * (4,320 prompts) uses the vertical id itself as the first tag ("sales",
 * "leadership", etc.) plus persona + goal ids. Vertical filters union
 * both schemes so the legacy bank stays in rotation.
 *
 * "other" maps to an empty array; vertical filtering for "other" users
 * relies entirely on the new vertical-id tag.
 *
 * Shared by prompt-selection (slate tier cascade) and the legacy
 * Build-a-Rep vertical picker (Phase 2B.3 catalog cutover).
 */
export const LEGACY_VERTICAL_TAGS: Record<string, string[]> = {
  sales: ["business", "leadership"],
  consulting: ["business", "leadership"],
  finance: ["finance", "business"],
  healthcare: ["healthcare", "science"],
  law: ["business", "current events"],
  education: ["education", "science"],
  leadership: ["leadership", "business"],
  other: [],
};
