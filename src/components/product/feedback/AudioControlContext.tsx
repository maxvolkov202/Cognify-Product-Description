"use client";

import { createContext, useContext } from "react";
import type { Callout, SkillDimension } from "@/types/domain";

type AudioControl = {
  /** Seek the rep audio to the given millisecond and play. */
  seekToMs: (ms: number) => void;
  /** Open the matching DimensionCard inline (single-open accordion) and
   *  scroll the grid into view. Called by feedback drill-in links. */
  expandDimension: (dim: SkillDimension | "structural_adherence") => void;
  /** Resolve a callout instance back to its persisted DB id. Returns null
   *  when the rep wasn't saved (guest, DB down) — consumers should hide
   *  the correction UI in that case. */
  getCalloutId: (callout: Callout) => string | null;
};

const AudioControlContext = createContext<AudioControl | null>(null);

export function AudioControlProvider({
  value,
  children,
}: {
  value: AudioControl;
  children: React.ReactNode;
}) {
  return (
    <AudioControlContext.Provider value={value}>
      {children}
    </AudioControlContext.Provider>
  );
}

export function useAudioControl(): AudioControl {
  const ctx = useContext(AudioControlContext);
  if (!ctx) {
    return {
      seekToMs: () => {},
      expandDimension: () => {},
      getCalloutId: () => null,
    };
  }
  return ctx;
}
