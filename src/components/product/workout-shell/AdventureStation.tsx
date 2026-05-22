"use client";

// One station on the muscle-group adventure path. Renders:
//  - Pedestal (arch + base with station number)
//  - Mascot pose (PNG from public/mascot/step-N.png; SVG fallback)
//  - Active glow ring + sparkle decoration
//  - Done checkmark badge
//
// The per-station "pose" maps to the station's index (1..4): introduction,
// key concept, applied scenario, practice drill. Same brain character,
// different pose per index — drives the visual storytelling.

import { Check, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import MascotCharacter from "@/components/product/workout/mascot/MascotCharacter";
import type { MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export type StationStatus = "done" | "active" | "locked";

export type AdventureStationProps = {
  /** 0-based; rendered as 1-based on the pedestal. */
  index: number;
  status: StationStatus;
  /** Active station fires this when tapped (start workout / open picker). */
  onActivate?: () => void;
  /** Used to tint the active glow ring + path color. */
  dim: MuscleGroupId | null;
  /** Pixel size of the pedestal — drives the whole station's footprint. */
  size?: number;
};

export default function AdventureStation({
  index,
  status,
  onActivate,
  dim,
  size = 120,
}: AdventureStationProps) {
  const accent = dim ? DIM_ACCENT[dim] : DIM_ACCENT.clarity;
  const isActive = status === "active";
  const isDone = status === "done";
  const isLocked = status === "locked";
  const stepNumber = index + 1;

  const interactive = isActive && onActivate;
  const Wrapper = interactive ? "button" : "div";

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? onActivate : undefined}
      className={cn(
        "relative inline-flex flex-col items-center justify-end",
        "select-none",
        interactive
          ? "cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300/60 rounded-3xl"
          : "",
        isLocked ? "opacity-70" : "",
      )}
      style={{ width: size }}
      data-station-status={status}
      data-station-index={index}
      aria-label={
        isActive
          ? `Start station ${stepNumber}`
          : `Station ${stepNumber}, ${status}`
      }
      aria-disabled={!interactive}
    >
      {/* Active glow ring — sits BEHIND the pedestal */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-[36%] pointer-events-none"
          style={{
            boxShadow: `0 0 0 4px ${accent.ring}, 0 0 32px ${accent.glow}`,
          }}
          animate={{
            boxShadow: [
              `0 0 0 4px ${accent.ring}, 0 0 24px ${accent.glow}`,
              `0 0 0 4px ${accent.ring}, 0 0 40px ${accent.glow}`,
              `0 0 0 4px ${accent.ring}, 0 0 24px ${accent.glow}`,
            ],
          }}
          transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          aria-hidden="true"
        />
      )}

      {/* Pedestal — arch silhouette + numbered base */}
      <Pedestal size={size} accent={accent} status={status} stepNumber={stepNumber} />

      {/* Mascot pose — absolutely positioned inside the arch */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          bottom: size * 0.16,
          transform: "translateX(-50%)",
          width: size * 0.72,
          height: size * 0.72,
        }}
        aria-hidden="true"
      >
        <MascotPose index={index} status={status} dim={dim} />
      </div>

      {/* Done check badge */}
      {isDone && (
        <div
          className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md"
          aria-hidden="true"
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </div>
      )}

      {/* Active sparkle */}
      {isActive && (
        <motion.div
          className="absolute -top-2 -right-2"
          animate={{ rotate: [0, 12, -6, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity }}
          aria-hidden="true"
        >
          <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400" />
        </motion.div>
      )}
    </Wrapper>
  );
}

function Pedestal({
  size,
  accent,
  status,
  stepNumber,
}: {
  size: number;
  accent: DimAccent;
  status: StationStatus;
  stepNumber: number;
}) {
  // Pedestal: round-top arch (the "training booth") on top of a flat
  // numbered base.
  const archHeight = size;
  const baseColor =
    status === "active"
      ? accent.pedestal
      : status === "done"
        ? "#e0e7ff"
        : "#e5e7eb";

  return (
    <svg
      width={size}
      height={archHeight}
      viewBox={`0 0 ${size} ${archHeight}`}
      className="block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`arch-${stepNumber}-${status}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={baseColor} />
          <stop offset="100%" stopColor={status === "active" ? accent.pedestalBase : "#d1d5db"} />
        </linearGradient>
      </defs>
      {/* Arch silhouette */}
      <path
        d={`
          M ${size * 0.18} ${size * 0.95}
          L ${size * 0.18} ${size * 0.45}
          C ${size * 0.18} ${size * 0.16}, ${size * 0.82} ${size * 0.16}, ${size * 0.82} ${size * 0.45}
          L ${size * 0.82} ${size * 0.95}
          Z
        `}
        fill={`url(#arch-${stepNumber}-${status})`}
        stroke={status === "active" ? accent.pedestalStroke : "#9ca3af"}
        strokeWidth="1.5"
        strokeOpacity="0.5"
      />
      {/* Flat base */}
      <rect
        x={size * 0.08}
        y={size * 0.86}
        width={size * 0.84}
        height={size * 0.12}
        rx={size * 0.04}
        fill={status === "active" ? accent.pedestalBase : "#cbd5e1"}
      />
      {/* Number circle on the base */}
      <circle
        cx={size * 0.5}
        cy={size * 0.92}
        r={size * 0.06}
        fill="#ffffff"
        stroke={status === "active" ? accent.pedestalStroke : "#9ca3af"}
        strokeWidth="1.2"
      />
      <text
        x={size * 0.5}
        y={size * 0.92 + size * 0.025}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={size * 0.07}
        fontWeight="700"
        fill={status === "active" ? accent.pedestalStroke : "#6b7280"}
      >
        {stepNumber}
      </text>
    </svg>
  );
}

function MascotPose({
  index,
  status,
  dim,
}: {
  index: number;
  status: StationStatus;
  dim: MuscleGroupId | null;
}) {
  // PNG-first: if public/mascot/step-N.png exists, render it. Otherwise
  // fall back to the SVG MascotCharacter (geometric placeholder). Once
  // Max drops the AI-generated PNGs in, the swap happens automatically.
  const [imgFailed, setImgFailed] = useState(false);
  const stepNumber = index + 1;
  const src = `/mascot/step-${stepNumber}.png`;

  if (imgFailed) {
    return (
      <MascotCharacter
        state={
          status === "done"
            ? "celebrating-rep"
            : status === "active"
              ? "at-station-recording"
              : "idle"
        }
        dim={dim}
        width="100%"
        height="100%"
        className="block"
        style={{ filter: status === "locked" ? "grayscale(0.6)" : undefined }}
      />
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={256}
      height={256}
      onError={() => setImgFailed(true)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        filter: status === "locked" ? "grayscale(0.6) opacity(0.85)" : undefined,
      }}
      priority={status === "active"}
      unoptimized
    />
  );
}

type DimAccent = {
  ring: string;
  glow: string;
  path: string;
  pedestal: string;
  pedestalBase: string;
  pedestalStroke: string;
};

const DIM_ACCENT: Record<MuscleGroupId, DimAccent> = {
  clarity: {
    ring: "#a78bfa",
    glow: "rgba(167,139,250,0.55)",
    path: "#a78bfa",
    pedestal: "#ede9fe",
    pedestalBase: "#c4b5fd",
    pedestalStroke: "#7c3aed",
  },
  structure: {
    ring: "#818cf8",
    glow: "rgba(129,140,248,0.55)",
    path: "#818cf8",
    pedestal: "#e0e7ff",
    pedestalBase: "#a5b4fc",
    pedestalStroke: "#4f46e5",
  },
  conciseness: {
    ring: "#f472b6",
    glow: "rgba(244,114,182,0.55)",
    path: "#f472b6",
    pedestal: "#fce7f3",
    pedestalBase: "#f9a8d4",
    pedestalStroke: "#be185d",
  },
  thinking_quality: {
    ring: "#c084fc",
    glow: "rgba(192,132,252,0.55)",
    path: "#c084fc",
    pedestal: "#f5d0fe",
    pedestalBase: "#e9a8fc",
    pedestalStroke: "#a21caf",
  },
  pacing: {
    ring: "#34d399",
    glow: "rgba(52,211,153,0.55)",
    path: "#34d399",
    pedestal: "#d1fae5",
    pedestalBase: "#86efac",
    pedestalStroke: "#059669",
  },
  tone: {
    ring: "#fbbf24",
    glow: "rgba(251,191,36,0.55)",
    path: "#fbbf24",
    pedestal: "#fef3c7",
    pedestalBase: "#fcd34d",
    pedestalStroke: "#b45309",
  },
};

export { DIM_ACCENT };
