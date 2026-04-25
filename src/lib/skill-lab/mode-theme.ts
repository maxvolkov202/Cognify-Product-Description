import type { SkillDimension } from "@/types/domain";

/**
 * Per-mode visual identity tokens for the Skill Lab.
 *
 * The three modes (Focus / Mixed / Pressure) all share the same in-session
 * loop, so visual differentiation is what tells the user which mode they're
 * in at a glance. These tokens drive headers, accent colors, atmospheric
 * gradients, and the timer ring color so a Focus rep cannot be mistaken
 * for a Mixed or Pressure rep.
 */

export type ModeId = "focus" | "mixed" | "pressure";

export type ModeTheme = {
  id: ModeId;
  label: string;
  /** Verb in the imperative — "Lock in", "Build", "Bring the heat". */
  imperative: string;
  /** One-line headline shown above the dim picker. */
  pickerHeadline: string;
  /** One-line subhead shown under the headline. */
  pickerSubhead: string;
  /** Hex / CSS color for stroke and accents. */
  accentColor: string;
  /** Ambient radial-gradient for the page background — keeps the brand
   *  gradient on interior surfaces but tints the peripheral atmosphere. */
  ambient: string;
  /** Glow class string for the lobby card. */
  lobbyGlow: string;
  /** Soft tint applied to the picker container's background. */
  pickerBg: string;
  /** Hero strip background gradient classes. */
  heroBg: string;
  /** Tone for chip/eyebrow used inside the mode. */
  chipBorder: string;
  chipBg: string;
  chipText: string;
};

export const MODE_THEMES: Record<ModeId, ModeTheme> = {
  focus: {
    id: "focus",
    label: "Focus",
    imperative: "Lock in",
    pickerHeadline: "Lock in on one.",
    pickerSubhead:
      "Pick the muscle. Every rep targets the same skill — depth over breadth.",
    accentColor: "#6aa3ff", // brand-blue
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(106,163,255,0.28), transparent 60%), radial-gradient(60% 80% at 90% 30%, rgba(106,163,255,0.14), transparent 60%)",
    lobbyGlow: "from-brand-blue/15 via-white to-brand-blue/5",
    pickerBg: "bg-gradient-to-b from-brand-blue/5 to-transparent",
    heroBg:
      "bg-gradient-to-r from-brand-blue/15 via-brand-blue/5 to-transparent",
    chipBorder: "border-brand-blue/30",
    chipBg: "bg-brand-blue/10",
    chipText: "text-brand-blue",
  },
  mixed: {
    id: "mixed",
    label: "Mixed",
    imperative: "Stack it",
    pickerHeadline: "Build your stack.",
    pickerSubhead:
      "Pick the skills you want in today's set. Stack them up — we'll interleave so no skill repeats back-to-back.",
    accentColor: "#b072ff", // brand-purple
    ambient:
      "radial-gradient(60% 70% at 15% 0%, rgba(106,163,255,0.22), transparent 60%), radial-gradient(60% 70% at 90% 30%, rgba(231,124,240,0.22), transparent 60%), radial-gradient(50% 60% at 60% 80%, rgba(176,114,255,0.18), transparent 60%)",
    lobbyGlow: "from-brand-lavender/20 via-white to-brand-magenta/5",
    pickerBg:
      "bg-gradient-to-br from-brand-blue/5 via-brand-lavender/5 to-brand-magenta/5",
    heroBg:
      "bg-gradient-to-r from-brand-blue/10 via-brand-lavender/15 to-brand-magenta/10",
    chipBorder: "border-brand-purple/30",
    chipBg: "bg-brand-lavender/15",
    chipText: "text-brand-purple",
  },
  pressure: {
    id: "pressure",
    label: "Pressure",
    imperative: "Bring the heat",
    pickerHeadline: "Train under heat.",
    pickerSubhead:
      "Each rep loads a different stress mechanic — pushback, compression, audience switch. You cycle the catalog.",
    accentColor: "#e77cf0", // brand-magenta
    ambient:
      "radial-gradient(70% 80% at 90% 0%, rgba(231,124,240,0.28), transparent 60%), radial-gradient(60% 70% at 10% 30%, rgba(176,114,255,0.22), transparent 60%)",
    lobbyGlow: "from-brand-magenta/15 via-white to-brand-purple/5",
    pickerBg: "bg-gradient-to-b from-brand-magenta/8 to-transparent",
    heroBg:
      "bg-gradient-to-r from-brand-magenta/15 via-brand-purple/10 to-brand-lavender/10",
    chipBorder: "border-brand-magenta/30",
    chipBg: "bg-brand-magenta/10",
    chipText: "text-brand-magenta",
  },
};

/**
 * Per-dimension accent color for Focus mode in-session theming. Pulled in
 * one place so the timer ring, dim badge, and live score header all match.
 * All values are within the Cognify brand palette — no off-brand hues.
 */
export const DIMENSION_ACCENTS: Record<SkillDimension, string> = {
  clarity: "#6aa3ff", // brand-blue
  structure: "#b39bff", // brand-lavender
  conciseness: "#e77cf0", // brand-magenta
  thinking_quality: "#b072ff", // brand-purple
  delivery: "#b39bff", // brand-lavender (was cyan)
  adaptability: "#e77cf0", // brand-magenta (was amber)
};

export function focusAccentForDimension(dim: SkillDimension): string {
  return DIMENSION_ACCENTS[dim];
}
