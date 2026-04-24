"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SkillDimension } from "@/types/domain";

type SkillsFocus = {
  primary: SkillDimension | null;
  secondary: readonly SkillDimension[];
};

type ContextShape = {
  focus: SkillsFocus;
  setFocus: (next: SkillsFocus | null) => void;
};

const EMPTY_FOCUS: SkillsFocus = { primary: null, secondary: [] };

const SkillsFocusContext = createContext<ContextShape>({
  focus: EMPTY_FOCUS,
  setFocus: () => undefined,
});

/**
 * Provider mounted in the (app) layout so SixSkillsBar reads focus
 * state from anywhere in the tree. WorkoutSession / RepSurface update
 * the focus when an active rep's dims should be emphasized on the bar.
 */
export function SkillsFocusProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocusState] = useState<SkillsFocus>(EMPTY_FOCUS);

  const value = useMemo<ContextShape>(
    () => ({
      focus,
      setFocus: (next) => setFocusState(next ?? EMPTY_FOCUS),
    }),
    [focus],
  );

  return (
    <SkillsFocusContext.Provider value={value}>
      {children}
    </SkillsFocusContext.Provider>
  );
}

export function useSkillsFocus(): ContextShape {
  return useContext(SkillsFocusContext);
}

/**
 * Declarative helper: child components render this to set focus for
 * the lifetime of their mount. Cleans up on unmount so we don't leak
 * stale focus into later screens.
 *
 * Usage: <SkillsFocusScope primary="clarity" secondary={["structure"]} />
 */
export function SkillsFocusScope({
  primary,
  secondary,
}: {
  primary: SkillDimension | null;
  secondary?: readonly SkillDimension[];
}) {
  const { setFocus } = useSkillsFocus();
  const secondaryKey = (secondary ?? []).join(",");
  // Set on mount, clear on unmount. Re-runs when primary or secondary
  // changes so nested workouts that flip between rep types carry their
  // current rep's focus onto the bar.
  useEffect(() => {
    setFocus({ primary, secondary: secondary ?? [] });
    return () => setFocus(null);
    // secondaryKey captures the array identity; stringifying it is
    // simpler than a deep-compare ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary, secondaryKey]);

  return null;
}
