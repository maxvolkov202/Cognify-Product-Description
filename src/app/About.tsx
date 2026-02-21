import { useNavigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { CognifyHeroLogo } from "../components/branding/CognifyHeroLogo";
import { Clock, TrendingUp, Target } from "lucide-react";

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Navigation currentPage="about" />
      
      {/* SECTION 1 — HERO STORY */}
      <section className="px-6" style={{ paddingTop: '120px', paddingBottom: '100px' }}>
        <div className="max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left Side - Text */}
            <div>
              <h1 className="text-[56px] font-bold text-gray-900 mb-6 leading-tight">
                The moment it clicked.
              </h1>
              <p className="text-[32px] text-gray-800 mb-8 leading-snug" style={{ fontWeight: 500 }}>
                Intelligence isn't the problem. Structure is.
              </p>
              <div className="max-w-[640px] text-lg text-gray-700 leading-relaxed space-y-4">
                <p>
                  I spent years watching talented people struggle in high-stakes moments.
                  Not because they didn't know their material.
                  Not because they lacked intelligence.
                </p>
                <p>
                  But because when pressure hit — interviews, sales calls, presentations —
                  their structure dissolved.
                </p>
                <p>
                  They knew what they wanted to say.
                  They just couldn't deliver it clearly.
                </p>
                <p>
                  The gap wasn't knowledge.
                  It was muscle memory.
                </p>
                <p>
                  No one had trained their brain to hold structure under pressure.
                </p>
              </div>
            </div>

            {/* Right Side - Logo Display */}
            <div className="flex justify-center items-center">
              <div className="relative">
                {/* Soft Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] opacity-10 blur-3xl scale-150"></div>
                
                {/* Glass Card */}
                <div className="relative bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-3xl p-8 shadow-lg">
                  <CognifyHeroLogo size={140} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — BELIEF STATEMENT */}
      <section className="px-6 border-t border-gray-200" style={{ paddingTop: '100px', paddingBottom: '80px' }}>
        <div className="max-w-[800px] mx-auto text-center">
          <h2 className="text-[44px] font-bold text-gray-900 mb-8 leading-tight">
            Most people don't need more information.<br />
            They need reps.
          </h2>
          <div className="text-lg text-gray-700 leading-relaxed space-y-4">
            <p>
              You don't build strength by reading about lifting weights.<br />
              You train.
            </p>
            <p>
              You don't gain endurance by studying running form.<br />
              You run.
            </p>
            <p>
              Communication works the same way.
            </p>
            <p>
              If you want clarity when it matters,<br />
              you have to practice clarity when it matters.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — WHY COGNIFY EXISTS */}
      <section className="px-6" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-[40px] font-bold text-gray-900 mb-6">
            So I built a gym for communication.
          </h2>
          
          <div className="max-w-[640px] text-lg text-gray-700 leading-relaxed mb-10">
            <p>
              Not a course.<br />
              Not a workshop.<br />
              Not a list of tips.
            </p>
            <p className="mt-4">
              A training environment.
            </p>
          </div>

          {/* Three Feature Blocks */}
          <div className="max-w-[800px] space-y-6">
            {/* Block 1 */}
            <div className="flex items-start gap-6 bg-gray-50 rounded-2xl p-6">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5CB3FF] to-[#9D7BF5] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Short, timed reps
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Train under pressure. Every session simulates real-world constraints to build communication muscle memory.
                </p>
              </div>
            </div>

            {/* Block 2 */}
            <div className="flex items-start gap-6 bg-gray-50 rounded-2xl p-6">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9D7BF5] to-[#E86DE1] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Immediate feedback
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  AI scoring across clarity, structure, specificity, pacing, and presence.
                </p>
              </div>
            </div>

            {/* Block 3 */}
            <div className="flex items-start gap-6 bg-gray-50 rounded-2xl p-6">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5CB3FF] to-[#E86DE1] flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Measurable growth
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  Every rep tracked. Every pattern visible. No guesswork — just progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — WHAT COGNIFY STANDS FOR */}
      <section className="px-6 bg-gray-50" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 mb-10 text-center">
            What Cognify stands for
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5]"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-2">
                Clarity over complexity
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Simple, structured communication beats clever thinking under pressure.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9D7BF5] to-[#E86DE1]"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-2">
                Reps over theory
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Reading doesn't build skill. Practice does.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#5CB3FF] to-[#E86DE1]"></div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-2">
                Measurable growth over vague confidence
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Every rep is scored. Every pattern is visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — FINAL CTA */}
      <section className="px-6" style={{ paddingTop: '80px', paddingBottom: '120px' }}>
        <div className="max-w-[640px] mx-auto text-center">
          <h2 className="text-[32px] font-bold text-gray-900 mb-6">
            This is just the beginning.
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-8">
            Cognify is for people who want to communicate clearly when it counts.
          </p>
          
          <button
            onClick={() => { navigate("/signup"); window.scrollTo(0, 0); }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white px-8 py-3.5 rounded-full font-semibold text-base hover:opacity-90 transition-opacity shadow-md"
          >
            Start your first rep
            <span>→</span>
          </button>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>
    </div>
  );
}
