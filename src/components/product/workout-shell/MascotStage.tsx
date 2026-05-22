"use client";

// Top-half wrapper that composes the animated <Mascot> above the
// 4-station strip. The mascot's targetStationIndex follows the session
// reducer's currentStationIndex; the mascot state is derived from the
// session phase by the wrapper (Phase 7 owns the truth source).

import { useMemo } from "react";
import Mascot from "@/components/product/workout/Mascot";
import type {
  ShellStation,
  SessionPhase,
} from "@/lib/workout/types";
import type { MascotState } from "@/lib/animations/mascot-state";
import type { MuscleGroupId } from "@/types/domain";
import StationStrip from "./StationStrip";

/** Map a session phase to the mascot state. Phase 7 will own this
 *  more thoroughly; for Phase 5 we cover the obvious cases. */
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

export type MascotStageProps = {
  phase: SessionPhase;
  stations: ShellStation[];
  currentStationIndex: number;
  dim: MuscleGroupId | null;
  lastScore: number | null;
  onStationFocus?: (index: number) => void;
  onStationActivate?: (index: number) => void;
};

export default function MascotStage({
  phase,
  stations,
  currentStationIndex,
  dim,
  lastScore,
  onStationFocus,
  onStationActivate,
}: MascotStageProps) {
  const mascotState = useMemo(() => mascotStateForPhase(phase), [phase]);

  return (
    <div className="flex flex-col items-center justify-end gap-4 pt-4 pb-2 w-full">
      <div
        className="flex items-end justify-center w-full"
        style={{ minHeight: 180 }}
      >
        <Mascot
          state={mascotState}
          targetStationIndex={currentStationIndex}
          totalStations={stations.length || 4}
          lastScore={lastScore}
          dim={dim}
          size={180}
        />
      </div>
      {stations.length > 0 && dim && (
        <StationStrip
          stations={stations}
          dim={dim}
          onStationFocus={onStationFocus}
          onStationActivate={onStationActivate}
        />
      )}
    </div>
  );
}
