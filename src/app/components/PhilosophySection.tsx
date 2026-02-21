import { Brain, Repeat, LineChart } from "lucide-react";

export function PhilosophySection() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-12">
          <div className="max-w-4xl">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-8">
              Practice over preparation
            </h2>
            
            <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
              <p>
                Preparation feels productive.<br />
                But real growth happens through repetition.
              </p>

              <p className="font-medium text-gray-900">
                Cognify is built on three principles:
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-4">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Structure reduces cognitive load</h3>
              <p className="text-gray-600 leading-relaxed">
                Frameworks act as mental rails that guide thinking under pressure.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-4">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
                <Repeat className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Repetition builds fluency</h3>
              <p className="text-gray-600 leading-relaxed">
                Speaking improves the same way fitness improves. Through consistent reps.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-4">
              <div className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
                <LineChart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Feedback accelerates improvement</h3>
              <p className="text-gray-600 leading-relaxed">
                Immediate, focused insights close the gap between intention and execution.
              </p>
            </div>
          </div>

          <div className="max-w-4xl">
            <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
              <p>Over time, structure becomes internalized.</p>
              <p>You think more clearly before you even begin speaking.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
