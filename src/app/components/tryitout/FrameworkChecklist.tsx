import { CheckCircle, XCircle, AlertCircle, Layers } from "lucide-react";
import { FrameworkCoverageAnalysis } from "../../../../app/utils/transcriptAnalyzer";

interface FrameworkChecklistProps {
  coverage: FrameworkCoverageAnalysis;
  frameworkName: string;
}

export function FrameworkChecklist({ coverage, frameworkName }: FrameworkChecklistProps) {
  // Don't show for free-form
  if (coverage.components.length === 0) {
    return null;
  }

  const allCovered = coverage.components.every(c => c.covered);
  const noneCovered = coverage.components.every(c => !c.covered);

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1">Framework Coverage</h3>
          <p className="text-sm text-gray-600">
            Selected framework: <span className="font-medium text-gray-900">{frameworkName}</span>
          </p>
        </div>
        
        {/* Coverage Badge */}
        <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
          allCovered 
            ? "bg-green-100 text-green-700 border-2 border-green-200"
            : noneCovered
            ? "bg-red-100 text-red-700 border-2 border-red-200"
            : "bg-yellow-100 text-yellow-700 border-2 border-yellow-200"
        }`}>
          {coverage.coveragePercentage}%
        </div>
      </div>

      {/* Explainer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
        <p className="text-sm text-blue-900">
          This checklist shows which components of your selected framework were detected in your response. 
          Use it to ensure you're hitting all the key structural elements.
        </p>
      </div>

      {/* Component Checklist */}
      <div className="space-y-3">
        {coverage.components.map((component, index) => (
          <div 
            key={component.component}
            className={`relative overflow-hidden rounded-xl border-2 transition-all ${
              component.confidence === "high"
                ? "border-green-300 bg-gradient-to-br from-green-50 to-green-100/50"
                : component.confidence === "partial"
                ? "border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100/50"
                : "border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100/50"
            }`}
          >
            {/* Status stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              component.confidence === "high"
                ? "bg-green-600"
                : component.confidence === "partial"
                ? "bg-yellow-500"
                : "bg-gray-400"
            }`} />
            
            <div className="flex items-start gap-3 p-4 pl-5">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {component.confidence === "high" && (
                  <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={2.5} />
                )}
                {component.confidence === "partial" && (
                  <AlertCircle className="w-6 h-6 text-yellow-600" strokeWidth={2.5} />
                )}
                {component.confidence === "missing" && (
                  <XCircle className="w-6 h-6 text-gray-400" strokeWidth={2.5} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base font-bold text-gray-900">
                    {index + 1}. {component.component}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                    component.confidence === "high"
                      ? "bg-green-600 text-white"
                      : component.confidence === "partial"
                      ? "bg-yellow-500 text-white"
                      : "bg-gray-300 text-gray-700"
                  }`}>
                    {component.confidence === "high" && "✓ Covered"}
                    {component.confidence === "partial" && "~ Partial"}
                    {component.confidence === "missing" && "✗ Missing"}
                  </span>
                </div>

                {/* Evidence */}
                {component.evidence && (
                  <div className="bg-white/60 border border-gray-200 rounded-lg px-3 py-2 mb-2">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      <span className="text-gray-500 font-medium">Example: </span>
                      <span className="italic">"{component.evidence}"</span>
                    </p>
                  </div>
                )}
                
                {/* Missing message */}
                {component.confidence === "missing" && (
                  <p className="text-sm text-gray-600 font-medium">
                    → No clear mention detected. Include this component in your next rep.
                  </p>
                )}
                
                {/* Partial coverage message */}
                {component.confidence === "partial" && (
                  <p className="text-sm text-gray-600 font-medium">
                    → Mentioned briefly. Spend more time developing this section.
                  </p>
                )}
                
                {/* High coverage message */}
                {component.confidence === "high" && (
                  <p className="text-sm text-green-700 font-medium">
                    → Well covered. Good structural execution.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Feedback */}
      <div className={`mt-5 p-5 rounded-xl border-2 ${
        allCovered
          ? "bg-green-50 border-green-300"
          : noneCovered
          ? "bg-red-50 border-red-300"
          : "bg-blue-50 border-blue-300"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            allCovered
              ? "bg-green-600"
              : noneCovered
              ? "bg-red-600"
              : "bg-blue-600"
          }`}>
            {allCovered && <CheckCircle className="w-5 h-5 text-white" strokeWidth={2.5} />}
            {noneCovered && <XCircle className="w-5 h-5 text-white" strokeWidth={2.5} />}
            {!allCovered && !noneCovered && <AlertCircle className="w-5 h-5 text-white" strokeWidth={2.5} />}
          </div>
          
          <div className="flex-1">
            <p className="text-base font-bold text-gray-900 mb-2">
              {allCovered && "Complete Framework Execution"}
              {noneCovered && "Framework Not Followed"}
              {!allCovered && !noneCovered && "Partial Framework Coverage"}
            </p>
            <p className="text-sm text-gray-800 leading-relaxed">
              {allCovered && "You hit all key components. Your response followed the intended structure well. Keep this consistency in future reps."}
              {noneCovered && "Your response didn't align with the selected framework. Review the components above and use them as a mental checklist during your next rep."}
              {!allCovered && !noneCovered && (
                <>
                  You covered <strong>{coverage.components.filter(c => c.covered).length} of {coverage.components.length}</strong> components. 
                  Focus on the missing sections to deliver a complete, well-structured response. 
                  {coverage.components.filter(c => !c.covered).length === 1 && (
                    <> Missing: <strong>{coverage.components.find(c => !c.covered)?.component}</strong>.</>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
