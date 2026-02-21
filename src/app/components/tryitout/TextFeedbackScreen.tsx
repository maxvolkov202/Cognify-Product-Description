import { useEffect } from "react";
import { Target, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";

interface TextFeedbackScreenProps {
  repNumber: number;
  scenario: string;
  audience: string;
  framework: string;
  preRepIntent: string;
  repContent: {
    point: string;
    example: string;
    meaning: string;
  };
  onDoAnotherRep: () => void;
  onChangeScenario: () => void;
  onFeedbackGenerated: (
    score: number,
    focus: { title: string; nextStep: string },
    detailedScores: any,
    analysisMetrics: any
  ) => void;
}

export function TextFeedbackScreen({
  repNumber,
  scenario,
  audience,
  framework,
  preRepIntent,
  repContent,
  onDoAnotherRep,
  onChangeScenario,
  onFeedbackGenerated,
}: TextFeedbackScreenProps) {
  // Evaluate text structure (guarded for undefined repContent)
  const evaluation = evaluateTextStructure(repContent);
  const clarityScore = evaluation?.overallScore ?? 0;

  // Detailed scores (guarded for undefined nested properties)
  const detailedScores = {
    clarity: evaluation?.clarity?.score ?? 0,
    structure: evaluation?.structure?.score ?? 0,
    brevity: evaluation?.brevity?.score ?? 0,
    confidence: evaluation?.confidence?.score ?? 0,
  };

  const analysisMetrics = {
    wordCount: evaluation?.wordCount ?? 0,
    hasAllFields: evaluation?.hasAllFields ?? false,
    structureCompleteness: evaluation?.structureCompleteness ?? 0,
  };

  const primaryFocus = evaluation?.primaryFocus;
  const primaryFocusTitle = primaryFocus?.dimension ?? "Focus";
  const primaryFocusInstruction = primaryFocus?.instruction ?? "";

  // Notify parent
  useEffect(() => {
    onFeedbackGenerated(
      clarityScore,
      { title: primaryFocusTitle, nextStep: primaryFocusInstruction },
      detailedScores,
      analysisMetrics
    );
  }, []);

  const dimensions = [
    { label: "Clarity", data: evaluation?.clarity ?? { score: 0, strength: null, weakness: "" } },
    { label: "Structure", data: evaluation?.structure ?? { score: 0, strength: null, weakness: "" } },
    { label: "Brevity", data: evaluation?.brevity ?? { score: 0, strength: null, weakness: "" } },
    { label: "Confidence", data: evaluation?.confidence ?? { score: 0, strength: null, weakness: "" } },
  ];

  return (
    <section className="py-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Rep Counter */}
        <div className="text-center">
          <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 border border-[#9D7BF5]/30 rounded-full">
            <span className="text-sm font-bold text-[#9D7BF5]">Rep {repNumber}</span>
          </div>
        </div>

        {/* Primary Focus */}
        <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-6 border-2 border-[#9D7BF5]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-gray-600 mb-1">Primary Focus for Next Rep</p>
                <h2 className="text-xl font-bold text-gray-900 capitalize">
                  {primaryFocusTitle}
                </h2>
              </div>
              <div className="bg-white rounded-lg p-4 border border-[#9D7BF5]/30">
                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                  {primaryFocusInstruction}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Score */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-[#9D7BF5]" />
            <h3 className="text-xl font-bold">Performance Score</h3>
          </div>

          <div className="mb-6">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl font-bold">{clarityScore}</span>
              <span className="text-xl text-gray-500 mb-1">/ 100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  clarityScore >= 90
                    ? "bg-gradient-to-r from-green-600 to-emerald-600"
                    : clarityScore >= 75
                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                    : clarityScore >= 60
                    ? "bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1]"
                    : clarityScore >= 40
                    ? "bg-gradient-to-r from-orange-500 to-amber-500"
                    : "bg-gradient-to-r from-red-500 to-orange-500"
                }`}
                style={{ width: `${clarityScore}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {dimensions.map((item, i) => {
              const score = item.data?.score ?? 0;
              const strength = item.data?.strength ?? null;
              const weakness = item.data?.weakness ?? "";
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-4 ${
                    score >= 75
                      ? "border-green-500/30 bg-green-50/30"
                      : score >= 60
                      ? "border-blue-500/30 bg-blue-50/30"
                      : score >= 40
                      ? "border-orange-500/30 bg-orange-50/30"
                      : "border-red-500/30 bg-red-50/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{item.label}</span>
                    <span
                      className={`text-lg font-bold ${
                        score >= 75
                          ? "text-green-600"
                          : score >= 60
                          ? "text-blue-600"
                          : score >= 40
                          ? "text-orange-600"
                          : "text-red-600"
                      }`}
                    >
                      {score}
                    </span>
                  </div>

                  {strength && (
                    <div className="flex items-start gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700">{strength}</p>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-700">{weakness}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Your Rep Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold mb-4">Your Rep</h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Point</p>
              <p className="text-gray-900 leading-relaxed">{repContent?.point ?? ""}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Example</p>
              <p className="text-gray-900 leading-relaxed">{repContent?.example ?? ""}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Meaning</p>
              <p className="text-gray-900 leading-relaxed">{repContent?.meaning ?? ""}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={onChangeScenario}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Change Scenario
          </button>
          <button
            onClick={onDoAnotherRep}
            className="flex-1 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-base font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
          >
            Do Another Rep
          </button>
        </div>

        <p className="text-sm text-gray-600 text-center">
          Clarity is trainable. Progress comes from repetition.
        </p>
      </div>
    </section>
  );
}

// Default evaluation shape when input is missing or invalid
const DEFAULT_DIMENSION = {
  dimension: "overall",
  score: 0,
  strength: null as string | null,
  weakness: "Incomplete analysis",
  instruction: "Keep practicing.",
};

// Text structure evaluation logic (defensive: handles undefined repContent or nested properties)
function evaluateTextStructure(repContent?: {
  point?: string;
  example?: string;
  meaning?: string;
} | null) {
  const point = repContent?.point ?? "";
  const example = repContent?.example ?? "";
  const meaning = repContent?.meaning ?? "";
  const pointWords = point.trim().split(/\s+/).filter(Boolean).length;
  const exampleWords = example.trim().split(/\s+/).filter(Boolean).length;
  const meaningWords = meaning.trim().split(/\s+/).filter(Boolean).length;
  const totalWords = pointWords + exampleWords + meaningWords;

  const safeContent = { point, example, meaning };
  const hasAllFields = pointWords > 0 && exampleWords > 0 && meaningWords > 0;
  const structureCompleteness = hasAllFields ? 100 : 0;

  // Clarity evaluation (based on directness and word choice)
  const clarityScore = evaluateClarity(safeContent);
  // Structure evaluation (based on completeness and balance)
  const structureScore = evaluateStructure(pointWords, exampleWords, meaningWords);
  // Brevity evaluation (based on conciseness)
  const brevityScore = evaluateBrevity(totalWords);
  // Confidence evaluation (based on language strength)
  const confidenceScore = evaluateConfidence(safeContent);

  const c = clarityScore?.score ?? 0;
  const s = structureScore?.score ?? 0;
  const b = brevityScore?.score ?? 0;
  const conf = confidenceScore?.score ?? 0;
  const overallScore = Math.round((c + s + b + conf) / 4);

  // Determine primary focus (lowest score), with fallback
  const scores = [clarityScore, structureScore, brevityScore, confidenceScore].filter(
    (x): x is NonNullable<typeof x> => x != null && typeof x.score === "number"
  );
  const primaryFocus =
    scores.length > 0
      ? scores.reduce((lowest, current) => (current.score < lowest.score ? current : lowest))
      : DEFAULT_DIMENSION;

  return {
    overallScore,
    clarity: clarityScore ?? DEFAULT_DIMENSION,
    structure: structureScore ?? DEFAULT_DIMENSION,
    brevity: brevityScore ?? DEFAULT_DIMENSION,
    confidence: confidenceScore ?? DEFAULT_DIMENSION,
    primaryFocus: {
      dimension: primaryFocus?.dimension ?? "Overall",
      instruction: primaryFocus?.instruction ?? "Keep practicing.",
    },
    wordCount: totalWords,
    hasAllFields,
    structureCompleteness,
  };
}

function evaluateClarity(content?: { point?: string; example?: string; meaning?: string } | null) {
  const point = content?.point ?? "";
  const example = content?.example ?? "";
  const meaning = content?.meaning ?? "";
  const text = `${point} ${example} ${meaning}`.toLowerCase();
  
  // Check for vague words
  const vagueWords = ["thing", "stuff", "kind of", "sort of", "maybe", "perhaps"];
  const vagueCount = vagueWords.filter(word => text.includes(word)).length;
  
  let score = 85 - (vagueCount * 10);
  score = Math.max(40, Math.min(95, score));

  return {
    dimension: "clarity",
    score,
    strength: score >= 75 ? "Clear, direct language" : null,
    weakness: vagueCount > 0 
      ? `Avoid vague words like "${vagueWords.filter(w => text.includes(w)).join('", "')}"`
      : "Use more concrete, specific language",
    instruction: "Replace vague words with precise terms. Say exactly what you mean.",
  };
}

function evaluateStructure(pointWords: number, exampleWords: number, meaningWords: number) {
  const hasAll = pointWords > 0 && exampleWords > 0 && meaningWords > 0;
  
  if (!hasAll) {
    return {
      dimension: "structure",
      score: 30,
      strength: null,
      weakness: "Missing required fields",
      instruction: "Complete all three fields: Point, Example, and Meaning.",
    };
  }

  // Check balance (example should be longest)
  const isBalanced = exampleWords >= pointWords && meaningWords >= pointWords * 0.5;
  const score = isBalanced ? 88 : 65;

  return {
    dimension: "structure",
    score,
    strength: isBalanced ? "Well-balanced structure" : null,
    weakness: !isBalanced ? "Example section should provide more detail" : "Structure could be more balanced",
    instruction: "Give your example more development. Make it concrete and detailed.",
  };
}

function evaluateBrevity(totalWords: number) {
  let score = 85;
  
  if (totalWords < 30) {
    score = 50;
  } else if (totalWords > 150) {
    score = 60;
  } else if (totalWords > 100) {
    score = 75;
  }

  return {
    dimension: "brevity",
    score,
    strength: totalWords >= 30 && totalWords <= 100 ? "Good length—concise but complete" : null,
    weakness: totalWords < 30 ? "Too brief—add more detail" : totalWords > 150 ? "Too long—be more concise" : "Could be more concise",
    instruction: totalWords < 30 
      ? "Expand your example with more specific details."
      : "Cut unnecessary words. Every sentence should earn its place.",
  };
}

function evaluateConfidence(content?: { point?: string; example?: string; meaning?: string } | null) {
  const point = content?.point ?? "";
  const example = content?.example ?? "";
  const meaning = content?.meaning ?? "";
  const text = `${point} ${example} ${meaning}`.toLowerCase();
  
  // Check for hedging language
  const hedges = ["i think", "i believe", "probably", "might", "could be", "seems like"];
  const hedgeCount = hedges.filter(hedge => text.includes(hedge)).length;
  
  let score = 85 - (hedgeCount * 12);
  score = Math.max(40, Math.min(95, score));

  return {
    dimension: "confidence",
    score,
    strength: hedgeCount === 0 ? "Confident, declarative language" : null,
    weakness: hedgeCount > 0 
      ? `Remove hedging phrases like "${hedges.filter(h => text.includes(h)).join('", "')}"`
      : "Use stronger, more direct phrasing",
    instruction: "State your point directly. Remove qualifiers. Own your perspective.",
  };
}
