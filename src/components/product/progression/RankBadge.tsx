"use client";

// PRD v3 Phase 6 — Rank badge (PRD §10.5.1: "a unique visual badge …
// one of the most recognizable elements of the Cognify experience").
// Code-drawn SVG shield per tier color + roman-numeral division; design
// can swap in illustrated assets later without changing call sites.
//
// Visual pass: per-tier two-stop gradient (tier hue → hue darkened 25%),
// inset bevel stroke + specular highlight so it reads as a game badge at
// both 20px (leaderboard rows) and 48px+ (dashboard, ProgressionStrip).
// Gradient/filter ids are useId-unique so multiple badges can coexist.

import { useId } from "react";
import type { RankInfo } from "@/lib/progression/rank";

/** Darken a #rrggbb hex by `amount` (0-1) for the gradient's low stop. */
function darken(hex: string, amount = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 0xff) * (1 - amount));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0))
    .toString(16)
    .padStart(6, "0")}`;
}

export function RankBadge({
  rank,
  size = 44,
}: {
  rank: Pick<RankInfo, "tierColor" | "divisionRoman" | "label">;
  size?: number;
}) {
  // Unique per instance — dashboard + strip + leaderboard render many
  // badges on one page; colliding <defs> ids would cross-wire colors.
  const uid = useId().replace(/:/g, "");
  const fillId = `rk-fill-${uid}`;
  const specId = `rk-spec-${uid}`;
  const textShadowId = `rk-ts-${uid}`;
  const darkStop = darken(rank.tierColor);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      role="img"
      aria-label={rank.label}
      // Soft tier-colored glow once the badge is a hero element ("59" ≈
      // 35% alpha); at row sizes (≤20px) the glow would just read as blur.
      style={
        size >= 44
          ? { filter: `drop-shadow(0 4px 12px ${rank.tierColor}59)` }
          : undefined
      }
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rank.tierColor} />
          <stop offset="100%" stopColor={darkStop} />
        </linearGradient>
        <radialGradient id={specId} cx="0.5" cy="0.22" r="0.65">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={textShadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="0.8"
            floodColor="#0a0a0f"
            floodOpacity="0.45"
          />
        </filter>
      </defs>
      {/* Shield body — tier hue falling into its darkened stop. */}
      <path
        d="M22 2 L38 8 V22 C38 32 31 39 22 42 C13 39 6 32 6 22 V8 Z"
        fill={`url(#${fillId})`}
        stroke={darkStop}
        strokeWidth="1"
      />
      {/* Inner bevel — inset shield stroked white for a raised-edge read. */}
      <path
        d="M22 4.6 L35.8 9.8 V21.8 C35.8 30.4 29.7 36.6 22 39.4 C14.3 36.6 8.2 30.4 8.2 21.8 V9.8 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
      {/* Specular highlight near the crown. */}
      <ellipse cx="22" cy="11" rx="12" ry="7" fill={`url(#${specId})`} />
      {/* Division numeral — inherits the app font stack (Inter). */}
      <text
        x="22"
        y="27"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="#ffffff"
        filter={`url(#${textShadowId})`}
      >
        {rank.divisionRoman}
      </text>
    </svg>
  );
}
