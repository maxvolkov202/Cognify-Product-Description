"use client";

import { useEffect, useState } from "react";

/**
 * localStorage-backed draft for onboarding selections. The server source of
 * truth is still the `users` row, but a user who closes the tab mid-flow
 * should resume with their in-progress selection instead of starting over.
 *
 * Cleared by `clearOnboardingDraft()` once `completeOnboardingAction`
 * succeeds.
 */

const KEY = "cognify:onboarding-draft-v1";

export type OnboardingDraft = {
  vertical?: string;
  personas?: string[];
  improvementGoals?: string[];
  /** ms since epoch for freshness check. */
  updatedAt?: number;
};

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readDraft(): OnboardingDraft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (
      parsed.updatedAt &&
      Date.now() - parsed.updatedAt > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(KEY);
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeDraft(patch: Partial<OnboardingDraft>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readDraft();
    const next: OnboardingDraft = {
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / disabled-storage errors. Draft is a nice-to-have.
  }
}

export function clearOnboardingDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Hook: reads the draft's value for a single field on mount, writes back
 * when the local state changes. Generic over the field's value type.
 */
export function useOnboardingDraft<
  K extends keyof OnboardingDraft,
  V extends OnboardingDraft[K],
>(field: K, initial: V): [V, (next: V) => void] {
  const [value, setValue] = useState<V>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    const draft = readDraft();
    const saved = draft[field];
    if (saved !== undefined) {
      setValue(saved as V);
    }
    setHydrated(true);
  }, [field]);

  const update = (next: V) => {
    setValue(next);
    writeDraft({ [field]: next } as Partial<OnboardingDraft>);
  };

  // Return the hydrated state; caller should treat pre-hydration state as
  // the provided initial — cheap enough that we don't block render.
  return [hydrated ? value : initial, update];
}
