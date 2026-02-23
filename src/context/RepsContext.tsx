import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import type { Rep } from "../app/types/rep";

function mapRepRow(row: Record<string, unknown>): Rep {
  const {
    detailedScores,
    analysis,
    feedback,
    specificity,
    pacing,
    presence,
    ...rest
  } = row;
  const overallScore = row.overall_score != null ? Number(row.overall_score) : undefined;
  const deliveryScore = row.delivery_score != null ? Number(row.delivery_score) : undefined;
  const contentScore = row.content_score != null ? Number(row.content_score) : undefined;
  return {
    ...rest,
    completedAt: new Date(
      (row.completed_at as string) ?? (row.completedAt as string) ?? (row.created_at as string) ?? Date.now()
    ),
    overall_score: overallScore,
    delivery_score: deliveryScore,
    content_score: contentScore,
    clarityScore: overallScore ?? 0,
  } as Rep;
}

async function fetchRepsForUser(userId: string): Promise<Rep[]> {
  const { data, error } = await supabase
    .from("reps")
    .select("*, delivery_scores(pace, clarity, filler_words, confidence, pauses, tone, overall_delivery)")
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
    if (session?.user?.id) {
      refetchReps();
    }
  }, [session?.user?.id, refetchReps]);
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
