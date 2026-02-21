import { TrendingUp, Hash, Loader2 } from "lucide-react";

interface SessionProgressProps {
  repsCompleted: number;
  isProcessing?: boolean;
}

export function SessionProgress({ repsCompleted, isProcessing = false }: SessionProgressProps) {
  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-[#9D7BF5]" />
          <div>
            <p className="text-xs text-gray-500">Session Reps</p>
            <p className="text-lg font-bold text-gray-900">{repsCompleted}</p>
          </div>
        </div>
        
        {isProcessing && (
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
            <Loader2 className="w-5 h-5 text-[#9D7BF5] animate-spin" />
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium text-[#9D7BF5]">Processing</p>
            </div>
          </div>
        )}
        
        {!isProcessing && repsCompleted > 0 && (
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-gray-500">Momentum</p>
              <p className="text-lg font-bold text-green-600">
                {repsCompleted >= 5 ? "Strong" : repsCompleted >= 3 ? "Building" : "Starting"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
