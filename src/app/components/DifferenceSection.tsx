import { Mic, Repeat, TrendingUp } from "lucide-react";

export function DifferenceSection() {
  return (
    <section className="py-12 px-6 bg-gradient-to-b from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-white">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
          Built for practice, not performance
        </h2>

        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <p className="text-base text-gray-700 leading-relaxed">
              You train by speaking, not watching
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <p className="text-base text-gray-700 leading-relaxed">
              You improve through repetition, not scripts
            </p>
          </div>

          <div className="space-y-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <p className="text-base text-gray-700 leading-relaxed">
              You build confidence by becoming capable
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
