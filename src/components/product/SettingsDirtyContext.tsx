"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Resolver = "save" | "discard" | "stay";

type Pending = {
  href: string;
  resolve: (action: Resolver) => void;
};

type DirtyContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Register a save handler. Called with the current draft when the
   *  user picks "Save & continue" in the leave prompt. Returns ok flag. */
  setSaveHandler: (fn: (() => Promise<boolean>) | null) => void;
  /** Register a discard handler. Called when the user picks "Discard". */
  setDiscardHandler: (fn: (() => void) | null) => void;
  /** Pending navigation, surfaced to a top-level modal. */
  pending: Pending | null;
  /** Called by AppNav links when the user attempts to leave while dirty. */
  guardNavigation: (href: string) => Promise<boolean>;
  /** Modal calls this when the user picks an action. */
  resolvePending: (action: Resolver) => void;
};

const DirtyContext = createContext<DirtyContextValue | null>(null);

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);
  const discardHandlerRef = useRef<(() => void) | null>(null);

  const setSaveHandler = useCallback((fn: (() => Promise<boolean>) | null) => {
    saveHandlerRef.current = fn;
  }, []);
  const setDiscardHandler = useCallback((fn: (() => void) | null) => {
    discardHandlerRef.current = fn;
  }, []);

  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  // Browser close / refresh / cross-origin navigation — the browser shows a
  // native confirm; we can't render the brand modal here.
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const guardNavigation = useCallback(
    (href: string): Promise<boolean> => {
      if (!isDirty) return Promise.resolve(true);
      return new Promise<boolean>((resolveOuter) => {
        setPending({
          href,
          resolve: (action) => {
            setPending(null);
            if (action === "stay") {
              resolveOuter(false);
              return;
            }
            if (action === "save") {
              const handler = saveHandlerRef.current;
              if (!handler) {
                resolveOuter(true);
                return;
              }
              handler()
                .then((ok) => {
                  if (ok) {
                    setIsDirty(false);
                    resolveOuter(true);
                  } else {
                    // Save failed; don't navigate.
                    resolveOuter(false);
                  }
                })
                .catch(() => resolveOuter(false));
              return;
            }
            // discard
            const dh = discardHandlerRef.current;
            if (dh) dh();
            setIsDirty(false);
            resolveOuter(true);
          },
        });
      });
    },
    [isDirty],
  );

  const resolvePending = useCallback(
    (action: Resolver) => {
      pending?.resolve(action);
    },
    [pending],
  );

  const value = useMemo<DirtyContextValue>(
    () => ({
      isDirty,
      setDirty,
      setSaveHandler,
      setDiscardHandler,
      pending,
      guardNavigation,
      resolvePending,
    }),
    [
      isDirty,
      setDirty,
      setSaveHandler,
      setDiscardHandler,
      pending,
      guardNavigation,
      resolvePending,
    ],
  );

  return <DirtyContext.Provider value={value}>{children}</DirtyContext.Provider>;
}

export function useSettingsDirty() {
  return useContext(DirtyContext);
}
