import { useState, useEffect } from "react";
import { Search, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

interface AnalyzingScreenProps {
  repNumber: number;
  scenario: string;
  onReturnToSetup?: () => void;
}

const analysisSteps = [
  { label: "Detecting structure...", delay: 0 },
  { label: "Checking clarity + simplicity...", delay: 800 },
  { label: "Measuring pacing + delivery...", delay: 1600 },
  { label: "Generating next focus...", delay: 2400 }
];

export function AnalyzingScreen({ repNumber, scenario, onReturnToSetup }: AnalyzingScreenProps) {
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [showReturnButton, setShowReturnButton] = useState(false);

  useEffect(() => {
    // Animate through analysis steps
    analysisSteps.forEach((step, index) => {
      setTimeout(() => {
        setCompletedSteps(index + 1);
      }, step.delay);
    });

    // Show return button after 3 seconds
    setTimeout(() => {
      setShowReturnButton(true);
    }, 3000);
  }, []);

  return (
    <section className="py-8 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Analyzing your rep...</h2>
              <p className="text-gray-600">Scoring content + delivery</p>
            </div>

            {/* Analysis Checklist */}
            <div className="space-y-3 py-4">
              {analysisSteps.map((step, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 transition-all ${
                    completedSteps > index ? "opacity-100" : "opacity-40"
                  }`}
                >
                  {completedSteps > index ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-[#9D7BF5] animate-spin flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    completedSteps > index ? "text-gray-900 font-medium" : "text-gray-600"
                  }`}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Step indicator */}
            <div className="text-center">
              <p className="text-xs text-gray-500">Step 2 of 2: Analyzing...</p>
            </div>

            {/* Rep Info */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                Rep {repNumber}: {scenario}
              </p>
            </div>

            {/* Notice */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Almost done — results loading soon
              </p>
            </div>

            {/* Return Button (appears after 3s) */}
            {showReturnButton && onReturnToSetup && (
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={onReturnToSetup}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Rep Setup
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
