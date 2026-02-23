import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RepHistoryPage } from "../v2/components/tryitout/RepHistoryPage";
import type { RepRow } from "../v2/components/tryitout/ResultsScreen";
import { supabase } from "../../lib/supabase";

interface HistoryPageProps {}

export function HistoryPage() {
  const navigate = useNavigate();
  const [reps, setReps] = useState<RepRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReps = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reps")
        .select(`
          *,
          delivery_scores (*)
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReps(data as RepRow[]);
      }

      setLoading(false);
    };

    loadReps();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <RepHistoryPage
        reps={reps}
        onBack={() => navigate("/app")}
        onRepClick={(repId) => navigate(`/app/reps/${repId}`)}
      />
    </div>
  );
}
