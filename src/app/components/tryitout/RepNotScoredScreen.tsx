import { AlertCircle, Volume2, RotateCcw, X, Check } from "lucide-react";

interface RepNotScoredScreenProps {
  failureReasons: string[];
  onRetry: () => void;
  onListenBack: () => void;
  onExit: () => void;
}

export function RepNotScoredScreen({
  failureReasons,
  onRetry,
  onListenBack,
  onExit
}: RepNotScoredScreenProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="bg-white rounded-2xl border-2 border-amber-200 p-8 shadow-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Rep Not Scored</h2>
          <p className="text-gray-600">
            We couldn't grade this accurately yet. Here's what we detected:
          </p>
        </div>

        {/* Quality Checklist */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Quality Check</h3>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-sm text-gray-700">Recorded audio</span>
            </div>
            
            {failureReasons.map((reason, index) => (
              <div key={index} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-xs font-bold text-gray-900 mb-2">💡 Tips for Next Rep</h3>
          <ul className="space-y-1.5 text-xs text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#9D7BF5] font-bold">•</span>
              <span>Speak for 30-60 seconds to allow proper scoring</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#9D7BF5] font-bold">•</span>
              <span>Follow the framework structure step-by-step</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#9D7BF5] font-bold">•</span>
              <span>Minimize filler words — pause instead of "um"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#9D7BF5] font-bold">•</span>
              <span>Include concrete examples and numbers</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onRetry}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Retry Now
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onListenBack}
              className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all inline-flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              Listen Back
            </button>
            <button
              onClick={onExit}
              className="px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
