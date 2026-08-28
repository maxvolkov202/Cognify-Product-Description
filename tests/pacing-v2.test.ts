/**
 * Grading plan WS4 — pacing rebuilt from the rubric's own signals.
 * Run: npx tsx tests/pacing-v2.test.ts
 */
import { scorePacing, pacingRateSubScore } from "@/lib/scoring/deterministic";
import { extractSignals } from "@/lib/scoring/signals/audio";
import type { SignalBundle } from "@/lib/scoring/signals/audio";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const base: SignalBundle = {
  wordCount: 150, durationMs: 60_000, timeBudgetMs: 60_000, wpm: 150,
  fillerCount: 0, fillerRate: 0, hedgeCount: 0, hedgeRate: 0, timeBudgetRatio: 1,
  longPauseCount: 0, stallCount: 0, clausePauseCount: 0, midPhrasePauseCount: 0,
  pauseP50Ms: 300, pauseP95Ms: 800, restartCount: 0,
  quartileWpm: [150, 150, 150, 150], quartileWpmVariance: 0, finalQuartileDelta: 0,
};
const S = (over: Partial<SignalBundle>) => scorePacing({ ...base, ...over });

// ── rate: band, graded docking above, mild below, n/a under 8 s ──
{
  check("in band → rate 100", pacingRateSubScore(150, 60_000) === 100);
  check("130 and 165 are in band", pacingRateSubScore(130, 60_000) === 100 && pacingRateSubScore(165, 60_000) === 100);
  const above = [170, 180, 190, 205, 220, 240].map((w) => pacingRateSubScore(w, 60_000));
  check("above 170: monotone decreasing", above.every((v, i) => i === 0 || v < above[i - 1]!), above.join(","));
  check("220 wpm lands ≤ 40 (edge rule 3: fast is not competent)", pacingRateSubScore(220, 60_000) <= 40);
  const below = [125, 115, 105, 90, 70].map((w) => pacingRateSubScore(w, 60_000));
  check("below 130: monotone decreasing", below.every((v, i) => i === 0 || v < below[i - 1]!), below.join(","));
  check("asymmetric: 190 wpm docked harder than 110 wpm", pacingRateSubScore(190, 60_000) < pacingRateSubScore(110, 60_000));
  check("under 8 s → neutral 85", pacingRateSubScore(300, 5_000) === 85 && pacingRateSubScore(40, 5_000) === 85);
}

// ── whole-score behaviour ──
{
  const clean = S({});
  check("clean in-band rep scores high (≥ 90)", clean.score >= 90, String(clean.score));
  check("sub-scores present", Object.keys(clean.subScores).length === 5);
  check("idempotent", S({}).score === clean.score && S({}).feedback === clean.feedback);
  const fast = S({ wpm: 200, quartileWpm: [200, 200, 200, 200] });
  check("200 wpm scores lower than in-band", fast.score < clean.score);
  const rushed = S({ quartileWpm: [120, 120, 120, 220], quartileWpmVariance: 1875, finalQuartileDelta: 0.29 });
  const rushedMore = S({ quartileWpm: [110, 110, 110, 250], quartileWpmVariance: 3675, finalQuartileDelta: 0.4 });
  check("quartile instability docks", rushed.score < clean.score && rushedMore.score < rushed.score, `${rushed.score} ${rushedMore.score}`);
  const withPauses = S({ clausePauseCount: 4 });
  check("clause-end pauses lift the score", withPauses.score > clean.score, `${withPauses.score} vs ${clean.score}`);
  const stalls = S({ stallCount: 2, longPauseCount: 2 });
  check("stalls dock", stalls.score < clean.score);
  const mid = S({ midPhrasePauseCount: 3 });
  check("mid-phrase pauses dock", mid.score < clean.score);
  check("a pause after a point beats the same pause mid-phrase", S({ clausePauseCount: 2 }).score > S({ midPhrasePauseCount: 2 }).score);
  const fillers = [0, 2, 4, 6, 8, 10].map((r) => S({ fillerRate: r }).score);
  check("filler rate monotone non-increasing", fillers.every((v, i) => i === 0 || v <= fillers[i - 1]!), fillers.join(","));
  check("under budget never docks", S({ timeBudgetRatio: 0.2, durationMs: 12_000, quartileWpm: [150,150,150,150] }).subScores.budget === 100);
  check("over budget docks", S({ timeBudgetRatio: 1.4 }).score < clean.score);
  const shortRep = S({ durationMs: 6_000, wpm: 300, quartileWpm: [300, 300, 300, 300] });
  check("6 s rep: rate and stability neutral, no rate dock", shortRep.subScores.rate === 85 && shortRep.subScores.stability === 85);
  check("floor and ceiling respected", S({ wpm: 260, fillerRate: 12, hedgeRate: 5, stallCount: 6, midPhrasePauseCount: 8, timeBudgetRatio: 1.8, quartileWpm: [100,300,100,300], quartileWpmVariance: 10000, finalQuartileDelta: 0.5 }).score >= 20 && clean.score <= 98);
}

// ── spread: the audit's clump (79% at exactly 92) must be gone ──
{
  const seen = new Set<number>();
  for (const wpm of [95, 110, 125, 140, 150, 160, 170, 175, 180, 185, 195, 215])
    for (const f of [0, 1.5, 3, 5, 7])
      for (const p of [0, 2])
        seen.add(S({ wpm, fillerRate: f, clausePauseCount: p, quartileWpm: [wpm, wpm, wpm, wpm] }).score);
  check("≥ 25 unique scores over a plausible grid", seen.size >= 25, String(seen.size));
}

// ── feedback is generated from the same numbers ──
{
  const r = S({ wpm: 182, quartileWpm: [182, 182, 182, 182], fillerRate: 3.2, stallCount: 1, longPauseCount: 1 });
  check("feedback quotes the measured wpm", /182 words per minute/.test(r.feedback), r.feedback);
  check("feedback says above the band", /above the 130-165/.test(r.feedback));
  check("feedback quotes the filler rate", /3\.2 fillers a minute/.test(r.feedback));
  check("feedback mentions the stall", /1 stall over 3 seconds/.test(r.feedback));
  check("feedback ends with one action", /\.\s[A-Z][^.]+\.$/.test(r.feedback), r.feedback);
  const clean = S({ clausePauseCount: 3 });
  check("clean rep with pauses: feedback says keep it", /Keep this pace/.test(clean.feedback), clean.feedback);
  check("clean rep without pauses: action is to add one", /Add a short pause/.test(S({}).feedback), S({}).feedback);
  check("no user-facing em-dash", !/—/.test(r.feedback + clean.feedback));
  const shortRep = S({ durationMs: 5_000, wpm: 240 });
  check("short rep feedback does not cite a rate", /^This rep was too short to measure a steady rate, with/.test(shortRep.feedback) && !/240/.test(shortRep.feedback), shortRep.feedback);
  const shortWithPause = S({ durationMs: 5_000, wpm: 240, clausePauseCount: 1 });
  check("short rep never gets a rate/stability action", !/Slow the delivery|Pick up the pace|even from start/.test(shortWithPause.feedback), shortWithPause.feedback);
  check("no 'quartile' in user copy", !/quartile/i.test(S({ quartileWpm: [110, 110, 110, 250], quartileWpmVariance: 3675, finalQuartileDelta: 0.1 }).feedback));
  check("hedge weight unchanged (2/pt over 1, cap 15)", S({ hedgeRate: 4 }).subScores.fluency === 94 && S({ hedgeRate: 20 }).subScores.fluency === 85);
}

// ── clause-aware pause extraction from punctuated word timings ──
{
  const w = (word: string, startMs: number, endMs: number) => ({ word, startMs, endMs });
  const words = [
    w("First,", 0, 400), w("we", 1800, 2000),            // 1.4 s gap after a comma → clause pause
    w("ship", 2100, 2400), w("it.", 2500, 2800),
    w("Then", 4600, 4900),                                 // 1.8 s gap after a period → clause pause
    w("the", 5000, 5100), w("customer", 6900, 7400),       // 1.8 s gap mid-phrase
    w("pays.", 7500, 7900), w("Done.", 11500, 11900),      // 3.6 s gap → stall, not a clause pause (> 3 s)
  ];
  const sig = extractSignals({ words, transcript: words.map((x) => x.word).join(" "), durationMs: 12_000, timeBudgetMs: 60_000 });
  check("two clause-end pauses", sig.clausePauseCount === 2, String(sig.clausePauseCount));
  check("one mid-phrase pause", sig.midPhrasePauseCount === 1, String(sig.midPhrasePauseCount));
  check("one stall", sig.stallCount === 1, String(sig.stallCount));
  // Unicode clause enders count as clause ends.
  const dash = extractSignals({ words: [w("wait…", 0, 400), w("no", 1800, 2000), w("point—", 2100, 2500), w("yes", 3900, 4100)], transcript: "wait… no point— yes", durationMs: 5000, timeBudgetMs: 60000 });
  check("ellipsis and dash are clause ends", dash.clausePauseCount === 2 && dash.midPhrasePauseCount === 0, `${dash.clausePauseCount}/${dash.midPhrasePauseCount}`);
  // Trailing silence must not zero the last quartile.
  const even = Array.from({ length: 40 }, (_, i) => w(`w${i}`, i * 375, i * 375 + 200)); // 40 words over 15 s
  const late = extractSignals({ words: even, transcript: even.map((x) => x.word).join(" "), durationMs: 20_000, timeBudgetMs: 60_000 });
  check("quartiles use the speech span (trailing silence ignored)", late.quartileWpm.every((q) => q > 0) && late.quartileWpmVariance < 100, `${late.quartileWpm.join(",")} var=${late.quartileWpmVariance}`);
  check("stability is not docked for stopping the recorder late", scorePacing(late).subScores.stability >= 95, String(scorePacing(late).subScores.stability));
}
// ── weights sum to 1 ──
{
  const r = S({});
  const w = 0.35 * r.subScores.rate + 0.15 * r.subScores.stability + 0.2 * r.subScores.pauses + 0.2 * r.subScores.fluency + 0.1 * r.subScores.budget;
  check("score is the 0.35/0.15/0.2/0.2/0.1 weighting", Math.round(w) === r.score, `${w} vs ${r.score}`);
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all pacing-v2 tests pass");
else process.exitCode = 1;
