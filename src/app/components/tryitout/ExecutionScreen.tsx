import { useState } from "react";
import { CheckCircle2, Target } from "lucide-react";

interface ExecutionScreenProps {
  scenario: string;
  audience: string;
  framework: string;
  initialPreRepIntent: string;
  repNumber: number;
  onComplete: (repContent: { point: string; example: string; meaning: string }, preRepIntent: string) => void;
  onBack: () => void;
}

export function ExecutionScreen({
  scenario,
  audience,
  framework,
  initialPreRepIntent,
  repNumber,
  onComplete,
  onBack,
}: ExecutionScreenProps) {
  const [preRepIntent, setPreRepIntent] = useState(initialPreRepIntent);
  const [intentLocked, setIntentLocked] = useState(false);
  const [point, setPoint] = useState("");
  const [example, setExample] = useState("");
  const [meaning, setMeaning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLockIntent = () => {
    if (preRepIntent.trim()) {
      setIntentLocked(true);
    }
  };

  const handleComplete = () => {
    if (!point.trim() || !example.trim() || !meaning.trim()) return;

    setIsSubmitting(true);

    // Brief delay for smooth transition
    setTimeout(() => {
      onComplete({ point, example, meaning }, preRepIntent);
    }, 300);
  };

  const isValid = point.trim().length > 0 && example.trim().length > 0 && meaning.trim().length > 0;

  return (
    <section className="py-8 px-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with Rep Number */}
        <div className="text-center space-y-2">
          <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 border border-[#9D7BF5]/30 rounded-full">
            <span className="text-sm font-bold text-[#9D7BF5]">Rep {repNumber}</span>
          </div>
          <h1 className="text-3xl font-bold">{scenario}</h1>
          <p className="text-sm text-gray-600">
            {audience} · {framework}
          </p>
        </div>

        {/* Pre-Rep Intent Section */}
        {!intentLocked ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-[#C855E8]" />
                  <h3 className="text-lg font-bold text-gray-900">Set Your Intent</h3>
                </div>
                <p className="text-sm text-gray-600">
                  What do you want to hold during this rep? This will stay visible while you execute.
                </p>
              </div>
              <textarea
                value={preRepIntent}
                onChange={(e) => setPreRepIntent(e.target.value)}
                placeholder="• Start with the core message&#10;• Use one strong example&#10;• Avoid filler&#10;• End with a clear takeaway"
                className="w-full px-5 py-4 border-2 border-[#C855E8] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#C855E8] focus:border-transparent text-sm leading-relaxed bg-white placeholder:text-gray-400"
                rows={6}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={onBack}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleLockIntent}
                  disabled={!preRepIntent.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-base font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
                >
                  Lock Intent & Begin Rep
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Locked Intent Panel */}
            <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 border border-[#9D7BF5]/20 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Your Intent
                  </p>
                  <p className="text-gray-900 text-sm leading-relaxed whitespace-pre-line">{preRepIntent}</p>
                </div>
                <button
                  onClick={() => setIntentLocked(false)}
                  className="text-xs text-[#9D7BF5] hover:text-[#8B6BE0] font-medium"
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Structured Input Fields */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Execute Your Rep</h3>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Point
                  <span className="ml-2 text-xs font-normal text-gray-500">State the idea</span>
                </label>
                <textarea
                  value={point}
                  onChange={(e) => setPoint(e.target.value)}
                  placeholder="What is your main point?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent text-sm"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Example
                  <span className="ml-2 text-xs font-normal text-gray-500">Illustrate it</span>
                </label>
                <textarea
                  value={example}
                  onChange={(e) => setExample(e.target.value)}
                  placeholder="Give a concrete example"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent text-sm"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Meaning
                  <span className="ml-2 text-xs font-normal text-gray-500">Explain why it matters</span>
                </label>
                <textarea
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  placeholder="Why does this matter?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent text-sm"
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setIntentLocked(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                ← Back to Intent
              </button>
              <button
                onClick={handleComplete}
                disabled={!isValid || isSubmitting}
                className="flex-1 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-base font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
              >
                {isSubmitting ? "Completing..." : "Complete Rep"}
              </button>
            </div>

            {!isValid && (
              <p className="text-xs text-gray-500 text-center">
                Fill in all three fields to complete your rep
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
