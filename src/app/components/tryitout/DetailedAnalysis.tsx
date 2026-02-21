import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { TranscriptAnalysis } from "../../../../app/utils/transcriptAnalyzer";

interface DetailedAnalysisProps {
  analysis: TranscriptAnalysis;
}

export function DetailedAnalysis({ analysis }: DetailedAnalysisProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <h3 className="text-2xl font-bold mb-6">Detailed Analysis</h3>
      
      <div className="space-y-6">
        {/* Opening & Closing */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border-2 ${
            analysis.hasStrongOpening 
              ? 'border-green-200 bg-green-50' 
              : 'border-orange-200 bg-orange-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {analysis.hasStrongOpening ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              )}
              <p className="font-semibold">Opening</p>
            </div>
            <p className="text-sm text-gray-700">
              {analysis.hasStrongOpening 
                ? "Led with substance, not filler" 
                : "Weak opening - started with filler or preamble"}
            </p>
          </div>

          <div className={`p-4 rounded-xl border-2 ${
            analysis.hasActionableClosing 
              ? 'border-green-200 bg-green-50' 
              : 'border-orange-200 bg-orange-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {analysis.hasActionableClosing ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              )}
              <p className="font-semibold">Closing</p>
            </div>
            <p className="text-sm text-gray-700">
              {analysis.hasActionableClosing 
                ? "Ended with clear direction" 
                : "No clear next step or call to action"}
            </p>
          </div>
        </div>

        {/* Issues Found */}
        {(analysis.fillerWords.length > 0 || 
          analysis.hedgingPhrases.length > 0 || 
          analysis.jargonDetected.length > 0 ||
          analysis.repetitiveWords.length > 0) && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold text-gray-900">Issues to Address</h4>
            </div>
            
            <div className="space-y-3">
              {analysis.fillerWords.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Filler words detected ({analysis.fillerWordCount} instances)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(analysis.fillerWords)].map((word, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-yellow-200 rounded">
                        "{word}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.hedgingPhrases.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Hedging language ({analysis.hedgingPhrases.length} instances)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(analysis.hedgingPhrases)].map((phrase, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-orange-200 rounded">
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Undermines confidence - state your point directly
                  </p>
                </div>
              )}

              {analysis.jargonDetected.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Business jargon detected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.jargonDetected.map((jargon, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-purple-200 rounded">
                        "{jargon}"
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Replace with plain, concrete language
                  </p>
                </div>
              )}

              {analysis.repetitiveWords.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Repetitive language
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.repetitiveWords.slice(0, 5).map((word, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-blue-200 rounded">
                        "{word}" (overused)
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Vary your vocabulary for clarity
                  </p>
                </div>
              )}

              {analysis.confidenceIssues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Confidence issues
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(analysis.confidenceIssues)].map((phrase, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-red-200 rounded">
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Trust your explanation - don't ask for validation
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clean delivery callout */}
        {analysis.fillerWords.length === 0 && 
         analysis.hedgingPhrases.length === 0 && 
         analysis.jargonDetected.length === 0 && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-900 mb-1">Clean Delivery</p>
            <p className="text-sm text-green-700">
              No filler words, hedging, or jargon detected. Strong fundamentals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
