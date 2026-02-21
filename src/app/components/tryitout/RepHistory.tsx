import { User, Layers, TrendingUp } from "lucide-react";
import { Rep } from "../../types/rep";
import { FRAMEWORKS } from "../../types/rep";

interface RepHistoryProps {
  reps: Rep[];
  onSelectRep: (rep: Rep) => void;
}

export function RepHistory({ reps, onSelectRep }: RepHistoryProps) {
  if (reps.length === 0) {
    return (
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="bg-white rounded-2xl border border-gray-200 p-12">
            <p className="text-gray-600">
              Your rep history will appear here after you complete your first training session.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Training History</h2>
          <p className="text-gray-600">{reps.length} rep{reps.length !== 1 ? 's' : ''} completed</p>
        </div>

        <div className="space-y-4">
          {reps.map((rep) => {
            const framework = FRAMEWORKS.find(f => f.id === rep.framework);
            const date = new Date(rep.completedAt);
            const timeAgo = getTimeAgo(date);

            return (
              <button
                key={rep.id}
                onClick={() => onSelectRep(rep)}
                className="w-full bg-white rounded-xl border border-gray-200 p-6 hover:border-[#9D7BF5] hover:shadow-lg transition-all text-left group"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#9D7BF5] mb-1">
                        {rep.scenario}
                      </h3>
                      <p className="text-sm text-gray-500">{rep.scenarioCategory}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-[#9D7BF5]" />
                        <span className="text-2xl font-bold text-[#9D7BF5]">{rep.clarityScore}</span>
                      </div>
                      <p className="text-xs text-gray-500">Clarity Score</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>{rep.audience}</span>
                    </div>
                    {framework && (
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4" />
                        <span>{framework.name}</span>
                      </div>
                    )}
                    {/* Rep Type Badge */}
                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                      rep.repType === "cold-start" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-green-100 text-green-700"
                    }`}>
                      {rep.repType === "cold-start" ? "Cold Start" : "Improvement"}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{timeAgo}</p>
                    <span className="text-sm text-[#9D7BF5] group-hover:underline">
                      View details →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}
