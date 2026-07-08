"use client";

// Phase D — MediaSession lock-screen integration for the muscle-group
// workout. Sets navigator.mediaSession.metadata while a workout day is
// active so Android Chrome / Edge / desktop browsers display the
// "Workout · {Dim} Day · Rep N of 4" card.
//
// iOS Safari requires an active audio element with playback to honor
// MediaSession metadata. We do not attach a silent-audio hack here —
// the recording flow occupies the microphone and adding playback would
// fight for audio focus. Treat iOS lock-screen integration as
// best-effort; Android/desktop see the card, iOS does not.
//
// The hook clears metadata on unmount / inactive state so the card
// doesn't linger after the user leaves the workout.

import { useEffect } from "react";
import { MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";

export type UseMediaSessionInput = {
  /** Active = a workout day is open (between station 0 and complete).
   *  False clears the metadata so the lock screen doesn't keep showing
   *  a stale "Rep N of 4" after the user closes the day. */
  active: boolean;
  dim: MuscleGroupId | null;
  /** 0-based — the station currently in focus / recording. */
  stationIndex: number;
  totalStations: number;
};

export function useMediaSession({
  active,
  dim,
  stationIndex,
  totalStations,
}: UseMediaSessionInput): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ms = navigator.mediaSession;
    if (!ms) return;

    if (!active || !dim) {
      ms.metadata = null;
      return;
    }

    const dimLabel = MUSCLE_GROUP_LABELS[dim] ?? dim;
    const title = `${dimLabel} Day`;
    const artist = `Rep ${Math.min(stationIndex + 1, totalStations)} of ${totalStations}`;
    try {
      ms.metadata = new MediaMetadata({
        title,
        artist,
        album: "Cognify · Workout",
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    } catch {
      // MediaMetadata constructor unavailable (Firefox before 71, some
      // mobile browsers). Silent — feature is best-effort.
    }

    return () => {
      ms.metadata = null;
    };
  }, [active, dim, stationIndex, totalStations]);
}
