import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SampleRep() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="py-16 px-6 border-t border-gray-100">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-6 bg-white rounded-2xl border border-gray-200 hover:border-[#9D7BF5]/50 transition-colors"
        >
          <span className="font-semibold text-lg">See a sample rep</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-6 space-y-6 bg-gray-50 rounded-2xl p-8">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Prompt:</p>
              <p className="text-lg font-semibold">Explain why your product matters to a non-technical executive.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Time:</p>
              <p className="font-medium">60 seconds</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Transcript snippet:</p>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <p className="text-gray-800 leading-relaxed">
                  "Most teams struggle because information gets lost across systems. This costs companies an average of 20 hours per employee each month. Our product eliminates that by centralizing communication in one place. The result is teams move faster and executives get better visibility into what's actually happening."
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-3">Example feedback:</p>
              
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="font-medium text-green-900 mb-1">Strong opening</p>
                  <p className="text-sm text-green-800">Led with the problem immediately</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="font-medium text-blue-900 mb-1">Clear structure</p>
                  <p className="text-sm text-blue-800">Problem → Impact → Solution → Result</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="font-medium text-yellow-900 mb-1">Improvement opportunity</p>
                  <p className="text-sm text-yellow-800">Could quantify the result more specifically</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
