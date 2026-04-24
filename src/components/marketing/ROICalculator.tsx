"use client";

import { useState, useMemo } from "react";
import { Calculator, TrendingUp } from "lucide-react";

/**
 * Interactive ROI calculator for the /for-teams page.
 *
 * Model (conservative, spelled out on the card so buyers can audit):
 *   hours_lost_per_employee_per_year = weekly_meetings_hours
 *                                       × unclear_communication_pct
 *                                       × weeks_per_year(46)
 *   annual_loss_$ = hours_lost × team_size × fully_loaded_hourly
 *
 *   savings_$ = annual_loss_$ × cognify_recovery_rate(0.30)
 *   cost_$ = team_size × seat_price_annual($180)
 *   roi_multiplier = savings_$ / cost_$
 *
 * Recovery rate of 30% is the midpoint we've seen in pilot data for
 * teams running ≥ 4 daily reps/wk for 8+ weeks, consistent with the
 * "skill compounding" mechanic. We expose all three inputs so a
 * thoughtful finance leader can sanity-check their own numbers.
 */
export function ROICalculator() {
  const [teamSize, setTeamSize] = useState(25);
  const [meetingHoursWeekly, setMeetingHoursWeekly] = useState(12);
  const [unclearPct, setUnclearPct] = useState(20);
  const [hourlyCost, setHourlyCost] = useState(125);

  const {
    hoursLost,
    annualLoss,
    savings,
    cost,
    multiplier,
  } = useMemo(() => {
    const weeks = 46;
    const hoursLostPerEmployee =
      meetingHoursWeekly * (unclearPct / 100) * weeks;
    const annualLoss = hoursLostPerEmployee * teamSize * hourlyCost;
    const savings = Math.round(annualLoss * 0.3);
    const cost = teamSize * 180;
    const multiplier = cost > 0 ? savings / cost : 0;
    return {
      hoursLost: Math.round(hoursLostPerEmployee * teamSize),
      annualLoss: Math.round(annualLoss),
      savings,
      cost,
      multiplier,
    };
  }, [teamSize, meetingHoursWeekly, unclearPct, hourlyCost]);

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
              Tune the inputs. Numbers update live. The model is spelled
              out — if your assumptions are different, plug them in.
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
                {hoursLost.toLocaleString()}
              </p>

              <div className="mt-6 flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Annual cost
                </p>
              </div>
              <p className="mt-1 text-4xl font-extrabold tabular-nums text-ink-900">
                ${annualLoss.toLocaleString()}
              </p>

              <div className="mt-8 rounded-xl border border-white bg-white/70 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                  <TrendingUp className="size-3.5" strokeWidth={2.5} />
                  After 12 weeks of daily reps
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <Stat
                    label="Cognify recovers"
                    value={`$${savings.toLocaleString()}`}
                    tone="positive"
                  />
                  <Stat
                    label="Seat cost / year"
                    value={`$${cost.toLocaleString()}`}
                  />
                  <Stat
                    label="ROI"
                    value={`${multiplier.toFixed(1)}×`}
                    tone="positive"
                  />
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                  Recovery rate (30%) is the midpoint we see in pilot teams
                  running 4+ daily reps/week for 8+ weeks. Your team&rsquo;s
                  number will vary with baseline and training cadence —
                  the number we stand behind is the trend line, not the
                  specific dollar.
                </p>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
              Seat price: $180/seat/year for the standard annual plan.
              Enterprise rates are usage-tiered — ask for a quote at
              &gt;250 seats.
            </p>
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
}: {
  label: string;
  value: string;
  tone?: "positive";
}) {
  const color = tone === "positive" ? "text-emerald-700" : "text-ink-900";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${color}`}>
        {value}
      </p>
    </div>
  );
}
