import { useState } from "react";
import { DollarSign, Lightbulb, Users, Briefcase, GraduationCap, Plus, Sparkles } from "lucide-react";

interface ScenarioLibraryProps {
  onSelectScenario: (scenario: string, category: string) => void;
  onCreateCustom: () => void;
} 

export const scenarioCategories = [
  {
    name: "Sales",
    icon: DollarSign,
    description: "Pitching, objections, discovery, executive value summaries",
    scenarios: [
      "Explain value in 60 seconds",
      "Handle a pricing objection",
      "Run a discovery recap",
      "Summarize ROI for a VP",
      "Explain why you're different from competitors"
    ]
  },
  {
    name: "Consulting",
    icon: Lightbulb,
    description: "Structured thinking, recommendations, executive updates",
    scenarios: [
      "Recommend a decision to leadership",
      "Explain trade-offs between two options",
      "Present a new initiative",
      "Defend a controversial recommendation",
      "Summarize complex analysis"
    ]
  },
  {
    name: "Leadership",
    icon: Users,
    description: "Running meetings, delegation, alignment, feedback delivery",
    scenarios: [
      "Give a project update to executives",
      "Deliver difficult feedback to your team",
      "Explain a strategic shift",
      "Rally the team around a new priority",
      "Communicate a change in direction"
    ]
  },
  {
    name: "Interviews",
    icon: Briefcase,
    description: "Behavioral responses, high-pressure questions, storytelling",
    scenarios: [
      "Tell me about yourself",
      "Why should we hire you?",
      "Walk me through a difficult decision you made",
      "Describe a time you failed and what you learned",
      "Where do you see yourself in 5 years?"
    ]
  },
  {
    name: "Explain a Concept",
    icon: GraduationCap,
    description: "Teaching clearly, simplifying complexity, adapting to audience",
    scenarios: [
      "Explain technical work to non-technical stakeholders",
      "Present unexpected findings",
      "Teach a complex concept simply",
      "Adapt your explanation to different expertise levels",
      "Clarify a common misunderstanding"
    ]
  }
];

export function ScenarioLibrary({ onSelectScenario, onCreateCustom }: ScenarioLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">Choose Your Training Vertical</h3>
        <p className="text-gray-600 leading-relaxed">
          Select the type of communication you want to train. Each vertical configures your scenario, framework, time pressure, and feedback weighting.
        </p>
      </div>

      {/* Vertical Categories */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarioCategories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(
                selectedCategory === category.name ? null : category.name
              )}
              className={`p-5 rounded-xl border-2 transition-all text-left ${
                selectedCategory === category.name
                  ? "border-[#9D7BF5] bg-[#9D7BF5]/5"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedCategory === category.name 
                    ? "bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1]" 
                    : "bg-gray-100"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    selectedCategory === category.name ? "text-white" : "text-gray-600"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold mb-1 ${
                    selectedCategory === category.name ? "text-[#9D7BF5]" : "text-gray-900"
                  }`}>
                    {category.name}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {category.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Scenarios List */}
      {selectedCategory && (
        <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl p-6 border border-[#9D7BF5]/20">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-700">
              {selectedCategory} Scenarios
            </p>
          </div>
          <div className="space-y-2">
            {scenarioCategories
              .find(cat => cat.name === selectedCategory)
              ?.scenarios.map((scenario) => (
                <button
                  key={scenario}
                  onClick={() => onSelectScenario(scenario, selectedCategory)}
                  className="w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-[#9D7BF5] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 group-hover:text-[#9D7BF5]">
                      {scenario}
                    </span>
                    <Sparkles className="w-4 h-4 text-gray-400 group-hover:text-[#9D7BF5] transition-colors" />
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Custom Prompt Builder */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={onCreateCustom}
          className="w-full px-6 py-5 bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-[#9D7BF5] hover:bg-[#9D7BF5]/5 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-gradient-to-r group-hover:from-[#5CB3FF] group-hover:via-[#9D7BF5] group-hover:to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0 transition-all">
              <Plus className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 group-hover:text-[#9D7BF5] mb-1 transition-colors">
                Custom Prompt Builder
              </p>
              <p className="text-sm text-gray-600">
                Design your own real-world situation. Configure audience, time limit, and feedback emphasis.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
