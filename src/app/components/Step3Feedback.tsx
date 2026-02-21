import { CheckCircle, AlertCircle, Clock } from "lucide-react";

export function Step3Feedback() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-full border border-[#9D7BF5]/20">
              <span className="text-sm font-bold text-gray-700">Step 3</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Get High-Precision Feedback
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Immediately after recording, Cognify delivers objective, structured feedback.
            </p>

            <div className="space-y-4 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                You receive:
              </p>
              
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Overall score (1–100)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Breakdown across 5 core skills</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Specific strengths</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Specific misses</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">One primary improvement focus for the next rep</span>
                </li>
              </ul>

              <div className="pt-4 space-y-2">
                <p className="text-base font-semibold text-gray-700">The five grading dimensions:</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>Clarity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>Structure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>Simplicity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>Pacing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                    <span>Confidence</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 italic pt-4">
                Feedback is diagnostic, not motivational.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold">Performance Analysis</h3>
                <div className="text-3xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">
                  73/100
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Clarity</span>
                    <span className="font-semibold text-gray-900">78</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '78%' }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Structure</span>
                    <span className="font-semibold text-gray-900">85</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '85%' }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Simplicity</span>
                    <span className="font-semibold text-gray-900">65</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '65%' }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Pacing</span>
                    <span className="font-semibold text-gray-900">68</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '68%' }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Confidence</span>
                    <span className="font-semibold text-gray-900">71</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '71%' }}></div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Next Improvement Focus</h4>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-900 font-medium">
                    Simplify your language — avoid jargon and over-complex phrasing
                  </p>
                </div>
              </div>

              <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
                Do Another Rep
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
