import { useState } from "react";
import { FRAMEWORKS } from "../types/rep";
import { Clock } from "lucide-react";

interface RepSetupProps {
  onContinue: (config: {
    vertical: string;
    scenario: string;
    audience: string;
    framework: string;
    timeLimit: number;
  }) => void;
  onBack: () => void;
}

const VERTICALS = [
  "Product",
  "Engineering",
  "Sales",
  "Marketing",
  "Customer Success",
  "Leadership"
];

const SCENARIOS_BY_VERTICAL: Record<string, string[]> = {
  "Product": [
    "Explain a product decision",
    "Pitch a new feature",
    "Present roadmap priorities"
  ],
  "Engineering": [
    "Explain a technical tradeoff",
    "Justify technical debt",
    "Propose an architecture change"
  ],
  "Sales": [
    "Explain value in 60 seconds",
    "Handle objections",
    "Close a deal"
  ],
  "Marketing": [
    "Pitch a campaign",
    "Explain brand positioning",
    "Present performance metrics"
  ],
  "Customer Success": [
    "Handle escalation",
    "Explain product value",
    "Present quarterly review"
  ],
  "Leadership": [
    "Deliver difficult feedback",
    "Communicate organizational change",
    "Align team on strategy"
  ]
};

const AUDIENCES = [
  "Hiring manager",
  "Executive",
  "Client",
  "Team",
  "Non-technical stakeholder"
];

const TIME_OPTIONS = [
  { value: 30, label: "30 sec" },
  { value: 60, label: "60 sec" },
  { value: 90, label: "90 sec" },
  { value: 120, label: "2 min" }
];

export function RepSetup({ onContinue, onBack }: RepSetupProps) {
  const [vertical, setVertical] = useState("");
  const [scenario, setScenario] = useState("");
  const [audience, setAudience] = useState("");
  const [framework, setFramework] = useState("");
  const [timeLimit, setTimeLimit] = useState(60);

  const scenarios = vertical ? SCENARIOS_BY_VERTICAL[vertical] || [] : [];
  const selectedFrameworkObj = FRAMEWORKS.find(f => f.id === framework);

  const canContinue = vertical && scenario && audience && framework && timeLimit;

  const handleContinue = () => {
    if (canContinue) {
      onContinue({ vertical, scenario, audience, framework, timeLimit });
    }
  };

  return (
    <section className="py-8 px-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Back to browse
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Your Rep</h1>
          <p className="text-gray-600">Configure your practice scenario</p>
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-8">
          {/* Step 1: Vertical */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
                STEP 1
              </p>
              <h3 className="text-xl font-bold text-gray-900">Choose your vertical</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {VERTICALS.map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVertical(v);
                    setScenario(""); // Reset scenario when vertical changes
                  }}
                  className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    vertical === v
                      ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                      : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Scenario */}
          {vertical && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
                  STEP 2
                </p>
                <h3 className="text-xl font-bold text-gray-900">Choose a scenario</h3>
              </div>
              <div className="space-y-2">
                {scenarios.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium text-left ${
                      scenario === s
                        ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Audience */}
          {scenario && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
                  STEP 3
                </p>
                <h3 className="text-xl font-bold text-gray-900">Choose your audience</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      audience === a
                        ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Framework */}
          {audience && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
                  STEP 4
                </p>
                <h3 className="text-xl font-bold text-gray-900">Choose a framework</h3>
              </div>
              <div className="space-y-2">
                {FRAMEWORKS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFramework(f.id)}
                    className={`w-full px-4 py-4 rounded-xl border-2 transition-all text-left ${
                      framework === f.id
                        ? "border-[#9D7BF5] bg-[#9D7BF5]/5"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{f.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Framework Structure Preview */}
          {selectedFrameworkObj && (
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

          {/* Step 5: Time Limit */}
          {framework && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-[#9D7BF5] uppercase tracking-wide mb-1">
                  STEP 5
                </p>
                <h3 className="text-xl font-bold text-gray-900">Choose time limit</h3>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimeLimit(opt.value)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium flex flex-col items-center gap-1 ${
                      timeLimit === opt.value
                        ? "border-[#9D7BF5] bg-[#9D7BF5]/5 text-[#9D7BF5]"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="pt-6 border-t border-gray-200">
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-lg font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
            >
              Continue to Rep
            </button>
            {!canContinue && (
              <p className="text-xs text-gray-500 text-center mt-3">
                Complete all steps to continue
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
