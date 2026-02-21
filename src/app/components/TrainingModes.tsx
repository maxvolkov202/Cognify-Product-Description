import { Zap, FileText, Target } from "lucide-react";

export function TrainingModes() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-[#5CB3FF]/5 to-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Core Practice Components
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Each rep is built from structured components that simulate real-world communication. You choose the context, apply a framework, speak under constraint, and receive targeted feedback.
          </p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-7 h-7 text-white" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Structured Impromptu Reps</h3>
                  <p className="text-gray-600 leading-relaxed">
                    You choose a scenario and prompt from a curated library or create your own. Then you apply a visible framework while speaking under a time constraint. The structure stays on screen to guide thinking in real time.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Prompt selection
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Visible framework guidance
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Time-constrained speaking
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Structured thinking under pressure
                  </span>
                </div>

                <p className="text-sm text-gray-500 italic">
                  This is the foundation of Cognify's practice loop.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-7 h-7 text-white" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">Prompt-Driven Simulation</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Cognify includes a growing prompt library across interviews, sales, leadership, and explanation scenarios. Each prompt configures the rep environment and influences how feedback is evaluated.
                  </p>
                  <p className="text-gray-600 leading-relaxed mt-2">
                    Users can also customize their own prompt to simulate specific conversations.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Interview prompts
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Sales scenarios
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Executive updates
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Custom prompts
                  </span>
                </div>

                <p className="text-sm text-gray-500 italic">
                  The prompt defines the challenge. The framework defines the structure.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="w-7 h-7 text-white" />
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-semibold mb-2">High-Precision Feedback</h3>
                  <p className="text-gray-600 leading-relaxed">
                    After each rep, Cognify delivers a critical performance score across five core skills and highlights one specific improvement focus for the next attempt.
                  </p>
                  <p className="text-gray-600 leading-relaxed mt-2">
                    Feedback adapts to the selected prompt and framework to ensure relevance and realism.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    1–100 performance score
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Content + delivery breakdown
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Framework adherence checks
                  </span>
                  <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                    Single next improvement focus
                  </span>
                </div>

                <p className="text-sm text-gray-500 italic">
                  Clear direction. No overload.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
