"use client";

// Theme provider — manages the cognify:theme localStorage key and toggles
// the .dark class on <html>. Marketing routes are excluded; the inline
// no-flash script in src/app/layout.tsx is the single source of truth for
// which routes participate in dark mode.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
};

const STORAGE_KEY = "cognify:theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable — fall through.
  }
  return "light";
}

function applyResolved(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Hydrate from storage on mount. The inline script in root layout has
  // already set the html class — this just syncs React state with it.
  useEffect(() => {
    const stored = readStoredPreference();
    setPreferenceState(stored);
    const r = resolveTheme(stored);
    setResolved(r);
    applyResolved(r);
  }, []);

  // Watch system preference when set to "system" so OS-level changes
  // propagate without a reload.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      applyResolved(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore quota / private mode
    }
    const r = resolveTheme(next);
    setResolved(r);
    applyResolved(r);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Allow components outside the provider (marketing pages, public
    // routes) to call useTheme without throwing — they get a no-op shape
    // that always reports light. Settings + app surfaces re-render
    // correctly because they live under the provider.
    return {
      preference: "light",
      resolved: "light",
      setPreference: () => {},
    };
  }
  return ctx;
}
