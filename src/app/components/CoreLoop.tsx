import { MessageSquare, LayoutList, Mic, Repeat } from "lucide-react";

export function CoreLoop() {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
            The core practice loop
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Each session follows a simple, repeatable flow designed to fit into a busy schedule while producing meaningful improvement.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-6">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Choose a scenario</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Pick a real-world situation you want to practice
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-6">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
              <LayoutList className="w-6 h-6 text-white" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Select a framework</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Use structure to guide your thinking
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-6">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Speak out loud</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Explain for a fixed time without notes
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 space-y-6">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center">
              <Repeat className="w-6 h-6 text-white" />
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-semibold">Repeat to improve</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Build clarity and confidence through reps
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
