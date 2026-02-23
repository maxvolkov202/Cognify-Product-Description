import { FRAMEWORKS } from "../../types/rep";

interface RepSetupProps {
  selectedFramework: string;
  preRepIntent: string;
  setPreRepIntent: (intent: string) => void;
  frameworkKeywords: Record<string, string>;
  onKeywordChange: (step: string, value: string) => void;
  onLockAndStart: () => void;
  onBack: () => void;
}

export function RepSetup({
  selectedFramework,
  preRepIntent,
  setPreRepIntent,
  frameworkKeywords,
  onKeywordChange,
  onLockAndStart,
  onBack
}: RepSetupProps) {
  const selectedFrameworkObj = FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Prepare Your Rep
          </h2>
          <p className="text-sm text-gray-600">
            Take 30 seconds to define what you'll hold.
          </p>
        </div>

        {/* Framework Structure (Editable) */}
        {selectedFrameworkObj && selectedFrameworkObj.structure.length > 0 && (
          <div className="mb-6">
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-900 mb-1">
                Framework Structure
              </label>
              <p className="text-xs text-gray-600">
                Define the minimal anchors you'll hold in each section. Keep it tight. Keywords only.
              </p>
            </div>

            <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-lg border border-[#9D7BF5]/20">
              {selectedFrameworkObj.structure.map((step, i) => (
                <div key={i}>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {i + 1}. {step}
                  </label>
                  <input
                    type="text"
                    value={frameworkKeywords[step] || ""}
                    onChange={(e) => onKeywordChange(step, e.target.value)}
                    placeholder={
                      step === "Point" || step === "Claim" || step === "What" ? "Key words only" :
                      step === "Example" || step === "Evidence" ? "What example will you use?" :
                      step === "Meaning" || step === "Implication" ? "What's the takeaway?" :
                      "Keywords only"
                    }
                    maxLength={100}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5]/50 focus:border-[#9D7BF5] placeholder:text-gray-400 transition-all"
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              This will stay visible during your rep.
            </p>
          </div>
        )}

        {/* Separator */}
        {selectedFrameworkObj && selectedFrameworkObj.structure.length > 0 && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-xs text-gray-400">+</span>
            </div>
          </div>
        )}

        {/* Pre-Rep Intent Input */}
        <div className="mb-6">
          <div className="mb-3">
            <label className="block text-sm font-bold text-gray-900 mb-1">
              Pre-Rep Intent
              <span className="text-xs font-normal text-gray-500 ml-2">(Free-form reminders)</span>
            </label>
            <p className="text-xs text-gray-600">
              Any other execution notes or personal reminders you want visible.
            </p>
          </div>
          
          <textarea
            value={preRepIntent}
            onChange={(e) => setPreRepIntent(e.target.value)}
            placeholder="Optional: type any additional reminders or mental cues…"
            rows={6}
            className="w-full px-6 py-5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D7BF5]/20 focus:border-[#9D7BF5] text-sm resize-none bg-white text-gray-900 placeholder:text-gray-400"
            style={{ lineHeight: 1.7 }}
          />
          
          <p className="text-xs text-gray-500 mt-2">
            This will stay visible during your rep.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            ← Back
          </button>
          <button
            onClick={onLockAndStart}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all text-sm"
          >
            Lock & Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
