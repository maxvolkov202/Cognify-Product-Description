import { Play } from "lucide-react";

export function ExampleRep() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-[#5CB3FF]/5 to-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Example Training Rep
          </h2>
          <p className="text-xl text-gray-600">
            Sales Scenario: Explain value clearly in 60 seconds
          </p>
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-2xl border-2 border-gradient-to-r from-[#5CB3FF]/20 via-[#9D7BF5]/20 to-[#E86DE1]/20 space-y-8">
          
          <div className="grid md:grid-cols-2 gap-6 pb-8 border-b border-gray-200">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">PROMPT</h4>
              <p className="text-gray-700 leading-relaxed">
                Explain the core value of your solution to a non-technical decision maker without using product jargon.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">AUDIENCE</h4>
              <p className="text-gray-700 leading-relaxed">
                VP of Operations at a mid-sized company
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">FRAMEWORK</h4>
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <span>Problem</span>
                <span className="text-gray-400">→</span>
                <span>Impact</span>
                <span className="text-gray-400">→</span>
                <span>Solution</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">TIME CONSTRAINT</h4>
              <p className="text-2xl font-bold text-gray-900">60 seconds</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
              <h3 className="text-xl font-semibold">Example Response</h3>
            </div>

            <div className="space-y-6">
              <div className="pl-6 border-l-4 border-[#5CB3FF]">
                <h4 className="font-semibold text-gray-900 mb-2">Problem</h4>
                <p className="text-gray-700 leading-relaxed">
                  Most teams struggle because important work gets slowed down by unclear communication and manual processes. Decisions take longer than they should and small misunderstandings create unnecessary friction.
                </p>
              </div>

              <div className="pl-6 border-l-4 border-[#9D7BF5]">
                <h4 className="font-semibold text-gray-900 mb-2">Impact</h4>
                <p className="text-gray-700 leading-relaxed">
                  That delay leads to missed opportunities, higher costs, and frustrated employees. When teams are not aligned, execution suffers and results plateau.
                </p>
              </div>

              <div className="pl-6 border-l-4 border-[#E86DE1]">
                <h4 className="font-semibold text-gray-900 mb-2">Solution</h4>
                <p className="text-gray-700 leading-relaxed">
                  This solution creates a clear system for coordination and visibility so teams can focus on high-impact work. It reduces confusion, accelerates decisions, and improves overall performance.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-4">What This Rep Trains</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">Leading with the problem before the solution</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">Explaining value in business terms</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">Thinking in structure</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">Communicating clearly under time pressure</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
