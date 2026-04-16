"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type RepStatus = "pending" | "processing" | "completed" | "failed";

export type RepStatusState = {
  status: RepStatus | null;
  composite: number | null;
  error: string | null;
};

/**
 * Subscribe to a single rep's status changes via Supabase Realtime.
 * Pattern adopted from CTO's v1 (ResultsScreen.tsx:122-155). Requires
 * RLS policy on cognify_v2.reps allowing the authenticated user to
 * SELECT their own rows.
 *
 * Usage:
 *   const { status, composite } = useRepStatus(repId);
 *   if (status === "completed") renderResults();
 *
 * Returns { status: null } when repId is null/undefined (async path
 * not active). Caller should fall back to sync results in that case.
 */
export function useRepStatus(repId: string | null | undefined): RepStatusState {
  const [state, setState] = useState<RepStatusState>({
    status: null,
    composite: null,
    error: null,
  });

  useEffect(() => {
    if (!repId) {
      setState({ status: null, composite: null, error: null });
      return;
    }

    const supabase = createSupabaseBrowserClient();

    // Initial fetch — in case the rep already completed before we
    // subscribed.
    supabase
      .schema("cognify_v2")
      .from("reps")
      .select("status, composite_score")
      .eq("id", repId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setState({
            status: data.status as RepStatus,
            composite: data.composite_score,
            error: null,
          });
        }
      });

    const channel = supabase
      .channel(`rep-${repId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "cognify_v2",
          table: "reps",
          filter: `id=eq.${repId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            status: RepStatus;
            composite_score: number | null;
          };
          setState({
            status: newRow.status,
            composite: newRow.composite_score,
            error:
              newRow.status === "failed"
                ? "Scoring failed — tap retry."
                : null,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [repId]);

  return state;
}
