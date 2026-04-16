import { notFound } from "next/navigation";
import { getValidationByToken } from "@/lib/db/queries/validation";
import { BlindRankingSurface } from "@/components/product/BlindRankingSurface";
import { Logo } from "@/components/shared/Logo";

export const dynamic = "force-dynamic";

export default async function PublicValidationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const validation = await getValidationByToken(token);

  if (!validation) {
    notFound();
  }

  const shuffled = [...validation.repIds]
    .map((id) => ({ id, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.id);

  return (
    <div className="min-h-screen bg-ink-50/60">
      <header className="border-b border-ink-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-6">
          <Logo />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Blind ranking
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            External validation
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
            Listen and rank.
          </h1>
          <p className="mt-1 max-w-2xl text-base text-ink-600">
            Someone you know has been practicing this topic. Listen to each attempt —
            no scores, no order cues — and rank them from clearest to least clear. Your
            ranking helps validate whether they&rsquo;re actually getting better.
          </p>
          <p className="mt-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm italic text-ink-700">
            &ldquo;{validation.topic}&rdquo;
          </p>
        </div>

        <div className="mt-10">
          <BlindRankingSurface
            token={validation.token}
            repIds={shuffled}
            reps={validation.reps.map((r) => ({
              id: r.id,
              durationMs: r.durationMs,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
