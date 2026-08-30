/**
 * Grading Engine V2 — unit tests for the variant scoring arms + the
 * flag-gated arm selector. Pure helpers only — no LLM, no DB.
 */

import { selectScoringArm } from "@/lib/ai/score";
import {
  applyHybridLayer,
  LEAN_SYSTEM_PROMPT,
  leanSystemPromptFor,
  scoringResponseSchema,
} from "@/lib/ai/score-shared";
import { __armBForTests } from "@/lib/ai/score-arm-b";
import type { ScoreRepInput } from "@/lib/ai/score";
import type { SkillDimension } from "@/types/domain";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const DIMS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

async function run() {
  // ── selectScoringArm: flag gating ──
  {
    const saved = { ...process.env };
    delete process.env.FF_SCORING_VARIANT;
    check("flag unset → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT = "true";
    process.env.FF_SCORING_VARIANT_PERCENT = "0";
    process.env.FF_SCORING_VARIANT_ARM = "signals-drop";
    check("percent 0 → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT_PERCENT = "100";
    check("percent 100 + signals-drop arm → signals-drop", selectScoringArm("user-1") === "signals-drop");

    process.env.FF_SCORING_VARIANT_PERCENT = "100";
    check("anonymous at 100 → signals-drop", selectScoringArm(undefined) === "signals-drop");

    // Retired arms (median-of-n, reference-anchored, grouped-fanout,
    // tone-decomposed, all-llm) are no longer implemented → control.
    process.env.FF_SCORING_VARIANT_ARM = "median-of-n";
    check("retired arm name → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT_ARM = "lean-output";
    check("lean-output arm → lean-output", selectScoringArm("user-1") === "lean-output");

    process.env.FF_SCORING_VARIANT_ARM = "lean-split";
    check("lean-split arm → lean-split", selectScoringArm("user-1") === "lean-split");

    process.env.FF_SCORING_VARIANT_ARM = "per-skill-fanout";
    check("per-skill-fanout arm → per-skill-fanout", selectScoringArm("user-1") === "per-skill-fanout");

    process.env.FF_SCORING_VARIANT_ARM = "holistic-split";
    check("holistic-split arm → holistic-split", selectScoringArm("user-1") === "holistic-split");

    process.env.FF_SCORING_VARIANT_ARM = "not-a-real-arm";
    check("unrecognized arm → control", selectScoringArm("user-1") === "control");

    process.env.FF_SCORING_VARIANT_ARM = "signals-drop";
    process.env.FF_SCORING_VARIANT_PERCENT = "0";
    check("percent 0 anon → control", selectScoringArm(undefined) === "control");

    // restore
    for (const k of ["FF_SCORING_VARIANT", "FF_SCORING_VARIANT_PERCENT", "FF_SCORING_VARIANT_ARM"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }

  // ── selectScoringArm: stable bucketing (monotonic ramp) ──
  {
    process.env.FF_SCORING_VARIANT = "true";
    process.env.FF_SCORING_VARIANT_ARM = "signals-drop";
    // A user in-bucket at 30% must stay in-bucket at 60% (ramp only adds).
    const inAt = (pct: number, uid: string) => {
      process.env.FF_SCORING_VARIANT_PERCENT = String(pct);
      return selectScoringArm(uid) === "signals-drop";
    };
    let monotonic = true;
    for (let i = 0; i < 50; i++) {
      const uid = `ramp-user-${i}`;
      if (inAt(30, uid) && !inAt(60, uid)) monotonic = false;
    }
    check("bucketing is monotonic across ramp", monotonic);
    delete process.env.FF_SCORING_VARIANT;
    delete process.env.FF_SCORING_VARIANT_PERCENT;
    delete process.env.FF_SCORING_VARIANT_ARM;
  }

  // ── hybrid-layer config: llm mode bypasses BOTH deterministic layers ──
  // The deliveryMode/thinkingMode config options (kept for calibration and
  // FF_ARM_B_DELIVERY_MODE even though the all-llm arm is retired): with
  // word timings present, the control config overrides delivery (pacing math)
  // and blends thinking_quality, while the llm config lets the model's raw
  // numbers pass straight through.
  {
    const RAW_DELIVERY = 82;
    const RAW_THINKING = 88;
    const dims = DIMS.map((d) => ({
      dimension: d,
      score: d === "delivery" ? RAW_DELIVERY : d === "thinking_quality" ? RAW_THINKING : 70,
      signals: [],
      feedback: `f ${d}`,
      subSkill: null,
    }));
    // ~30 words over 60s ≈ 30 wpm — far slower than any "well-paced" band, so
    // the deterministic pacing override lands well below the raw 82.
    const words = Array.from({ length: 30 }, (_, i) => ({
      word: `w${i}`,
      startMs: i * 2000,
      endMs: i * 2000 + 400,
    }));
    const hybridInput = {
      transcript: Array.from({ length: 30 }, (_, i) => `w${i}`).join(" "),
      durationMs: 60000,
      words,
      promptText: "p",
    } as unknown as ScoreRepInput;

    const control = applyHybridLayer({
      dims: dims as never,
      input: hybridInput,
      config: { deliveryMode: "deterministic", thinkingMode: "blend" },
    });
    const allLlm = applyHybridLayer({
      dims: dims as never,
      input: hybridInput,
      config: { deliveryMode: "llm", thinkingMode: "llm" },
    });
    const dGet = (r: { finalDimensions: { dimension: string; score: number }[] }, dim: string) =>
      r.finalDimensions.find((x) => x.dimension === dim)!.score;

    check("control config overrides delivery (≠ raw)", dGet(control, "delivery") !== RAW_DELIVERY, `got ${dGet(control, "delivery")}`);
    check("control config blends thinking (≠ raw)", dGet(control, "thinking_quality") !== RAW_THINKING, `got ${dGet(control, "thinking_quality")}`);
    check("llm config preserves raw delivery", dGet(allLlm, "delivery") === RAW_DELIVERY, `got ${dGet(allLlm, "delivery")}`);
    check("llm config preserves raw thinking", dGet(allLlm, "thinking_quality") === RAW_THINKING, `got ${dGet(allLlm, "thinking_quality")}`);
  }

  // ── lean-output arm: the lean prompt cuts the accuracy-neutral output ──
  // The arm's whole thesis is a leaner OUTPUT contract (drop the never-rendered
  // `signals` narratives + halve the per-dim feedback cap) with byte-identical
  // SCORING rules, so the numbers are produced by the same reasoning. Assert the
  // transforms landed and that no other cut leaked in.
  {
    // Signals field is gone from the output schema block...
    check(
      "lean prompt drops the signals output field",
      !LEAN_SYSTEM_PROMPT.includes(`"signals": ["..."]`),
    );
    // ...feedback cap is halved (400→160)...
    check(
      "lean prompt tightens feedback cap to ≤160 chars",
      LEAN_SYSTEM_PROMPT.includes("no hedging, ≤160 chars.") &&
        !LEAN_SYSTEM_PROMPT.includes("no hedging, ≤400 chars."),
    );
    check(
      "lean prompt asks for 1 sentence per dim (not 1-2)",
      LEAN_SYSTEM_PROMPT.includes("1 tight sentence per dimension") &&
        !LEAN_SYSTEM_PROMPT.includes("1-2 tight sentences per dimension"),
    );
    // ...but the load-bearing outputs the user actually reads are untouched.
    check(
      "lean prompt keeps the coachFocus contract",
      LEAN_SYSTEM_PROMPT.includes("COACH'S FOCUS RULES"),
    );
    check(
      "lean prompt keeps the strongerVersion contract",
      LEAN_SYSTEM_PROMPT.includes("STRONGER VERSION RULES"),
    );
  }

  // ── milder-trim sweep: parameterized lean feedback cap ──
  // The PIVOT (2026-07-21) needs caps between control's 400 and the shipped
  // 160. Assert each cap's prompt is shaped correctly: signals ALWAYS dropped;
  // cap===400 = signals-only (prose byte-identical to control); mild caps keep
  // "1-2 sentences" but tighten the ceiling; tight caps (≤200) collapse to one
  // sentence. LEAN_SYSTEM_PROMPT must stay === the 160 build (no drift).
  {
    const p400 = leanSystemPromptFor(400);
    const p280 = leanSystemPromptFor(280);
    const p160 = leanSystemPromptFor(160);

    check("all caps drop the signals field", [p400, p280, p160].every((p) => !p.includes(`"signals": ["..."]`)));

    // 400 = signals-only: feedback prose untouched (still ≤400, still 1-2).
    check("cap 400 keeps ≤400 char rule", p400.includes("no hedging, ≤400 chars."));
    check("cap 400 keeps 1-2 sentences", p400.includes("1-2 tight sentences per dimension"));

    // 280 = mild: tighter ceiling, but two-sentence framing kept.
    check(
      "cap 280 sets ≤280 and drops ≤400",
      p280.includes("no hedging, ≤280 chars.") && !p280.includes("no hedging, ≤400 chars."),
    );
    check("cap 280 keeps 1-2 sentences", p280.includes("1-2 tight sentences per dimension"));

    // 160 = tight: one sentence + ≤160, and identical to the shipped const.
    check(
      "cap 160 collapses to one sentence",
      p160.includes("1 tight sentence per dimension") && p160.includes("no hedging, ≤160 chars."),
    );
    check("LEAN_SYSTEM_PROMPT === leanSystemPromptFor(160)", LEAN_SYSTEM_PROMPT === p160);

    // Every cap keeps the load-bearing user-visible contracts.
    check(
      "all caps keep coachFocus + strongerVersion contracts",
      [p400, p280, p160].every((p) => p.includes("COACH'S FOCUS RULES") && p.includes("STRONGER VERSION RULES")),
    );
  }

  // ── per-skill-fanout: single-dim scope shaping ──
  // Each pass must scope to exactly ONE dimension and steer voice vs content
  // reasoning correctly; the anti-compression guard rides on content dims so a
  // short single-dim feedback can't manufacture nitpicks that drag the score.
  {
    const clarity = __armBForTests.renderPerSkillScope("clarity", false);
    const tone = __armBForTests.renderPerSkillScope("tone", false);
    check("clarity scope names only clarity", clarity.includes("SINGLE DIMENSION PASS: clarity") && clarity.includes("IGNORE delivery and tone"));
    check("clarity scope carries the anti-compression guard", clarity.includes("NEVER pull the score down"));
    check("tone scope grounds in voice/prosody", tone.includes("PROSODY EVIDENCE") && tone.includes("reason ONLY about voice"));
    check("scopes forbid a coachFocus in the per-dim pass", clarity.includes("do NOT include a headline, coachFocus"));
  }

  // ── schema tolerates a dimension with no `signals` (lean output) ──
  // The lean prompt never emits `signals`, so the parse must default it to []
  // rather than mock-fallback. Control still emits it, so this is byte-neutral
  // for control (the value is present → default never fires).
  {
    const noSignalsDims = DIMS.map((d) => ({
      dimension: d,
      score: 70,
      // NOTE: no `signals` key — exactly what the lean prompt produces.
      feedback: `f ${d}`,
      subSkill: null,
    }));
    const parsed = scoringResponseSchema.safeParse({
      dimensions: noSignalsDims,
      headline: "h",
      coachFocus: { dimension: "clarity", behavior: "b", why: "w", action: "a" },
      strongerVersion: null,
      headlineTone: "directive",
      nextRepHint: "hint",
    });
    check("schema parses dimensions with no signals", parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues[0]));
    check(
      "missing signals defaults to []",
      parsed.success && parsed.data.dimensions.every((d) => Array.isArray(d.signals) && d.signals.length === 0),
    );
  }

  console.log("\n════════════════════════════════════════════════════════════");
  console.log(`  pass: ${pass}   fail: ${fail}`);
  if (fail === 0) console.log("  ✓ all scoring-arms tests pass");
  else process.exitCode = 1;
}

run();
