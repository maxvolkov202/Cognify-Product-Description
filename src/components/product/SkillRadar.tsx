import type { SkillDimension } from "@/types/domain";

// Labels match DIMENSION_LABELS from types/domain.ts but are kept local
// for the short-form display (radar axes favor short labels; "Thinking
// Quality" abbreviated to "Thinking").
const LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking",
  delivery: "Pacing", // D6 — user-facing name for the delivery enum
  tone: "Tone",
};

// Order is Content (top three) then Delivery (bottom three) — visually
// the hexagon rotates so Content clusters up-and-right, Delivery
// clusters down-and-left, giving the shape instant grouping.
const ORDER: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

type Props = {
  scores: Partial<Record<SkillDimension, number | null>>;
  size?: number;
};

export function SkillRadar({ scores, size = 260 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) * 0.78;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / ORDER.length;

  const axisPoints = ORDER.map((_, i) => {
    const a = angleFor(i);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

  const labelPoints = ORDER.map((dim, i) => {
    const a = angleFor(i);
    return {
      dim,
      x: cx + (r + 18) * Math.cos(a),
      y: cy + (r + 18) * Math.sin(a),
    };
  });

  const ringScores = [0.25, 0.5, 0.75, 1];

  const polygonPoints = ORDER.map((dim, i) => {
    const a = angleFor(i);
    const raw = scores[dim];
    const v = (raw ?? 0) / 100;
    const rv = r * v;
    return `${cx + rv * Math.cos(a)},${cy + rv * Math.sin(a)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="overflow-visible">
      <defs>
        <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6aa3ff" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#9788ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e77cf0" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="radar-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6aa3ff" />
          <stop offset="100%" stopColor="#e77cf0" />
        </linearGradient>
      </defs>
      {ringScores.map((frac) => (
        <polygon
          key={frac}
          points={ORDER.map((_, i) => {
            const a = angleFor(i);
            return `${cx + r * frac * Math.cos(a)},${cy + r * frac * Math.sin(a)}`;
          }).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-ink-200 dark:text-ink-700"
          strokeWidth="1"
        />
      ))}
      {axisPoints.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="currentColor"
          className="text-ink-100 dark:text-ink-800"
          strokeWidth="1"
        />
      ))}
      <polygon
        points={polygonPoints}
        fill="url(#radar-fill)"
        stroke="url(#radar-stroke)"
        strokeWidth="2"
      />
      {labelPoints.map((lp) => (
        <text
          key={lp.dim}
          x={lp.x}
          y={lp.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="600"
          className="fill-ink-500 dark:fill-ink-400"
        >
          {LABELS[lp.dim]}
        </text>
      ))}
    </svg>
  );
}
