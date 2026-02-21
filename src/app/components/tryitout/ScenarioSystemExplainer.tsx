import { Target, Settings, Zap } from "lucide-react";

export function ScenarioSystemExplainer() {
  return (
    <section className="py-16 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <h2 className="text-3xl lg:text-4xl font-bold">Prompt Library & Simulation Engine</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Cognify trains real conversations — not theory.
          </p>
        </div>

        {/* What Each Prompt Does */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-10">
          <p className="text-gray-700 leading-relaxed mb-4">
            Each prompt:
          </p>
          <div className="space-y-2.5 text-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2.5 flex-shrink-0"></div>
              <p>Defines the scenario</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2.5 flex-shrink-0"></div>
              <p>Sets the audience</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2.5 flex-shrink-0"></div>
              <p>Applies a structured framework</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2.5 flex-shrink-0"></div>
              <p>Configures time pressure</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2.5 flex-shrink-0"></div>
              <p>Adjusts feedback weighting based on context</p>
            </div>
          </div>
          <p className="text-gray-600 text-sm mt-5 pt-5 border-t border-gray-200">
            You can select from curated prompts or build your own.
          </p>
        </div>

        {/* Visual Hierarchy: Steps */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Step 1: Choose a Vertical</h3>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Sales</span>
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Consulting</span>
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Leadership</span>
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Interviews</span>
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">Explain a Concept</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Step 2: Select a Scenario</h3>
                <p className="text-sm text-gray-600 mb-3">3–5 scenario cards per vertical</p>
                <div className="bg-[#9D7BF5]/5 rounded-lg p-4 border border-[#9D7BF5]/20">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Example (if Sales selected):</p>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                      <p>Explain value in 60 seconds</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                      <p>Handle a pricing objection</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                      <p>Run a discovery recap</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                      <p>Summarize ROI for a VP</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Step 3: Customize (Optional)</h3>
                <div className="space-y-1.5 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                    <p>Adjust time (30 / 60 / 90 seconds)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                    <p>Choose framework</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-[#9D7BF5] rounded-full mt-2 flex-shrink-0"></div>
                    <p>Define audience</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Adaptive Variations Section */}
        <div className="mt-10 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl p-6 border border-[#9D7BF5]/30">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Adaptive Scenario Variations</h3>
          <p className="text-gray-700 leading-relaxed">
            Cognify generates intelligent variations of your selected scenario to prevent memorization and train adaptable thinking under pressure.
          </p>
        </div>
      </div>
    </section>
  );
}
