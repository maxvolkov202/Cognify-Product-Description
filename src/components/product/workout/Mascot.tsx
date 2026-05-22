"use client";

// Mascot — the React wrapper for the Workout-shell brain mascot.
//
// Phase 4. Sits inside Phase 5's MascotStage component (top half of the
// workout shell), positioned above the StationStrip. The session runtime
// (Phase 7) drives the `state` and `targetStationIndex` props; everything
// else is presentational.
//
// Contract surface:
//   • `state` — discrete mascot state; see MASCOT_STATES.
//   • `targetStationIndex` — which station (0..3) the mascot should be
//      standing at. When this changes while state is walking, the wrapper
//      animates the outer translate over MASCOT_TIMINGS.walk_ms.
//   • `lastScore` — composite from the most recent rep; drives the
//      celebrating-rep intensity branch.
//   • `dim` — current muscle group; drives the headband color.
//   • `onTap` — optional. When provided, the whole mascot becomes a
//      tap-target (>=44pt) for Phase 4's Easter-egg hook.
//   • `onStateTransition` — fired after each state change for telemetry
//      (Phase 4 spec: `mascot.state_transition` events).
//
// Reduced-motion behavior: when matchMedia('(prefers-reduced-motion:
// reduce)') matches, the wrapper renders MascotFallback instead — still
// frames + opacity cross-fade, no transform animation. The mascot still
// switches faces/positions; it just doesn't move.

import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  MASCOT_ARIA_LABELS,
  MASCOT_TIMINGS,
  scoreBandFor,
  type MascotState,
} from "@/lib/animations/mascot-state";
import type { MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";
import MascotCharacter from "./mascot/MascotCharacter";
import MascotFallback from "./mascot/MascotFallback";
import { stationXForIndex } from "./mascot/variants";

export type MascotProps = {
  state: MascotState;
  targetStationIndex: number;
  totalStations?: number;
  lastScore?: number | null;
  dim?: MuscleGroupId | null;
  onTap?: () => void;
  onStateTransition?: (event: {
    from: MascotState | null;
    to: MascotState;
    at: number;
  }) => void;
  className?: string;
  /** Override of size in px. Default 160 → mascot scales to viewBox. */
  size?: number;
};

export default function Mascot({
  state,
  targetStationIndex,
  totalStations = 4,
  lastScore,
  dim,
  onTap,
  onStateTransition,
  className,
  size = 160,
}: MascotProps) {
  const prefersReduced = useReducedMotion();
  const liveRegionId = useId();
  const prevStateRef = useRef<MascotState | null>(null);

  // ARIA + telemetry: emit on state changes.
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev !== state) {
      onStateTransition?.({ from: prev, to: state, at: Date.now() });
      prevStateRef.current = state;
    }
  }, [state, onStateTransition]);

  // Reduced-motion path: render the still-frame fallback. It already
  // owns its own ARIA live region and translation handling.
  if (prefersReduced) {
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>
        <MascotFallback
          state={state}
          targetStationIndex={targetStationIndex}
          totalStations={totalStations}
          dim={dim}
          onTap={onTap}
        />
      </div>
    );
  }

  const targetX = stationXForIndex(targetStationIndex, totalStations);
  const scoreBand = scoreBandFor(lastScore ?? null);
  const ariaLabel = MASCOT_ARIA_LABELS[state];

  const interactiveProps = onTap
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: onTap,
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTap();
          }
        },
        // Ensure a 44pt hit area for mobile a11y.
        style: { minWidth: 44, minHeight: 44 },
        "aria-label": "Tap mascot",
      }
    : {};

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center select-none",
        className,
      )}
      data-mascot-mode="animated"
    >
      <div
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {ariaLabel}
      </div>

      <motion.div
        // Outer x translate moves the mascot between stations during walks.
        animate={{ x: targetX }}
        transition={{
          x: {
            duration:
              state === "walking-to-next-station"
                ? MASCOT_TIMINGS.walk_ms / 1000
                : MASCOT_TIMINGS.at_station_settle_ms / 1000,
            ease: state === "walking-to-next-station" ? "easeInOut" : "easeOut",
          },
        }}
        className="inline-flex"
        {...interactiveProps}
      >
        <MascotCharacter
          state={state}
          scoreBand={scoreBand}
          dim={dim}
          width={size * 0.75}
          height={size}
          className="block"
        />
      </motion.div>
    </div>
  );
}
