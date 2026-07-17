// Phase 4 (Edit #3) — pure logic for per-moment speaking notes.
// Extracted from the server action so the clamping rules are unit-tested
// (tests/prep-plan.test.ts) and the TalkingPoints shape stays the single
// exported type the sidebar, schema, and actions all share.

import type { TalkingPoints } from "@/lib/ai/talking-points";

export const MOMENT_NOTES_LIMITS = {
  sections: 8,
  headerChars: 80,
  bullets: 12,
  bulletChars: 240,
} as const;

/** Clamp + sanitize a client-supplied notes structure. Returns null for
 *  structurally-empty input (used to clear the notes). */
export function sanitizeMomentNotes(notes: unknown): TalkingPoints | null {
  if (!notes || typeof notes !== "object") return null;
  const raw = (notes as { sections?: unknown }).sections;
  if (!Array.isArray(raw)) return null;
  const sections = raw
    .slice(0, MOMENT_NOTES_LIMITS.sections)
    .map((s) => {
      const header =
        typeof (s as { header?: unknown })?.header === "string"
          ? ((s as { header: string }).header ?? "")
              .trim()
              .slice(0, MOMENT_NOTES_LIMITS.headerChars)
          : "";
      const bullets = Array.isArray((s as { bullets?: unknown })?.bullets)
        ? ((s as { bullets: unknown[] }).bullets ?? [])
            .filter((b): b is string => typeof b === "string")
            .map((b) => b.trim().slice(0, MOMENT_NOTES_LIMITS.bulletChars))
            .filter((b) => b.length > 0)
            .slice(0, MOMENT_NOTES_LIMITS.bullets)
        : [];
      return { header, bullets };
    })
    .filter((s) => s.header.length > 0 || s.bullets.length > 0);
  return sections.length > 0 ? { sections } : null;
}

/** Deterministic structure when the model is unavailable — built from
 *  the moment's own objective + coach cue so it's never generic
 *  boilerplate. Only used when the moment has NO existing notes (a
 *  failed regenerate keeps what the user already has). */
export function fallbackMomentStructure(moment: {
  title: string;
  objective: string | null;
  coachCue: string | null;
}): TalkingPoints {
  return {
    sections: [
      {
        header: "Open",
        bullets: [
          "Answer the question in your first sentence",
          ...(moment.objective ? [moment.objective] : []),
        ],
      },
      {
        header: "Support",
        bullets: [
          "One concrete example or number that proves it",
          ...(moment.coachCue ? [moment.coachCue] : []),
        ],
      },
      {
        header: "Close",
        bullets: ["End on the point, then stop"],
      },
    ],
  };
}
