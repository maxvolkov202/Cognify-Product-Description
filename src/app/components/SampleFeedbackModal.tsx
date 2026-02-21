import { X, TrendingUp, AlertCircle } from "lucide-react";

interface SampleFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SampleFeedbackModal({ isOpen, onClose }: SampleFeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Sample Feedback Analysis</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overall Score */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-baseline gap-2">
              <span className="text-6xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">
                74
              </span>
              <span className="text-2xl font-semibold text-gray-400">/100</span>
            </div>
            <p className="text-sm text-gray-600">
              Strong opening, but structure weakened in the middle section.
            </p>
          </div>

          {/* 5 Skill Breakdown */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
              Communication Dimensions
            </h4>
            <div className="space-y-4">
              {/* Clarity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Clarity</span>
                  <span className="text-sm font-bold text-gray-700">82/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" 
                    style={{ width: '82%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  Main point was clear, but some transitions were vague.
                </p>
              </div>

              {/* Structure */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Structure</span>
                  <span className="text-sm font-bold text-gray-700">68/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" 
                    style={{ width: '68%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  You jumped from Context to Impact, skipping Decision entirely.
                </p>
              </div>

              {/* Specificity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Specificity</span>
                  <span className="text-sm font-bold text-gray-700">71/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" 
                    style={{ width: '71%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  Used "a few issues" instead of quantifying the problem.
                </p>
              </div>

              {/* Pacing */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Pacing</span>
                  <span className="text-sm font-bold text-gray-700">76/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" 
                    style={{ width: '76%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  Good overall tempo, but rushed through key impact points.
                </p>
              </div>

              {/* Presence */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Presence</span>
                  <span className="text-sm font-bold text-gray-700">73/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" 
                    style={{ width: '73%' }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 leading-tight">
                  Confident opening, but hesitation appeared around 35s mark.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Focus */}
          <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-5 border-2 border-[#9D7BF5]/40">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide">
                  Your Next Focus
                </h4>
                <p className="text-base font-bold text-gray-900 leading-tight">
                  Complete the framework structure
                </p>
                <div className="bg-white rounded-lg p-3 border border-[#9D7BF5]/30">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    On your next rep:
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Explicitly state "Here's what we decided" before moving to impact. Don't assume the listener can infer the decision.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Diagnostics */}
          <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Critical Diagnostics
                </h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0 mt-1.5"></span>
                    <p className="leading-relaxed">
                      <span className="font-semibold">Filler words:</span> 7 instances ("um", "like", "you know")
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0 mt-1.5"></span>
                    <p className="leading-relaxed">
                      <span className="font-semibold">Framework coverage:</span> 67% — Decision step was omitted
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0 mt-1.5"></span>
                    <p className="leading-relaxed">
                      <span className="font-semibold">Time usage:</span> 54 of 60 seconds — consider using full time to add depth
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0 mt-1.5"></span>
                    <p className="leading-relaxed">
                      <span className="font-semibold">No actionable closing:</span> Response ended abruptly without clear takeaway
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              This is a sample analysis. Real feedback adapts to your transcript and chosen framework.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
