import { Brain, Repeat, LineChart } from "lucide-react";

export function WhySystemWorks() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-6">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
            Why this system works
          </h2>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Confidence is not memorization. It is cognitive organization under pressure.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-2xl flex items-center justify-center mx-auto">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Structure reduces cognitive load</h3>
            <p className="text-gray-600 leading-relaxed">
              Frameworks give your brain a path to follow, freeing mental energy for the content itself.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-2xl flex items-center justify-center mx-auto">
              <Repeat className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Repetition builds automatic thinking</h3>
            <p className="text-gray-600 leading-relaxed">
              The more you practice, the less you have to think. Clarity becomes instinct.
            </p>
          </div>

          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-2xl flex items-center justify-center mx-auto">
              <LineChart className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold">Feedback accelerates correction</h3>
            <p className="text-gray-600 leading-relaxed">
              Immediate, specific feedback helps you adjust before bad habits form.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
