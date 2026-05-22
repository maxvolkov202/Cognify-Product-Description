"use client";

// Top-strip stage: mascot walks across a horizontal station path.
//
// Replaces MascotStage on the new v3 workout layout. The path is a
// dashed line connecting 4 numbered markers; the mascot floats above
// the active marker. The mascot's internal x-translate animates between
// stations via stationXForIndex — this component aligns the marker
// positions to the same x-coordinate system so the mascot always lands
// on top of a marker.
//
// Compact mode shrinks the strip + mascot during in-workout phases so
// the recording surface gets the prime real estate.

import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import Mascot from "@/components/product/workout/Mascot";
import type { ShellStation, SessionPhase } from "@/lib/workout/types";
import type { MascotState } from "@/lib/animations/mascot-state";
import type { MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

function mascotStateForPhase(phase: SessionPhase): MascotState {
  switch (phase) {
    case "walking":
      return "walking-to-next-station";
    case "recording":
      return "at-station-recording";
    case "transcribing":
    case "scoring":
      return "at-station-scoring";
    case "score-reveal":
      return "celebrating-rep";
    case "day-complete":
      return "celebrating-day";
    case "idle":
    case "prompt-selecting":
    case "day-complete-prompt":
    case "graduation-rep":
    case "paused":
    default:
      return "idle";
  }
}

const STATION_COUNT = 4;
const SPACING_PX = 60; // matches stationXForIndex spacing
const PATH_WIDTH_PX = (STATION_COUNT - 1) * SPACING_PX; // 180px

export type MascotPathStripProps = {
  phase: SessionPhase;
  stations: ShellStation[];
  currentStationIndex: number;
  dim: MuscleGroupId | null;
  lastScore: number | null;
  /** Compact mode: shrinks strip height + mascot size for in-workout
   *  phases. Default false (full landing-screen height). */
  compact?: boolean;
  /** Optional override of the mascot state derived from `phase`. Used
   *  by the shell to flash a `flexing` ready-stance during the
   *  Start-tap → first-prompt transition. */
  forceMascotState?: MascotState | null;
};

export default function MascotPathStrip({
  phase,
  stations,
  currentStationIndex,
  dim,
  lastScore,
  compact = false,
  forceMascotState,
}: MascotPathStripProps) {
  const mascotState = useMemo(
    () => forceMascotState ?? mascotStateForPhase(phase),
    [phase, forceMascotState],
  );

  // Default 4-station fill when no day yet (landing pre-Start CTA).
  const slots: (ShellStation | null)[] = useMemo(() => {
    const out: (ShellStation | null)[] = Array(STATION_COUNT).fill(null);
    stations.forEach((s, i) => {
      if (i < STATION_COUNT) out[i] = s;
    });
    return out;
  }, [stations]);

  const heightPx = compact ? 140 : 240;
  const mascotSize = compact ? 110 : 170;
  // Mascot vertical sits just above the path line.
  const mascotBottomPx = compact ? 56 : 76;

  return (
    <div
      className={cn(
        "relative w-full select-none",
        "transition-[height] duration-300",
      )}
      style={{ height: heightPx }}
      data-mascot-strip
      data-compact={compact ? "true" : "false"}
    >
      {/* Dashed path — segmented BETWEEN markers (not through them).
          Each segment spans the gap between consecutive marker centers
          with a 22px clearance so the dashes never touch the markers. */}
      <div
        className="absolute inset-x-0 flex justify-center pointer-events-none"
        style={{ bottom: 38 }}
      >
        <svg
          width={PATH_WIDTH_PX + 32}
          height="6"
          viewBox={`0 0 ${PATH_WIDTH_PX + 32} 6`}
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => {
            const startCenter = 16 + i * SPACING_PX;
            const endCenter = 16 + (i + 1) * SPACING_PX;
            return (
              <line
                key={i}
                x1={startCenter + 22}
                y1="3"
                x2={endCenter - 22}
                y2="3"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="2"
                strokeDasharray="3 4"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>

      {/* Station markers — laid out at the same x positions the mascot
          translates to (stationXForIndex spacing). */}
      <div
        className="absolute inset-x-0 flex justify-center"
        style={{ bottom: 20 }}
      >
        <div
          className="relative"
          style={{ width: PATH_WIDTH_PX + 32, height: 40 }}
        >
          {slots.map((station, i) => (
            <StationMarker
              key={i}
              index={i}
              station={station}
              active={i === currentStationIndex}
              dim={dim}
              compact={compact}
              style={{
                position: "absolute",
                left: 16 + i * SPACING_PX,
                bottom: 0,
                transform: "translateX(-50%)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Mascot — internal x-translate aligns it with the active marker. */}
      <div
        className="absolute inset-x-0 flex items-end justify-center pointer-events-none"
        style={{ bottom: mascotBottomPx }}
      >
        <Mascot
          state={mascotState}
          targetStationIndex={currentStationIndex}
          totalStations={STATION_COUNT}
          lastScore={lastScore}
          dim={dim}
          size={mascotSize}
        />
      </div>
    </div>
  );
}

function StationMarker({
  index,
  station,
  active,
  dim,
  compact,
  style,
}: {
  index: number;
  station: ShellStation | null;
  active: boolean;
  dim: MuscleGroupId | null;
  compact: boolean;
  style: React.CSSProperties;
}) {
  const status = station?.status ?? "locked";
  const size = compact ? 26 : 34;
  const fontSize = compact ? 11 : 13;

  // Color scheme — active marker glows in dim color, complete is filled,
  // current is highlighted with ring, locked is muted.
  const dimColor = dim ? DIM_COLORS[dim] : "#cbd5e1";
  const isComplete = status === "complete";
  const isCurrent = active || status === "current";

  return (
    <motion.div
      style={style}
      animate={{
        scale: isCurrent ? 1.08 : 1,
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-semibold text-white",
          "border-2 transition-colors",
          // Opaque bg on every variant — keeps the dashed path from
          // bleeding through the marker.
          isComplete
            ? "border-emerald-300/80 bg-emerald-500/40"
            : isCurrent
              ? "bg-slate-900"
              : "bg-slate-900 border-slate-700",
        )}
        style={{
          width: size,
          height: size,
          fontSize,
          ...(isCurrent && !isComplete
            ? { borderColor: dimColor, boxShadow: `0 0 16px ${dimColor}55` }
            : {}),
        }}
        aria-label={
          station
            ? `Station ${index + 1}: ${station.exerciseName} — ${status}`
            : `Station ${index + 1}: locked`
        }
      >
        {isComplete ? (
          <Check className="w-3.5 h-3.5 text-emerald-100" />
        ) : station ? (
          <span>{index + 1}</span>
        ) : (
          <Lock className="w-3 h-3 text-slate-500" />
        )}
      </div>
    </motion.div>
  );
}

// Dim → marker glow color. Brighter / more saturated than the HEADBAND
// map because these are small UI elements not character art.
const DIM_COLORS: Record<MuscleGroupId, string> = {
  clarity: "#60a5fa",
  structure: "#a78bfa",
  conciseness: "#f472b6",
  thinking_quality: "#c084fc",
  pacing: "#34d399",
  tone: "#fbbf24",
};
