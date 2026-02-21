import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import type { Rep } from "../app/types/rep";

function mapRepRow(row: Record<string, unknown>): Rep {
  return {
    ...row,
    completedAt: new Date(
      (row.completed_at as string) ?? (row.completedAt as string) ?? (row.created_at as string) ?? Date.now()
    ),
  } as Rep;
}

async function fetchRepsForUser(userId: string): Promise<Rep[]> {
  const { data, error } = await supabase
    .from("reps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []).map((row: Record<string, unknown>) => mapRepRow(row));
}

interface RepsContextValue {
  repHistory: Rep[];
  refetchReps: () => Promise<void>;
}

const RepsContext = createContext<RepsContextValue | undefined>(undefined);

export function RepsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [repHistory, setRepHistory] = useState<Rep[]>([]);

  const refetchReps = useCallback(async () => {
    if (!session?.user?.id) {
      setRepHistory([]);
      return;
    }
    const reps = await fetchRepsForUser(session.user.id);
    setRepHistory(reps);
  }, [session?.user?.id]);

  useEffect(() => {
    refetchReps();
  }, [refetchReps]);

  const value: RepsContextValue = { repHistory, refetchReps };
  return <RepsContext.Provider value={value}>{children}</RepsContext.Provider>;
}

export function useReps() {
  const context = useContext(RepsContext);
  if (context === undefined) {
    throw new Error("useReps must be used within a RepsProvider");
  }
  return context;
}
