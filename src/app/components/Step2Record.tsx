import { Mic } from "lucide-react";

export function Step2Record() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-full border border-[#9D7BF5]/20">
              <span className="text-sm font-bold text-gray-700">Step 2</span>
            </div>
            
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Record a Structured Rep
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Once configured, the rep screen becomes a focused practice cockpit.
            </p>

            <div className="space-y-4 pt-2">
              <p className="text-base text-gray-700 leading-relaxed">
                On screen during recording:
              </p>
              
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Your selected prompt</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Audience context</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Chosen framework structure</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Time limit</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-gray-700">Recording timer</span>
                </li>
              </ul>

              <p className="text-base text-gray-600 leading-relaxed pt-2">
                The framework remains visible while speaking to guide thinking in real time.
              </p>

              <p className="text-sm text-gray-500 italic pt-4">
                This trains clarity under light pressure.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100">
            <div className="space-y-6">
              <div className="pb-6 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-500 mb-2">SCENARIO</h3>
                <p className="text-xl font-semibold">Pitch an Idea</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">PROMPT</h4>
                  <p className="text-gray-700 leading-relaxed">
                    Explain the core value of your solution to a non-technical decision maker without using product jargon.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">FRAMEWORK</h4>
                  <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-4 border border-[#9D7BF5]/30">
                    <div className="flex items-center gap-3 text-gray-700 font-medium">
                      <span>Problem</span>
                      <span className="text-gray-400">→</span>
                      <span>Impact</span>
                      <span className="text-gray-400">→</span>
                      <span>Solution</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">TIME LIMIT</h4>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-gray-900">1:00</div>
                    <div className="text-sm text-gray-500">60 seconds</div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-3 group">
                  <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Start Recording
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
