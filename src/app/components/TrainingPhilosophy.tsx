export function TrainingPhilosophy() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Training through reps, not evaluation
            </h2>
            
            <p className="text-gray-600 leading-relaxed">
              The Communication Gym does not judge performance through pass or fail outcomes. There are no "right" answers, no scripts to memorize, and no pressure to be perfect.
            </p>

            <p className="text-gray-600 leading-relaxed">
              Each rep builds familiarity with structured thinking, reduces hesitation, and increases comfort speaking under pressure.
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-2xl p-8 border border-[#9D7BF5]/30 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">No pass or fail</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">No scripts to memorize</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <p className="text-gray-700">No pressure to be perfect</p>
              </div>
            </div>

            <div className="pt-6 border-t border-[#9D7BF5]/30">
              <p className="text-sm text-gray-600 italic">
                The Gym is not something you complete. It's something you return to — like a physical gym.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
