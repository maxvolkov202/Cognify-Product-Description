import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Prior-art section — names the tools buyers already know and explains
 * where Cognify sits relative to each. We take the honest lane: every
 * tool on this list is good at what it does. Cognify is the odd one
 * because it's not polishing delivery or analyzing a meeting — it's a
 * training environment that builds the underlying skill.
 *
 * Research sources:
 *   - Poised (poised.com) — real-time coach overlay during meetings.
 *   - Orai (orai.com) — public-speaking drill app with AI feedback.
 *   - Speeko (speeko.co) — speech-pattern analyzer for presenters.
 *   - Yoodli (yoodli.ai) — meeting recorder with filler/pace feedback.
 *   - Toastmasters (toastmasters.org) — peer-led speaking group model.
 */

type Tool = {
  name: string;
  lane: string;
  similarity: string;
  difference: string;
};

const TOOLS: Tool[] = [
  {
    name: "Poised",
    lane: "Live meeting coach (real-time overlay)",
    similarity: "Transcript-based feedback on meetings.",
    difference:
      "Improves the meeting you're currently in. Cognify trains the skill before the meeting — so the overlay isn't needed.",
  },
  {
    name: "Yoodli",
    lane: "Meeting recorder + analyzer",
    similarity: "Filler-word detection, pacing signals.",
    difference:
      "Analyzes what already happened. Cognify runs short daily reps with pressure and a feedback loop — a training environment, not a review tool.",
  },
  {
    name: "Orai",
    lane: "Public-speaking drill app",
    similarity: "Timed speaking drills with voice-based feedback.",
    difference:
      "Built for public speaking (stage). Cognify is built for everyday communication — stakeholder pushback, under-pressure structure, adaptation mid-conversation.",
  },
  {
    name: "Speeko",
    lane: "Speech-pattern analyzer",
    similarity: "AI-scored delivery signals (pace, tone).",
    difference:
      "One rep at a time. Cognify compounds — tomorrow's rep targets yesterday's weakest dimension, and the improvement curve is the product.",
  },
  {
    name: "Toastmasters",
    lane: "Peer-led speaking group",
    similarity: "Structured practice environment with feedback.",
    difference:
      "Weekly, in-person, group-scheduled. Cognify is 10 minutes, solo, scored against six dimensions tied to research — and it's portable.",
  },
];

export function PriorArt() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Prior art
        </p>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          What makes Cognify{" "}
          <span className="brand-gradient-text">different.</span>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-ink-600 md:text-lg">
          There are good tools in this space. We built Cognify because none
          of them were training environments — they were real-time coaches
          (live overlay), recorders (post-meeting review), or drill apps
          (one rep at a time). Here&rsquo;s the honest lane for each.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-ink-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <th className="px-5 py-4">Tool</th>
              <th className="px-5 py-4">Their lane</th>
              <th className="px-5 py-4">What we share</th>
              <th className="px-5 py-4">What&rsquo;s different about Cognify</th>
            </tr>
          </thead>
          <tbody>
            {TOOLS.map((t) => (
              <tr key={t.name} className="border-t border-ink-200 align-top text-sm">
                <td className="px-5 py-4 font-bold text-ink-900">{t.name}</td>
                <td className="px-5 py-4 text-ink-600">{t.lane}</td>
                <td className="px-5 py-4 text-emerald-800">
                  <span className="inline-flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    <span>{t.similarity}</span>
                  </span>
                </td>
                <td className="px-5 py-4 text-ink-800">
                  <span className="inline-flex items-start gap-1.5">
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-brand-purple" />
                    <span>{t.difference}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 max-w-3xl text-xs leading-relaxed text-ink-500">
        The test we use internally: if a tool&rsquo;s happy path is{" "}
        <em>&ldquo;the meeting already happened&rdquo;</em> or{" "}
        <em>&ldquo;the meeting is happening now&rdquo;</em>, it&rsquo;s an
        analyzer or a coach — not a training environment. Cognify&rsquo;s
        happy path is <em>&ldquo;do a rep when nothing else is happening&rdquo;</em>.
        That changes what the product has to be.
      </p>
    </section>
  );
}
