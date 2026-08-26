"use client";

import { createContext, useContext } from "react";
import type { Callout, SkillDimension } from "@/types/domain";

type AudioControl = {
  /** Whether rep audio is actually available to seek. The provider being
   *  mounted is NOT the same question: FeedbackPanel mounts this provider
   *  unconditionally but only renders the <audio> element when it has an
   *  audioUrl, so inferring availability from provider presence would
   *  render a seek button whose handler no-ops. Providers pass the SAME
   *  condition that gates their audio element. */
  hasAudio: boolean;
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
      hasAudio: false,
      seekToMs: () => {},
      expandDimension: () => {},
      getCalloutId: () => null,
    };
  }
  return ctx;
}

/** True when rep audio is actually seekable — consumers use this to HIDE
 *  seek affordances instead of rendering a silently dead button (e.g. the
 *  Improvement Review's grid has its own scrubbers and no provider, and a
 *  feedback panel for a rep whose audio never uploaded has a provider but
 *  no audio element). No provider means no audio, so the null case is
 *  false rather than a default of true. */
export function useHasAudioControl(): boolean {
  return useContext(AudioControlContext)?.hasAudio ?? false;
}
