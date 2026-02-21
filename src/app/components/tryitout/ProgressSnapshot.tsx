import { BarChart3, Target, Clock } from "lucide-react";

interface ProgressSnapshotProps {
  repsCompleted: number;
}

export function ProgressSnapshot({ repsCompleted }: ProgressSnapshotProps) {
  return (
    <section className="py-16 px-6 bg-gradient-to-b from-white to-[#5CB3FF]/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold">Progress Snapshot</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Today</p>
            <p className="text-3xl font-bold">{repsCompleted}</p>
            <p className="text-sm text-gray-600 mt-1">reps completed</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mx-auto mb-4">
              <Target className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Focus trend</p>
            <p className="text-lg font-semibold">Improving</p>
            <p className="text-sm text-gray-600 mt-1">opening clarity</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm text-gray-600 mb-1">Average session</p>
            <p className="text-3xl font-bold">58</p>
            <p className="text-sm text-gray-600 mt-1">seconds</p>
          </div>
        </div>
      </div>
    </section>
  );
}
