"use client";

// Shared celebration sparkles. Extracted from DayCompleteSummary so the
// Improvement Review + Skill Lab Session Complete reveals share one
// implementation. Host container must be `relative`.

/** One-time floating sparkles behind a hero score. Pure CSS animation
 *  (.animate-sparkle plays once, forwards); the reduced-motion guard in
 *  globals.css keeps them invisible when motion is off. Brand palette
 *  only — no new colors. */
const SPARKLES: {
  left: string;
  top: string;
  size: number;
  delay: number;
  color: string;
}[] = [
  { left: "18%", top: "38%", size: 6, delay: 0.1, color: "var(--color-brand-lavender)" },
  { left: "30%", top: "62%", size: 4, delay: 0.45, color: "var(--color-brand-blue)" },
  { left: "40%", top: "24%", size: 5, delay: 0.8, color: "var(--color-brand-magenta)" },
  { left: "58%", top: "20%", size: 4, delay: 0.3, color: "var(--color-brand-purple)" },
  { left: "68%", top: "58%", size: 6, delay: 0.6, color: "var(--color-brand-lavender)" },
  { left: "78%", top: "34%", size: 4, delay: 0.15, color: "var(--color-brand-magenta)" },
  { left: "86%", top: "56%", size: 5, delay: 0.95, color: "var(--color-brand-blue)" },
];

export default function CelebrationSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="animate-sparkle absolute rounded-full"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
