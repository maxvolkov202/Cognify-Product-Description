// Reducer for the PromptPicker UI state. Pure functions so the picker
// can be unit-tested without a DOM. Phase 6.

import type { PromptCandidate } from "@/server/actions/prompt-selection";

export type PickerTab = "shuffle" | "list" | "surprise";

export type PickerState = {
  tab: PickerTab;
  shuffleCandidates: PromptCandidate[];
  surprise: PromptCandidate | null;
  reshuffles: number;
  reshuffleUsed: boolean; // one free reshuffle per visit
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
  | { type: "SET_TAB"; tab: PickerTab }
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
        reshuffleUsed: false,
        selectedPromptId: null,
        startedAt: Date.now(),
      };
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "RESHUFFLE":
      return {
        ...state,
        shuffleCandidates: action.candidates,
        surprise: action.surprise,
        reshuffles: state.reshuffles + 1,
        reshuffleUsed: true,
      };
    case "SELECT":
      return { ...state, selectedPromptId: action.promptId };
  }
}

export function initialPickerState(): PickerState {
  return {
    tab: "shuffle",
    shuffleCandidates: [],
    surprise: null,
    reshuffles: 0,
    reshuffleUsed: false,
    selectedPromptId: null,
    startedAt: Date.now(),
  };
}
