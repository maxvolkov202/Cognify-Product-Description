import { FRAMEWORKS } from "../../types/rep";
import { FrameworkDropdown } from "./FrameworkDropdown";

interface RepSetupProps {
  audience: string;
  onAudienceChange: (audience: string) => void;
  frameworkId: string;
  onFrameworkChange: (frameworkId: string) => void;
  timeConstraint: number;
  onTimeConstraintChange: (time: number) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function RepSetup({
  audience,
  onAudienceChange,
  frameworkId,
  onFrameworkChange,
  timeConstraint,
  onTimeConstraintChange,
  onBack,
  onContinue,
}: RepSetupProps) {
  const selectedFramework = FRAMEWORKS.find((f) => f.id === frameworkId);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Rep</h2>
          <p className="text-sm text-gray-600">
            Set your audience, framework, and time constraint
          </p>
        </div>

        {/* Audience Input */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Who are you speaking to?
          </label>
          <p className="text-xs text-gray-600 mb-3">
            Define your audience (e.g., "Sales prospect", "My team", "Board members")
          </p>
          <input
            type="text"
            value={audience}
            onChange={(e) => onAudienceChange(e.target.value)}
            placeholder="e.g., Sales prospect"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9D7BF5]/50 focus:border-[#9D7BF5] text-sm"
          />
        </div>

        {/* Framework Selection */}
        <div className="mb-6">
          <FrameworkDropdown
            selectedFramework={frameworkId}
            setSelectedFramework={onFrameworkChange}
          />
        </div>

        {/* Time Constraint */}
        <div className="mb-8">
          <label className="block text-sm font-bold text-gray-900 mb-2">
            Time Constraint
          </label>
          <p className="text-xs text-gray-600 mb-3">
            How long should this rep take?
          </p>
          <div className="flex gap-3">
            {[30, 60, 90, 120].map((time) => (
              <button
                key={time}
                onClick={() => onTimeConstraintChange(time)}
                className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all font-medium text-sm ${
                  timeConstraint === time
                    ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {time}s
              </button>
            ))}
          </div>
        </div>

        {/* Selected Framework Info */}
        {selectedFramework && (
          <div className="mb-8 p-4 bg-gradient-to-br from-purple-50/50 to-pink-50/50 rounded-lg border border-[#9D7BF5]/20">
            <h3 className="font-bold text-sm text-gray-900 mb-2">
              {selectedFramework.name}
            </h3>
            <p className="text-xs text-gray-600 mb-2">{selectedFramework.description}</p>
            {selectedFramework.structure.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-bold text-gray-700 mb-1">Structure:</p>
                <ol className="text-xs text-gray-600 space-y-1">
                  {selectedFramework.structure.map((step, i) => (
                    <li key={i}>
                      {i + 1}. {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            ← Back
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all text-sm"
          >
            Continue to Recording
          </button>
        </div>
      </div>
    </div>
  );
}
