import { useNavigate } from "react-router-dom";
import { RepHistoryPage } from "../v2/components/tryitout/RepHistoryPage";
import { Rep } from "../types/rep";

interface HistoryPageProps {
  reps: Rep[];
}

export function HistoryPage({ reps }: HistoryPageProps) {
  const navigate = useNavigate();

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
