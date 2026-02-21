import { useState } from "react";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { FeatureSection } from "./components/FeatureSection";
import { DifferenceSection } from "./components/DifferenceSection";
import { FinalCTA } from "./components/FinalCTA";
import { SampleFeedbackModal } from "./components/SampleFeedbackModal";
import { MessageSquare, Target, TrendingUp } from "lucide-react";

export default function HomePage() {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#5CB3FF]/3 to-white">
      <Navigation currentPage="home" />
      
      <Hero />

      <FeatureSection
        headline="Practice real conversations, not theory"
        description="Cognify trains the moments that actually define careers. You practice explaining ideas without preparation, under time pressure, and in realistic scenarios. Each rep builds clarity through repetition, not memorization."
        imageSrc="https://images.unsplash.com/photo-1752118464988-2914fb27d0f0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBmb2N1c2VkJTIwcHJvZmVzc2lvbmFsJTIwdHJhaW5pbmd8ZW58MXx8fHwxNzcwNzc5NDYyfDA&ixlib=rb-4.1.0&q=80&w=1080"
        imageAlt="Focused professional training"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 space-y-2.5">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Interview Prep</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Practice answering tough questions with structure and clarity.</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 space-y-2.5">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Pitch Training</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Explain ideas clearly in sixty to ninety seconds.</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 space-y-2.5">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Meeting Presence</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Think clearly and speak with confidence in high-stakes conversations.</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 space-y-2.5">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Feedback Delivery</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Deliver clear, constructive feedback without rambling or hesitation.</p>
          </div>
        </div>
      </FeatureSection>

      <FeatureSection
        headline="Get feedback that improves the next rep"
        description="Feedback is focused and actionable. You see what landed, what didn't, and exactly what to adjust on the next rep. There are no grades or scripts, just clear signals that help you improve through practice."
        imageSrc="https://images.unsplash.com/photo-1763905180930-892ee8d37ea6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwbW9kZXJuJTIwaW50ZXJmYWNlJTIwd29ya3NwYWNlfGVufDF8fHx8MTc3MDc3OTQ2Mnww&ixlib=rb-4.1.0&q=80&w=1080"
        imageAlt="Feedback interface"
        reverse
      >
        <div className="mb-4">
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="text-sm font-semibold text-[#9D7BF5] hover:text-[#8B6BE0] transition-colors underline underline-offset-2"
          >
            See a sample feedback screen →
          </button>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-xl border border-gray-100 space-y-5">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold mb-0.5">Strong opening</div>
                <div className="text-xs text-gray-600 leading-relaxed">You clearly stated your main point in the first 10 seconds.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold mb-0.5">Watch your pacing</div>
                <div className="text-xs text-gray-600 leading-relaxed">Try slowing down in the middle section to emphasize key points.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold mb-0.5">Clear structure</div>
                <div className="text-xs text-gray-600 leading-relaxed">Your answer followed a logical flow from problem to solution.</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-1.5">Filler words: 3 instances of "um" or "like"</div>
            <div className="text-xs text-gray-600">Duration: 1:24 / 1:30</div>
          </div>
        </div>
      </FeatureSection>

      <div className="py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Progress you can see over time</p>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                  Build confidence through repetition
                </h2>
              </div>
              <p className="text-base text-gray-600 leading-relaxed">
                Communication improves through reps. As you train, clarity, structure, and confidence compound naturally.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-xl border border-gray-100 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Clarity Score</span>
              <span className="text-xl font-bold">87%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '87%' }}></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Structure</span>
              <span className="text-xl font-bold">92%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '92%' }}></div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Confidence</span>
              <span className="text-xl font-bold">78%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full" style={{ width: '78%' }}></div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">24</div>
                <div className="text-xs text-gray-600 mt-0.5">Total Reps</div>
              </div>
              <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">7</div>
                <div className="text-xs text-gray-600 mt-0.5">This Week</div>
              </div>
              <div>
                <div className="text-2xl font-bold bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] bg-clip-text text-transparent">12</div>
                <div className="text-xs text-gray-600 mt-0.5">Day Streak</div>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      <DifferenceSection />

      <FinalCTA />

      <footer className="border-t border-gray-100 py-10 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p>&copy; 2026 Cognify. A communication training gym.</p>
        </div>
      </footer>

      <SampleFeedbackModal 
        isOpen={showFeedbackModal} 
        onClose={() => setShowFeedbackModal(false)} 
      />
    </div>
  );
}
