"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, TrendingUp, Clock } from "lucide-react";

/**
 * Interactive ROI calculator for the /for-teams page.
 *
 * Three-band recovery model + payback period + tiered pricing.
 *
 *   weekly_loss_hrs = team_size × meeting_hrs_weekly × (unclear_pct / 100)
 *   annual_loss_$   = weekly_loss_hrs × hourly_rate × WEEKS_PER_YEAR(46)
 *
 *   recovers_$[band]    = annual_loss_$ × RECOVERY_BANDS[band]
 *   seat_price          = pricingTier(team_size)
 *   annual_cost_$       = team_size × seat_price
 *   payback_months      = annual_cost_$ / (recovers_expected / 12)
 *
 * Bands replace the old single-point 30% number with a defensible range
 * the buyer can audit and pick from. Conservative is what we'd be willing
 * to commit to in a pilot SLA; expected is the median we see post-12-week
 * cadence; optimistic is high-adherence teams.
 */

const WEEKS_PER_YEAR = 46;

export const RECOVERY_BANDS = {
  conservative: 0.12,
  expected: 0.22,
  optimistic: 0.32,
} as const;

type BandKey = keyof typeof RECOVERY_BANDS;

const BAND_LABELS: Record<BandKey, string> = {
  conservative: "Conservative",
  expected: "Expected",
  optimistic: "Optimistic",
};

const BAND_DESCRIPTIONS: Record<BandKey, string> = {
  conservative:
    "What we'd be willing to commit to in a pilot SLA. Assumes ~50% rep adherence, mixed engagement.",
  expected:
    "Median post-12-week recovery we see in pilot teams running 4+ daily reps/week with full team enrolment.",
  optimistic:
    "High-adherence teams (90%+ daily rep completion) where managers actively reinforce takeaways in standup.",
};

export const PRICING_TIERS = [
  { maxSeats: 50, pricePerSeat: 180, label: "1–50 seats" },
  { maxSeats: 250, pricePerSeat: 144, label: "51–250 seats" },
  { maxSeats: Infinity, pricePerSeat: 120, label: "250+ seats (custom quote)" },
] as const;

function pricingTier(teamSize: number) {
  return (
    PRICING_TIERS.find((t) => teamSize <= t.maxSeats) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]!
  );
}

const DEFAULTS = {
  teamSize: 25,
  meetingHoursWeekly: 12,
  unclearPct: 20,
  hourlyCost: 125,
  band: "expected" as BandKey,
};

export function ROICalculator() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [teamSize, setTeamSize] = useState(() =>
    Number(searchParams.get("team")) || DEFAULTS.teamSize,
  );
  const [meetingHoursWeekly, setMeetingHoursWeekly] = useState(() =>
    Number(searchParams.get("hrs")) || DEFAULTS.meetingHoursWeekly,
  );
  const [unclearPct, setUnclearPct] = useState(() =>
    Number(searchParams.get("pct")) || DEFAULTS.unclearPct,
  );
  const [hourlyCost, setHourlyCost] = useState(() =>
    Number(searchParams.get("rate")) || DEFAULTS.hourlyCost,
  );
  const [band, setBand] = useState<BandKey>(() => {
    const b = searchParams.get("band");
    return b === "conservative" || b === "expected" || b === "optimistic"
      ? b
      : DEFAULTS.band;
  });

  // Debounced URL persistence so a salesperson can copy a link with the
  // prospect's exact assumptions baked in.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (teamSize !== DEFAULTS.teamSize) params.set("team", String(teamSize));
      if (meetingHoursWeekly !== DEFAULTS.meetingHoursWeekly)
        params.set("hrs", String(meetingHoursWeekly));
      if (unclearPct !== DEFAULTS.unclearPct)
        params.set("pct", String(unclearPct));
      if (hourlyCost !== DEFAULTS.hourlyCost)
        params.set("rate", String(hourlyCost));
      if (band !== DEFAULTS.band) params.set("band", band);
      const query = params.toString();
      const nextUrl = query ? `?${query}` : window.location.pathname;
      router.replace(nextUrl, { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [teamSize, meetingHoursWeekly, unclearPct, hourlyCost, band, router]);

  const computed = useMemo(() => {
    const weeklyLossHrs = teamSize * meetingHoursWeekly * (unclearPct / 100);
    const annualLossUsd = weeklyLossHrs * hourlyCost * WEEKS_PER_YEAR;
    const annualHoursLost = weeklyLossHrs * WEEKS_PER_YEAR;

    const recovers = {
      conservative: Math.round(annualLossUsd * RECOVERY_BANDS.conservative),
      expected: Math.round(annualLossUsd * RECOVERY_BANDS.expected),
      optimistic: Math.round(annualLossUsd * RECOVERY_BANDS.optimistic),
    };

    const tier = pricingTier(teamSize);
    const annualCost = teamSize * tier.pricePerSeat;

    const monthlyExpectedRecovery = recovers.expected / 12;
    const paybackMonths =
      monthlyExpectedRecovery > 0
        ? annualCost / monthlyExpectedRecovery
        : Infinity;

    return {
      annualHoursLost: Math.round(annualHoursLost),
      annualLossUsd: Math.round(annualLossUsd),
      recovers,
      tier,
      annualCost,
      paybackMonths,
    };
  }, [teamSize, meetingHoursWeekly, unclearPct, hourlyCost]);

  const selectedRecovers = computed.recovers[band];

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="grid gap-10 p-8 md:p-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-purple/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              <Calculator className="size-3.5" />
              ROI calculator
            </div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
              What does unclear communication actually cost you?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 md:text-base">
              Tune the inputs. Numbers update live. Pick the recovery band you&rsquo;re willing to defend internally. The model is spelled out below.
            </p>

            <div className="mt-8 space-y-5">
              <Slider
                label="Team size"
                value={teamSize}
                onChange={setTeamSize}
                min={5}
                max={500}
                step={5}
                format={(v) => `${v} ${v === 1 ? "person" : "people"}`}
              />
              <Slider
                label="Meeting hours per person per week"
                value={meetingHoursWeekly}
                onChange={setMeetingHoursWeekly}
                min={2}
                max={30}
                step={1}
                format={(v) => `${v}h / week`}
              />
              <Slider
                label="Share of meeting time lost to unclear communication"
                value={unclearPct}
                onChange={setUnclearPct}
                min={5}
                max={45}
                step={1}
                format={(v) => `${v}%`}
              />
              <Slider
                label="Fully-loaded hourly rate (salary + overhead)"
                value={hourlyCost}
                onChange={setHourlyCost}
                min={50}
                max={400}
                step={5}
                format={(v) => `$${v}/hr`}
              />
            </div>

            <div className="mt-8">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Recovery band
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(RECOVERY_BANDS) as BandKey[]).map((key) => {
                  const active = band === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBand(key)}
                      className={[
                        "rounded-xl border px-3 py-2.5 text-left transition",
                        active
                          ? "border-brand-purple bg-brand-purple/10 ring-2 ring-brand-purple/20"
                          : "border-ink-200 bg-white hover:border-brand-purple/40",
                      ].join(" ")}
                      aria-pressed={active}
                    >
                      <p
                        className={[
                          "text-[11px] font-bold uppercase tracking-wider",
                          active ? "text-brand-purple" : "text-ink-600",
                        ].join(" ")}
                      >
                        {BAND_LABELS[key]}
                      </p>
                      <p className="mt-0.5 text-base font-extrabold tabular-nums text-ink-900">
                        {Math.round(RECOVERY_BANDS[key] * 100)}%
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
                {BAND_DESCRIPTIONS[band]}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="brand-gradient-soft rounded-2xl p-6 md:p-8">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Hours lost / year
                </p>
                <p className="text-[11px] text-ink-400">all {teamSize} people</p>
              </div>
              <p className="mt-1 text-4xl font-extrabold tabular-nums text-ink-900">
                {computed.annualHoursLost.toLocaleString()}
              </p>

              <div className="mt-6 flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Annual cost of miscommunication
                </p>
              </div>
              <p className="mt-1 text-4xl font-extrabold tabular-nums text-ink-900">
                ${computed.annualLossUsd.toLocaleString()}
              </p>

              <div className="mt-8 rounded-xl border border-white bg-white/80 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                  <TrendingUp className="size-3.5" strokeWidth={2.5} />
                  After 12 weeks of daily reps
                </div>

                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Cognify recovers
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700 md:text-4xl">
                    ${selectedRecovers.toLocaleString()}
                    <span className="ml-2 text-sm font-bold text-ink-500">/ yr</span>
                  </p>
                  <RangeBar
                    low={computed.recovers.conservative}
                    mid={computed.recovers.expected}
                    high={computed.recovers.optimistic}
                    selected={selectedRecovers}
                  />
                  <p className="mt-1 text-[11px] text-ink-500 tabular-nums">
                    Range: ${computed.recovers.conservative.toLocaleString()}{" "}
                    &ndash; ${computed.recovers.optimistic.toLocaleString()}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 text-xs">
                  <Stat
                    icon={<Clock className="size-3.5" />}
                    label="Pays back in"
                    value={
                      Number.isFinite(computed.paybackMonths)
                        ? `${computed.paybackMonths.toFixed(1)} mo`
                        : "—"
                    }
                    tone="positive"
                  />
                  <Stat
                    label="Annual cost"
                    value={`$${computed.annualCost.toLocaleString()}`}
                  />
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                  Payback uses the <span className="font-semibold">expected</span> band ($
                  {computed.recovers.expected.toLocaleString()}/yr) regardless of
                  the band you select above &mdash; we won&rsquo;t pitch payback
                  on the optimistic case.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-[11px] leading-relaxed text-ink-600">
              <p className="font-semibold text-ink-700">
                Pricing tier: {computed.tier.label}
              </p>
              <p className="mt-1">
                ${computed.tier.pricePerSeat}/seat/year at your team size.
                Tiers: 1&ndash;50 = $180, 51&ndash;250 = $144, 250+ = custom
                quote (typically $120 or below). No hidden upsell.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-ink-700">Methodology:</span>{" "}
                conservative = 12% recovery, expected = 22%, optimistic = 32%.
                Bands replace a single-point claim so you can pick the
                assumption you&rsquo;re comfortable defending. Annual loss
                assumes {WEEKS_PER_YEAR} effective working weeks. Hourly rate
                should include salary + benefits + overhead.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-ink-800">{label}</label>
        <span className="tabular-nums text-sm font-bold text-ink-900">
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand-purple"
        aria-label={label}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "positive";
  icon?: React.ReactNode;
}) {
  const color = tone === "positive" ? "text-emerald-700" : "text-ink-900";
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}

function RangeBar({
  low,
  mid,
  high,
  selected,
}: {
  low: number;
  mid: number;
  high: number;
  selected: number;
}) {
  const range = Math.max(high - low, 1);
  const pct = ((selected - low) / range) * 100;
  const midPct = ((mid - low) / range) * 100;
  return (
    <div
      className="mt-3 h-2 w-full rounded-full bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-600"
      role="img"
      aria-label={`Recovery band selector at $${selected.toLocaleString()}`}
    >
      <div className="relative h-full">
        <div
          className="absolute -top-1 h-4 w-1 rounded bg-ink-300"
          style={{ left: `${Math.min(100, Math.max(0, midPct))}%` }}
          aria-hidden="true"
          title="Expected midpoint"
        />
        <div
          className="absolute -top-1.5 h-5 w-2 rounded bg-emerald-900"
          style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
