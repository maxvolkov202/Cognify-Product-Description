import { TrendingUp, Lightbulb, DollarSign, Heart, Crown, Briefcase } from "lucide-react";

export function UseCaseCards() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Sales</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train the ability to explain value clearly without relying on product jargon. Users practice identifying the core business problem, articulating impact, and framing solutions in terms decision-makers actually care about.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Value articulation
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Business impact framing
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Jargon-free explanation
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Consulting</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train structured reasoning and clear walkthroughs of complex thinking. Users practice explaining problems, assumptions, tradeoffs, and recommendations step by step in a way clients can follow and trust.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Structured reasoning
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Complex walkthroughs
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Clear recommendations
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Finance</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train translation of financial concepts into plain language. Users practice explaining metrics, forecasts, risks, and tradeoffs to non-finance stakeholders without losing accuracy or credibility.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Plain language translation
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Metric explanation
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Risk communication
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <Heart className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Medicine & Healthcare</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train clarity and empathy when explaining complex information. Users practice communicating diagnoses, treatment options, risks, and outcomes in language patients and families can understand.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Empathetic clarity
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Patient-friendly language
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Complex to simple
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <Crown className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Executive Communication</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train concise, top-down communication. Users practice leading with the takeaway, prioritizing what matters, and delivering clear updates under time constraints.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Top-down thinking
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Concise delivery
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Prioritization
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="grid md:grid-cols-[auto,1fr] gap-6 items-start">
            <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-semibold mb-2">Interviews & Career Conversations</h3>
                <p className="text-gray-600 leading-relaxed">
                  Train confident, structured responses under pressure. Users practice answering open-ended questions clearly, avoiding rambling, and communicating judgment, not just experience.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Structured responses
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Confident delivery
                </span>
                <span className="px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 border border-gray-200">
                  Judgment communication
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
