import { useEffect, useRef } from "react";
import { FrameworkDropdown } from "./FrameworkDropdown";
import { FRAMEWORKS } from "../../types/rep";

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
    <div className="space-y-8">
      {/* Step 1: Audience */}
      <div ref={audienceSectionRef} className="space-y-3">
        <div>
          <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
            STEP 1
          </p>
          <h3 className="text-xl font-bold text-gray-900">Choose your audience</h3>
          <p className="text-sm text-gray-600 mt-1">Who are you speaking to?</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {audiences.map((audience) => (
            <button
              key={audience}
              onClick={() => setSelectedAudience(audience)}
              className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                selectedAudience === audience
                  ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                  : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
              }`}
            >
              {audience}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Framework */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
            STEP 2
          </p>
          <h3 className="text-xl font-bold text-gray-900">Choose a framework</h3>
          <p className="text-sm text-gray-600 mt-1">Structure to guide your thinking</p>
        </div>
        <FrameworkDropdown
          selectedFramework={selectedFramework}
          setSelectedFramework={setSelectedFramework}
        />
      </div>

      {/* Framework Structure Preview (if selected) */}
      {selectedFrameworkObj && selectedFrameworkObj.structure.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
            {selectedFrameworkObj.name} Structure
          </p>
          <div className="space-y-2">
            {selectedFrameworkObj.structure.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#9D7BF5] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">{i + 1}</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium text-gray-900">{step}</p>
                  {selectedFrameworkObj.structureDetails && selectedFrameworkObj.structureDetails[i] && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {selectedFrameworkObj.structureDetails[i]}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
