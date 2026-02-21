import { Target } from "lucide-react";

export function Step4NextFocus() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                <Target className="w-5 h-5 text-[#9D7BF5]" />
                <h3 className="text-lg font-semibold">Before Your Next Rep</h3>
              </div>

              <div className="space-y-5">
                <div className="p-5 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl border-2 border-[#9D7BF5]/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">Your Primary Focus</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Simplify your language — avoid jargon and over-complex phrasing
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Previous Rep Score
                  </h4>
                  <div className="text-2xl font-bold text-gray-400">73/100</div>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    The primary improvement focus from the previous rep appears clearly before you start recording again.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button className="w-full py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all">
                  Start Next Rep
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-full border border-[#9D7BF5]/20">
              <span className="text-sm font-bold text-gray-700">Step 4</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Apply the Next Improvement Focus
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Before the next recording starts, the primary improvement focus from the previous rep appears clearly on screen.
            </p>

            <div className="space-y-4 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                You are reminded exactly what to improve before speaking again.
              </p>

              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-700 leading-relaxed">
                  This keeps training tight:
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span>Rep</span>
                  <span className="text-gray-400">→</span>
                  <span>Feedback</span>
                  <span className="text-gray-400">→</span>
                  <span>Focus</span>
                  <span className="text-gray-400">→</span>
                  <span>Next Rep</span>
                </div>
              </div>

              <p className="text-sm text-gray-500 italic pt-4">
                No overwhelm. Just progression.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
