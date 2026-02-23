import { ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";

interface CustomScenarioBuilderProps {
  onBack: () => void;
  onConfirm: (scenario: string, context: string) => void;
}

export function CustomScenarioBuilder({ onBack, onConfirm }: CustomScenarioBuilderProps) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [context, setContext] = useState("");
  const [showVariations, setShowVariations] = useState(false);

  const handleGenerate = () => {
    setShowVariations(true);
  };

  const handleSelectVariation = (variation: string) => {
    onConfirm(variation, context);
  };

  // Generate mock AI variations based on the input
  const generateVariations = () => {
    if (!topic) return [];
    
    return [
      `Explain ${topic} in under 60 seconds`,
      `Justify why ${topic} matters to ${audience || "stakeholders"}`,
      `Present the core problem that ${topic} solves`,
      `Defend your approach to ${topic} against skepticism`,
      `Summarize the key insights from ${topic}`
    ];
  };

  const variations = generateVariations();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h3 className="text-2xl font-bold">Create Custom Scenario</h3>
          <p className="text-sm text-gray-600">Train for situations directly relevant to your work</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
        {/* Topic Input */}
        <div className="space-y-2">
          <label className="block font-semibold text-gray-900">
            What do you need to explain?
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., our new pricing model, why we're pivoting strategy, the Q4 roadmap"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Audience Input */}
        <div className="space-y-2">
          <label className="block font-semibold text-gray-900">
            Who are you explaining it to?
          </label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g., executive team, client, board members, engineering team"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all"
          />
        </div>

        {/* Context Input */}
        <div className="space-y-2">
          <label className="block font-semibold text-gray-900">
            Additional context <span className="text-sm font-normal text-gray-500">(Optional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any specific constraints, background, or key points you need to cover..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent outline-none transition-all resize-none"
          />
        </div>

        {/* Generate Button */}
        {!showVariations && (
          <button
            onClick={handleGenerate}
            disabled={!topic || !audience}
            className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Generate Practice Variations
          </button>
        )}
      </div>

      {/* AI-Generated Variations */}
      {showVariations && variations.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#9D7BF5]" />
              AI-Configured Variations
            </h4>
            <p className="text-sm text-gray-600">
              Multiple variations to prevent rote repetition and encourage flexible thinking. Select one to begin training.
            </p>
          </div>

          <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl p-6 border border-[#9D7BF5]/20 space-y-2">
            {variations.map((variation, index) => (
              <button
                key={index}
                onClick={() => handleSelectVariation(variation)}
                className="w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-[#9D7BF5] hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 group-hover:text-[#9D7BF5] mb-1">
                      Variation {index + 1}
                    </p>
                    <p className="text-sm text-gray-600">
                      {variation}
                    </p>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    <div className="px-2 py-1 bg-[#9D7BF5]/10 rounded text-xs font-medium text-[#9D7BF5]">
                      {index === 0 ? "Direct" : index === 1 ? "Persuasive" : index === 2 ? "Problem-focused" : index === 3 ? "Defensive" : "Analytical"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong>Practice tip:</strong> Run multiple variations back-to-back to build flexible thinking rather than memorized responses.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
