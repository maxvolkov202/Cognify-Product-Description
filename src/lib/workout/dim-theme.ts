import type { MuscleGroupId } from "@/types/domain";

/**
 * Per-muscle-group visual identity for the Daily Workout surfaces.
 *
 * The workout shell is dual-theme (light cards + dark mode), so every token
 * that lands on a LIGHT surface needs a light-safe variant: the bright
 * accents (`text`, `tile`, `chip`) were tuned for dark backgrounds and fall
 * below WCAG contrast on white (pacing/tone worst, ~1.7:1). Use
 * `scoreGradient` / `chipLight` on light-or-dual surfaces; the raw bright
 * tokens are fine for icon tiles, hairlines, glows, and dark-only surfaces.
 * Same multi-hue-inside-one-brand-family approach as the Skill Lab hub's
 * APPLICATION_ACCENTS and the Focus-mode DIMENSION_ACCENTS, pulled into one
 * place so the station strip, headers, progress bar, and summary screens
 * can't drift apart.
 */
export type DimTheme = {
  /** Hex for SVG strokes, timer rings, canvas — where classes can't reach. */
  accent: string;
  /** Tailwind ring-* class for the active station card. */
  ring: string;
  /** Text accent class (dark surfaces only — fails contrast on white). */
  text: string;
  /** Gradient icon-tile / hairline classes (bg-gradient-to-br …). */
  tile: string;
  /** Colored shadow class for gradient tiles. */
  glow: string;
  /** Soft gradient wash for card hovers / active surfaces. */
  wash: string;
  /** Ambient radial-gradient CSS for the page atmosphere behind the shell. */
  ambient: string;
  /** Chip classes (border + bg + text) for dim badges on DARK surfaces. */
  chip: string;
  /** Gradient stops for bg-clip-text scores on dual-theme cards: deep
   *  stops in light mode (≥3:1 on white), bright stops under dark:. */
  scoreGradient: string;
  /** Chip classes safe on light surfaces, with dark: overrides to `chip`. */
  chipLight: string;
};

export const DIM_THEMES: Record<MuscleGroupId, DimTheme> = {
  clarity: {
    accent: "#6aa3ff",
    ring: "ring-[#6aa3ff]",
    text: "text-[#6aa3ff]",
    tile: "from-[#6aa3ff] to-[#3d7bff]",
    glow: "shadow-[#6aa3ff]/25",
    wash: "from-[#6aa3ff]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(106,163,255,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(61,123,255,0.10), transparent 60%)",
    chip: "border-[#6aa3ff]/30 bg-[#6aa3ff]/10 text-[#6aa3ff]",
    scoreGradient:
      "from-[#2563eb] to-[#1e40af] dark:from-[#6aa3ff] dark:to-[#3d7bff]",
    chipLight:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-[#6aa3ff]/30 dark:bg-[#6aa3ff]/10 dark:text-[#6aa3ff]",
  },
  structure: {
    accent: "#b39bff",
    ring: "ring-[#b39bff]",
    text: "text-[#b39bff]",
    tile: "from-[#b39bff] to-[#8b5cf6]",
    glow: "shadow-[#b39bff]/25",
    wash: "from-[#b39bff]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(179,155,255,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(139,92,246,0.10), transparent 60%)",
    chip: "border-[#b39bff]/30 bg-[#b39bff]/10 text-[#b39bff]",
    scoreGradient:
      "from-[#7c3aed] to-[#5b21b6] dark:from-[#b39bff] dark:to-[#8b5cf6]",
    chipLight:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-[#b39bff]/30 dark:bg-[#b39bff]/10 dark:text-[#b39bff]",
  },
  conciseness: {
    accent: "#e77cf0",
    ring: "ring-[#e77cf0]",
    text: "text-[#e77cf0]",
    tile: "from-[#e77cf0] to-[#c026d3]",
    glow: "shadow-[#e77cf0]/25",
    wash: "from-[#e77cf0]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(231,124,240,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(192,38,211,0.10), transparent 60%)",
    chip: "border-[#e77cf0]/30 bg-[#e77cf0]/10 text-[#e77cf0]",
    scoreGradient:
      "from-[#c026d3] to-[#a21caf] dark:from-[#e77cf0] dark:to-[#c026d3]",
    chipLight:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-[#e77cf0]/30 dark:bg-[#e77cf0]/10 dark:text-[#e77cf0]",
  },
  thinking_quality: {
    accent: "#b072ff",
    ring: "ring-[#b072ff]",
    text: "text-[#b072ff]",
    tile: "from-[#b072ff] to-[#7c3aed]",
    glow: "shadow-[#b072ff]/25",
    wash: "from-[#b072ff]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(176,114,255,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(124,58,237,0.10), transparent 60%)",
    chip: "border-[#b072ff]/30 bg-[#b072ff]/10 text-[#b072ff]",
    scoreGradient:
      "from-[#9333ea] to-[#6d28d9] dark:from-[#b072ff] dark:to-[#7c3aed]",
    chipLight:
      "border-purple-200 bg-purple-50 text-purple-700 dark:border-[#b072ff]/30 dark:bg-[#b072ff]/10 dark:text-[#b072ff]",
  },
  pacing: {
    accent: "#7fd6c8",
    ring: "ring-[#7fd6c8]",
    text: "text-[#7fd6c8]",
    tile: "from-[#7fd6c8] to-[#14b8a6]",
    glow: "shadow-[#7fd6c8]/25",
    wash: "from-[#7fd6c8]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(127,214,200,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(20,184,166,0.10), transparent 60%)",
    chip: "border-[#7fd6c8]/30 bg-[#7fd6c8]/10 text-[#7fd6c8]",
    scoreGradient:
      "from-[#0d9488] to-[#0f766e] dark:from-[#7fd6c8] dark:to-[#14b8a6]",
    chipLight:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-[#7fd6c8]/30 dark:bg-[#7fd6c8]/10 dark:text-[#7fd6c8]",
  },
  tone: {
    accent: "#ffb38a",
    ring: "ring-[#ffb38a]",
    text: "text-[#ffb38a]",
    tile: "from-[#ffb38a] to-[#f97316]",
    glow: "shadow-[#ffb38a]/25",
    wash: "from-[#ffb38a]/15 to-transparent",
    ambient:
      "radial-gradient(60% 80% at 30% 0%, rgba(255,179,138,0.16), transparent 60%), radial-gradient(50% 60% at 90% 20%, rgba(249,115,22,0.10), transparent 60%)",
    chip: "border-[#ffb38a]/30 bg-[#ffb38a]/10 text-[#ffb38a]",
    scoreGradient:
      "from-[#ea580c] to-[#c2410c] dark:from-[#ffb38a] dark:to-[#f97316]",
    chipLight:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-[#ffb38a]/30 dark:bg-[#ffb38a]/10 dark:text-[#ffb38a]",
  },
};
