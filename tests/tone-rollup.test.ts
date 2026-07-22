/**
 * Grading Engine V2 — Arm C: tone-decomposition roll-up unit tests.
 *
 * The roll-up is the deterministic instrument the spike hinges on, so it
 * gets thorough coverage: ordinal→points, the prosody/text weighting, the
 * no-evidence floor, determinism, and observation coercion.
 *
 * Run: npx tsx tests/tone-rollup.test.ts
 */

import {
  rollupTone,
  ordinalToPoints,
  coerceToneObservation,
  ORDINAL_POINTS,
  type ToneObservation,
} from "@/lib/scoring/rollup";
import { SUB_SKILLS } from "@/types/sub-skills";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const TONE_SET = new Set<string>(SUB_SKILLS.tone);

// ── ordinal points sit inside their rubric bands ──
{
  check("strong is top band", ordinalToPoints("strong") >= 81);
  check("present is 61-80", ORDINAL_POINTS.present >= 61 && ORDINAL_POINTS.present <= 80);
  check("weak is 41-60", ORDINAL_POINTS.weak >= 41 && ORDINAL_POINTS.weak <= 60);
  check("absent is 21-40 (not junk-zero)", ORDINAL_POINTS.absent >= 21 && ORDINAL_POINTS.absent <= 40);
  check(
    "monotone strong>present>weak>absent",
    ORDINAL_POINTS.strong > ORDINAL_POINTS.present &&
      ORDINAL_POINTS.present > ORDINAL_POINTS.weak &&
      ORDINAL_POINTS.weak > ORDINAL_POINTS.absent,
  );
}

const obs = (
  subSkill: string,
  level: ToneObservation["level"],
): ToneObservation => ({ subSkill: subSkill as ToneObservation["subSkill"], level });

// ── text-ordinal only: average of the LLM observations ──
{
  const r = rollupTone({
    observations: [
      obs("directness", "strong"),
      obs("authority", "present"),
      obs("assertiveness", "weak"),
    ],
    hasProsody: false,
  });
  const expected = Math.round(
    (ORDINAL_POINTS.strong + ORDINAL_POINTS.present + ORDINAL_POINTS.weak) / 3,
  );
  check("text-ordinal averages observations", r.score === expected, `${r.score} vs ${expected}`);
  check("method is text-ordinal", r.method === "text-ordinal", r.method);
  check("per-sub-skill scores populated", r.subSkillScores.directness === ORDINAL_POINTS.strong);
}

// ── prosody-weighted: 0.6 voice / 0.4 text ──
{
  const r = rollupTone({
    observations: [obs("directness", "present"), obs("authority", "present"), obs("assertiveness", "present")],
    prosodyScores: { confidence: 90, warmth: 80 },
    hasProsody: true,
  });
  const prosodyAvg = 85; // (90+80)/2
  const textAvg = ORDINAL_POINTS.present; // all present
  const expected = Math.round(prosodyAvg * 0.6 + textAvg * 0.4);
  check("prosody-weighted blends 0.6/0.4", r.score === expected, `${r.score} vs ${expected}`);
  check("method is prosody-weighted", r.method === "prosody-weighted", r.method);
  check("prosody sub-skill scores merged in", r.subSkillScores.confidence === 90);
}

// ── prosody present but no text observations → prosody only ──
{
  const r = rollupTone({
    observations: [],
    prosodyScores: { confidence: 70, calmness: 60 },
    hasProsody: true,
  });
  check("prosody-only score = prosody avg", r.score === 65, `${r.score}`);
  check("prosody-only method", r.method === "prosody-weighted", r.method);
}

// ── hasProsody false ignores prosodyScores entirely ──
{
  const r = rollupTone({
    observations: [obs("directness", "strong")],
    prosodyScores: { confidence: 99 },
    hasProsody: false,
  });
  check("prosody ignored when hasProsody=false", r.score === ORDINAL_POINTS.strong, `${r.score}`);
  check("no prosody sub-skill leaked", r.subSkillScores.confidence === undefined);
}

// ── no evidence at all → conservative band center ──
{
  const r = rollupTone({ observations: [], hasProsody: false });
  check("no-evidence floor is 60", r.score === 60, `${r.score}`);
  check("no-evidence method", r.method === "no-evidence", r.method);
}

// ── determinism: identical inputs → identical outputs ──
{
  const input = {
    observations: [obs("directness", "strong"), obs("authority", "weak"), obs("assertiveness", "present")],
    prosodyScores: { confidence: 72, warmth: 64, gravitas: 58 },
    hasProsody: true,
  };
  const a = rollupTone(input);
  const b = rollupTone(input);
  check("deterministic score", a.score === b.score);
  check("deterministic method", a.method === b.method);
}

// ── coerceToneObservation ──
{
  check(
    "valid observation coerces",
    coerceToneObservation({ subSkill: "directness", level: "strong", evidence: "led with the ask" }, TONE_SET) !== null,
  );
  check(
    "uppercase level normalizes",
    coerceToneObservation({ subSkill: "authority", level: "PRESENT" }, TONE_SET)?.level === "present",
  );
  check(
    "unknown sub-skill rejected",
    coerceToneObservation({ subSkill: "not_a_tone_skill", level: "strong" }, TONE_SET) === null,
  );
  check(
    "invalid level rejected",
    coerceToneObservation({ subSkill: "directness", level: "medium" }, TONE_SET) === null,
  );
  check("non-object rejected", coerceToneObservation("nope", TONE_SET) === null);
  const long = "x".repeat(200);
  check(
    "evidence truncated to 120 chars",
    (coerceToneObservation({ subSkill: "directness", level: "weak", evidence: long }, TONE_SET)?.evidence?.length ?? 0) === 120,
  );
}

console.log("\n════════════════════════════════════════════════════════════");
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail === 0) console.log("  ✓ all tone-rollup tests pass");
else process.exitCode = 1;
