import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Quote, Sparkles } from "lucide-react";
import {
  SKILL_DIMENSIONS,
  DIMENSION_LABELS,
  BAND_DEFINITIONS,
  type SkillDimension,
  type BandId,
} from "@/types/domain";
import { DIMENSION_ACCENTS } from "@/lib/skill-lab/mode-theme";
import {
  getExemplarsByBand,
  type Exemplar,
} from "@/lib/ai/exemplars";

export const metadata: Metadata = {
  title: "Exemplars · Application Lab · Cognify",
  description:
    "Hear what each score band sounds like — model lines per dimension authored against the rubric.",
};

/**
 * Pre-generate the 6 valid dim paths at build time. Anything else
 * triggers Next's static-not-found path and returns a real 404 status.
 * The page reads only from in-source exemplars catalog data, so static
 * generation is correct here — no DB / runtime deps to gate on.
 */
export function generateStaticParams() {
  // Segment is [slug] (shared with the Skill Lab application session
  // route); for exemplars the slug is a Core Skill dimension.
  return SKILL_DIMENSIONS.map((dimension) => ({ slug: dimension }));
}

export const dynamicParams = false;

/**
 * Ch.16c — Per-band exemplars page.
 *
 * Surface for "what does an X-band response sound like in dimension Y?"
 * Renders 5-band sections (Below Standard / Competent / Strong /
 * Excellent / Exceptional) plus a general footer for the original
 * untagged exemplars. Each exemplar card shows the topic, spoken
 * lines (formatted vertically so the user can scan rhythm), and the
 * tip explaining what makes it actually train the dimension.
 *
 * Poor (0-40) is intentionally omitted — modeling failure has no
 * pedagogical value (per master plan §Ch.16).
 */
export default async function ExemplarsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawDim } = await params;
  if (!(SKILL_DIMENSIONS as readonly string[]).includes(rawDim)) {
    notFound();
  }
  const dimension = rawDim as SkillDimension;
  const { byBand, general } = getExemplarsByBand(dimension);
  const accent = DIMENSION_ACCENTS[dimension];

  // Render bands in score order, ASCENDING (worst → best). Skip "poor"
  // per the master plan rationale.
  const visibleBands: BandId[] = [
    "below_standard",
    "competent",
    "strong",
    "excellent",
    "exceptional",
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:py-14">
      <Link
        href="/application-lab"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Back to Application Lab
      </Link>

      <header className="mb-10">
        <p
          className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: accent }}
        >
          {DIMENSION_LABELS[dimension]} · Exemplars
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          What each band sounds like
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink-600">
          Read these aloud. Each one is calibrated against the scoring rubric
          for {DIMENSION_LABELS[dimension]}. The differences between bands are
          deliberately small at the mid range and obvious at the extremes —
          that&rsquo;s where the work happens.
        </p>
      </header>

      <div className="space-y-12">
        {visibleBands.map((bandId) => (
          <BandSection
            key={bandId}
            bandId={bandId}
            exemplars={byBand[bandId] ?? []}
            accent={accent}
          />
        ))}
      </div>

      {general.length > 0 && (
        <section className="mt-16 border-t border-ink-200 pt-10">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-500">
            General exemplars
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-500">
            Cross-band model lines for {DIMENSION_LABELS[dimension]}. Useful
            for rep prep when you don&rsquo;t have a target band in mind.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {general.map((ex, i) => (
              <ExemplarCard key={i} exemplar={ex} accent={accent} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BandSection({
  bandId,
  exemplars,
  accent,
}: {
  bandId: BandId;
  exemplars: Exemplar[];
  accent: string;
}) {
  const band = BAND_DEFINITIONS.find((b) => b.id === bandId)!;
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400">
            {band.min}-{band.max}
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-ink-900">
            {band.label}
          </h2>
        </div>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white"
          style={{ backgroundColor: accent }}
        >
          {exemplars.length} exemplar{exemplars.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-ink-600">
        {band.description}
      </p>
      {exemplars.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-50/40 p-5 text-[12px] text-ink-500">
          {bandId === "exceptional"
            ? "No exceptional-band exemplars yet — exceptional reps fold the dimensions together so cleanly that they're hard to author from a single dim's angle. The Excellent band is the practical ceiling for training."
            : "Exemplars coming soon for this band."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exemplars.map((ex, i) => (
            <ExemplarCard key={i} exemplar={ex} accent={accent} />
          ))}
        </div>
      )}
    </section>
  );
}

function ExemplarCard({
  exemplar,
  accent,
}: {
  exemplar: Exemplar;
  accent: string;
}) {
  return (
    <article
      className="surface-card overflow-hidden p-5"
      style={{
        boxShadow: `inset 4px 0 0 0 ${accent}`,
      }}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-500">
        Topic
      </p>
      <p className="mt-1 text-[14px] font-bold leading-snug text-ink-900">
        {exemplar.topic}
      </p>

      <div className="mt-4 space-y-2 rounded-xl bg-ink-50 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-500">
          <Quote className="size-3" strokeWidth={2.5} aria-hidden="true" />
          Lines
        </p>
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-800">
          {exemplar.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex gap-2">
        <Sparkles
          className="mt-0.5 size-3.5 shrink-0"
          style={{ color: accent }}
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <p className="text-[12px] leading-relaxed text-ink-600">
          <span
            className="font-extrabold uppercase tracking-wider"
            style={{ color: accent }}
          >
            Listen for:{" "}
          </span>
          {exemplar.tip}
        </p>
      </div>
    </article>
  );
}
