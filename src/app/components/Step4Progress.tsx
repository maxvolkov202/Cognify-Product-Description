import { TrendingUp, Target, Zap } from "lucide-react";

export function Step4Progress() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100">
            <div className="space-y-8">
              <div className="pb-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold mb-6">Dashboard</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Clarity Score Trend</span>
                      <span className="font-semibold text-gray-900">78 → 84</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '84%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Structure Score Trend</span>
                      <span className="font-semibold text-gray-900">72 → 85</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">Confidence Score Trend</span>
                      <span className="font-semibold text-gray-900">65 → 76</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '76%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl border border-[#9D7BF5]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Total Reps</p>
                      <p className="text-sm text-gray-600">All time</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">24</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">This Week</p>
                      <p className="text-sm text-gray-600">Last 7 days</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">7</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Zap className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Current Streak</p>
                      <p className="text-sm text-gray-600">Consecutive days</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">12</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:order-first">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-full border border-[#9D7BF5]/20">
              <span className="text-sm font-bold text-gray-700">Step 5</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Measure Progress Over Time
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Cognify tracks measurable improvement across reps.
            </p>

            <div className="space-y-4 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                Your dashboard shows:
              </p>
              
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Clarity score trend</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Structure score trend</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Confidence score trend</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Total reps</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Weekly reps</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Current streak</span>
                </li>
              </ul>

              <div className="pt-4 space-y-2">
                <p className="text-base text-gray-600 leading-relaxed">
                  Progress is visible and performance-based.
                </p>
                <p className="text-sm text-gray-500 italic">
                  Not vibes. Not motivation. Actual skill movement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
