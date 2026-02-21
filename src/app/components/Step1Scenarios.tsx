import { MessageSquare, Lightbulb, BookOpen, MessageCircle, Users, Shield } from "lucide-react";

export function Step1Scenarios() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 space-y-6">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Step 1: Choose a real world scenario
          </h2>
          
          <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
            Cognify does not train theory. It trains real conversations you actually face.<br />
            Each rep is built around a specific situation, audience, and time constraint.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Interview Question</h3>
            <p className="text-gray-600 text-sm">Answer behavioral questions with structure</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Lightbulb className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Pitch an Idea</h3>
            <p className="text-gray-600 text-sm">Explain value clearly and concisely</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Explain a Concept</h3>
            <p className="text-gray-600 text-sm">Make complex ideas simple</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Give Feedback</h3>
            <p className="text-gray-600 text-sm">Deliver criticism with clarity</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Lead a Meeting</h3>
            <p className="text-gray-600 text-sm">Set direction and drive alignment</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl hover:border-[#9D7BF5]/30 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Handle Objection</h3>
            <p className="text-gray-600 text-sm">Address concerns with confidence</p>
          </div>
        </div>
      </div>
    </section>
  );
}
