import { CheckCircle2 } from "lucide-react";

interface ProcessingScreenProps {
  repNumber: number;
  scenario: string;
}

export function ProcessingScreen({ repNumber, scenario }: ProcessingScreenProps) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center space-y-8">
          {/* Success Icon with Gradient Glow */}
          <div className="flex justify-center">
            <div className="relative">
              {/* Pulsing gradient glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full blur-2xl opacity-40 animate-pulse"></div>
              
              {/* Icon */}
              <div className="relative w-24 h-24 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-gray-900">Rep Complete</h2>
            <p className="text-gray-600">
              Analyzing your structure...
            </p>
          </div>

          {/* Loading bar */}
          <div className="max-w-xs mx-auto">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full animate-[loading_1.5s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
