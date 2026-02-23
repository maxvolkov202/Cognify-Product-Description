import { Target, TrendingUp } from "lucide-react";

interface RepTypeIndicatorProps {
  repType: "cold-start" | "improvement" | "continuation";
}

export function RepTypeIndicator({ repType }: RepTypeIndicatorProps) {
  const isColdStart = repType === "cold-start";
  const isContinuation = repType === "continuation";

  return (
    <div className={`rounded-lg border-2 p-3 ${
      isColdStart 
        ? "bg-blue-50 border-blue-200" 
        : "bg-green-50 border-green-200"
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isColdStart 
            ? "bg-blue-100" 
            : "bg-green-100"
        }`}>
          {isColdStart ? (
            <Target className="w-4 h-4 text-blue-600" />
          ) : (
            <TrendingUp className="w-4 h-4 text-green-600" />
          )}
        </div>
        <div className="flex-1">
          <p className={`text-xs font-bold ${
            isColdStart ? "text-blue-900" : "text-green-900"
          }`}>
            {isColdStart ? "Cold Start" : isContinuation ? "Continuation" : "Improvement Rep"}
          </p>
          <p className={`text-[11px] leading-tight ${
            isColdStart ? "text-blue-700" : "text-green-700"
          }`}>
            {isColdStart 
              ? "First attempt—establish baseline" 
              : "Apply feedback from previous rep"}
          </p>
        </div>
      </div>
    </div>
  );
}
