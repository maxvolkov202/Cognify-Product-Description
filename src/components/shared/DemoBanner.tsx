import { Lock } from "lucide-react";

/**
 * Prominent full-width banner that flags a page as showing mock / demo data.
 * Used on /leaderboard and the empty-state of /friends until we have a real
 * cohort to rank against. Designed to be unmissable — Product Sweep #6
 * flagged the previous amber pill as "too subtle" so this uses a strong
 * gradient hero treatment.
 */
export function DemoBanner({
  title = "Demo mode",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 p-5 shadow-sm md:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
      <div className="flex items-start gap-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-amber-950 shadow-sm">
          <Lock className="size-5" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-800">
            {title} · everything below is fake data
          </p>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-amber-950">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
