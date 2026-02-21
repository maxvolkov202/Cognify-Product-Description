export function HowItWorksHero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight">
              How Cognify Works
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              A focused system built on structured reps, high-precision feedback, and measurable improvement.
            </p>

            <div className="pt-4">
              <button className="px-8 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-full text-lg font-medium hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5">
                Start your first rep
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Choose your scenario</h3>
                <span className="text-sm text-gray-500">Step 1 of 3</span>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl border-2 border-[#9D7BF5]/30">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1.5 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                    <div>
                      <p className="font-semibold text-gray-900">Pitch an Idea</p>
                      <p className="text-sm text-gray-600 mt-1">Explain value in 60 seconds</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1.5 bg-gray-300 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-gray-900">Interview Question</p>
                      <p className="text-sm text-gray-600 mt-1">Tell me about yourself</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1.5 bg-gray-300 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-gray-900">Explain a Concept</p>
                      <p className="text-sm text-gray-600 mt-1">Make complexity clear</p>
                    </div>
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors">
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
