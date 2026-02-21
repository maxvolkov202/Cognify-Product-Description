import { Settings } from "lucide-react";

export function Step1Configure() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-full border border-[#9D7BF5]/20">
              <span className="text-sm font-bold text-gray-700">Step 1</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Configure Your Rep
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              You don't just hit record. You set the conditions first.
            </p>

            <div className="space-y-4 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                Before every rep, you configure:
              </p>
              
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700"><span className="font-semibold">Scenario</span> (Interview, Pitch, Explain, Feedback, etc.)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700"><span className="font-semibold">Audience</span> (Hiring manager, Executive, Client, Team, etc.)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700"><span className="font-semibold">Prompt</span> (From the library or custom)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700"><span className="font-semibold">Framework</span> (Selected from structured dropdown)</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700"><span className="font-semibold">Time constraint</span></span>
                </li>
              </ul>

              <p className="text-base text-gray-600 leading-relaxed pt-2">
                Everything is contained on one tight configuration screen.
              </p>

              <p className="text-sm text-gray-500 italic pt-4">
                This ensures reps are realistic and intentional — not random practice.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <Settings className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold">Rep Configuration</h3>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Scenario</label>
                <div className="p-3 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg border-2 border-[#9D7BF5]/30">
                  <p className="text-sm font-medium text-gray-900">Interview Question</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Audience</label>
                <div className="p-3 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg border-2 border-[#9D7BF5]/30">
                  <p className="text-sm font-medium text-gray-900">Hiring Manager</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Framework</label>
                <div className="p-3 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg border-2 border-[#9D7BF5]/30">
                  <p className="text-sm font-medium text-gray-900 mb-1">Situation → Action → Result</p>
                  <p className="text-xs text-gray-600">Best for behavioral interview questions</p>
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-500 px-1">
                  <p>Other options:</p>
                  <p>• Problem → Impact → Solution</p>
                  <p>• Claim → Evidence → Implication</p>
                  <p>• Options → Tradeoffs → Recommendation</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time Constraint</label>
                <div className="p-3 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg border-2 border-[#9D7BF5]/30">
                  <p className="text-sm font-medium text-gray-900">90 seconds</p>
                </div>
              </div>
            </div>

            <button className="w-full mt-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
              Start Recording
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
