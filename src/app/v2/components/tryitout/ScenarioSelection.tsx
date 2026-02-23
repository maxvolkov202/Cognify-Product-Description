import { useEffect, useRef } from "react";
import { FrameworkDropdown } from "./FrameworkDropdown";
import { FRAMEWORKS } from "../../../types/rep";

interface ScenarioSelectionProps {
  selectedScenario: string;
  setSelectedScenario: (scenario: string) => void;
  selectedAudience: string;
  setSelectedAudience: (audience: string) => void;
  selectedFramework: string;
  setSelectedFramework: (framework: string) => void;
  timeConstraint: number;
  setTimeConstraint: (time: number) => void;
}

const audiences = [
  "Hiring manager",
  "Executive",
  "Client",
  "Team",
  "Non-technical stakeholder"
];

export function ScenarioSelection({
  selectedScenario,
  setSelectedScenario,
  selectedAudience,
  setSelectedAudience,
  selectedFramework,
  setSelectedFramework,
  timeConstraint,
  setTimeConstraint
}: ScenarioSelectionProps) {
  const audienceSectionRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to audience section when scenario is selected
  useEffect(() => {
    if (selectedScenario && audienceSectionRef.current) {
      audienceSectionRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [selectedScenario]);

  const selectedFrameworkObj = FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header - Compact */}
      <div className="mb-5 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Configure Your Rep</h3>
        <p className="text-xs text-gray-600 mt-0.5">Set up practice parameters</p>
      </div>

      {/* Configuration Grid - Tight spacing */}
      <div className="space-y-5">
        {/* Step 1: Audience */}
        <div ref={audienceSectionRef} className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-[#9D7BF5] uppercase tracking-wide">
              Step 1
            </span>
            <label className="block text-sm font-bold text-gray-900">
              Who are you speaking to?
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {audiences.map((audience) => (
              <button
                key={audience}
                onClick={() => setSelectedAudience(audience)}
                className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                  selectedAudience === audience
                    ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {audience}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Framework */}
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-[#9D7BF5] uppercase tracking-wide">
              Step 2
            </span>
          </div>
          <FrameworkDropdown
            selectedFramework={selectedFramework}
            setSelectedFramework={setSelectedFramework}
          />
          
          {/* Framework Structure Preview */}
          {selectedFrameworkObj && selectedFrameworkObj.structure.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                {selectedFrameworkObj.name} Structure
              </p>
              <div className="space-y-1">
                {selectedFrameworkObj.structure.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#9D7BF5]">{i + 1}.</span>
                    <span className="text-xs text-gray-700">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Time Constraint */}
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold text-[#9D7BF5] uppercase tracking-wide">
              Step 3
            </span>
            <label className="block text-sm font-bold text-gray-900">
              Time constraint
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[30, 60, 90].map((time) => (
              <button
                key={time}
                onClick={() => setTimeConstraint(time)}
                className={`px-4 py-2.5 rounded-lg border-2 transition-all font-medium text-sm ${
                  timeConstraint === time
                    ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                {time}s
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center pt-0.5">
            Constraint builds clarity
          </p>
        </div>
      </div>
    </div>
  );
}
