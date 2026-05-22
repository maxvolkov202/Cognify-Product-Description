// Reducer for the PromptPicker UI state. Pure functions so the picker
// can be unit-tested without a DOM. Phase 6.

import type { PromptCandidate } from "@/server/actions/prompt-selection";

export type PickerState = {
  shuffleCandidates: PromptCandidate[];
  surprise: PromptCandidate | null;
  /** Bumped every time the user cycles. Persisted onto the
   *  prompt_selection_events row for telemetry. */
  reshuffles: number;
  selectedPromptId: string | null;
  /** ms-since-open when the user selects (or when auto_idle fires). */
  startedAt: number;
};

export type PickerAction =
  | {
      type: "INIT";
      candidates: PromptCandidate[];
      surprise: PromptCandidate | null;
    }
  | {
      type: "RESHUFFLE";
      candidates: PromptCandidate[];
      surprise: PromptCandidate | null;
    }
  | { type: "SELECT"; promptId: string };

export function pickerReducer(
  state: PickerState,
  action: PickerAction,
): PickerState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        shuffleCandidates: action.candidates,
        surprise: action.surprise,
        reshuffles: 0,
        selectedPromptId: null,
        startedAt: Date.now(),
      };
    case "RESHUFFLE":
      return {
        ...state,
        shuffleCandidates: action.candidates,
        surprise: action.surprise,
        reshuffles: state.reshuffles + 1,
      };
    case "SELECT":
      return { ...state, selectedPromptId: action.promptId };
  }
}

export function initialPickerState(): PickerState {
  return {
    shuffleCandidates: [],
    surprise: null,
    reshuffles: 0,
    selectedPromptId: null,
    startedAt: Date.now(),
  };
}
