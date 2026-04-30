/**
 * Per-rep feedback panel — re-export from `./feedback` after the
 * Phase 1 redesign. The old 854-line implementation was split into
 * `feedback/FeedbackPanel.tsx` plus per-section primitives (ScoreHero,
 * DimensionGrid, OutcomeCard, etc.). All consumers (RepSurface and the
 * `PreviousRepSummary` type re-export) keep their existing imports.
 */
export { FeedbackPanel, type PreviousRepSummary } from "./feedback";
