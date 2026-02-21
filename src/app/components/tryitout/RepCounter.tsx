import { Hash } from "lucide-react";

interface RepCounterProps {
  repNumber: number;
  variant?: "default" | "compact";
}

export function RepCounter({ repNumber, variant = "default" }: RepCounterProps) {
  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg border border-[#9D7BF5]/30">
        <Hash className="w-4 h-4 text-[#9D7BF5]" />
        <span className="text-sm font-semibold text-gray-900">
          Rep {repNumber}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-2xl p-1">
      <div className="bg-white rounded-xl px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <Hash className="w-6 h-6 text-[#9D7BF5]" />
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Current Rep</p>
            <p className="text-3xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">
              {repNumber}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
