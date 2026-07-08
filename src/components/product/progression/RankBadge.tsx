// PRD v3 Phase 6 — Rank badge (PRD §10.5.1: "a unique visual badge …
// one of the most recognizable elements of the Cognify experience").
// Code-drawn SVG shield per tier color + roman-numeral division; design
// can swap in illustrated assets later without changing call sites.

import type { RankInfo } from "@/lib/progression/rank";

export function RankBadge({
  rank,
  size = 44,
}: {
  rank: Pick<RankInfo, "tierColor" | "divisionRoman" | "label">;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label={rank.label}
    >
      <defs>
        <linearGradient id={`rk-${rank.tierColor.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rank.tierColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={rank.tierColor} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <path
        d="M22 2 L38 8 V22 C38 32 31 39 22 42 C13 39 6 32 6 22 V8 Z"
        fill={`url(#rk-${rank.tierColor.slice(1)})`}
        stroke={rank.tierColor}
        strokeWidth="1.5"
      />
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontFamily="system-ui"
        fontSize="14"
        fontWeight="800"
        fill="#ffffff"
      >
        {rank.divisionRoman}
      </text>
    </svg>
  );
}
