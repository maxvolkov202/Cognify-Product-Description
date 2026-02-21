import { Sparkles, Layers, Brain } from "lucide-react";

export function AIVariationsInfo() {
  return (
    <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-2xl p-8 border border-[#9D7BF5]/20">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">AI-Configured Variations</h3>
          <p className="text-gray-600 leading-relaxed">
            Once you select a scenario, Cognify automatically generates multiple variations to prevent rote repetition and encourage flexible thinking.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="w-10 h-10 bg-[#5CB3FF]/10 rounded-lg flex items-center justify-center mb-3">
            <Layers className="w-5 h-5 text-[#5CB3FF]" />
          </div>
          <h4 className="font-semibold mb-2">Different angles</h4>
          <p className="text-sm text-gray-600">
            Practice explaining the same topic from multiple perspectives
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="w-10 h-10 bg-[#9D7BF5]/10 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-[#9D7BF5]" />
          </div>
          <h4 className="font-semibold mb-2">Different difficulty</h4>
          <p className="text-sm text-gray-600">
            Build from foundational to advanced communication challenges
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="w-10 h-10 bg-[#E86DE1]/10 rounded-lg flex items-center justify-center mb-3">
            <Brain className="w-5 h-5 text-[#E86DE1]" />
          </div>
          <h4 className="font-semibold mb-2">Different constraints</h4>
          <p className="text-sm text-gray-600">
            Train for various time limits, audiences, and priorities
          </p>
        </div>
      </div>
    </div>
  );
}

function TrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
