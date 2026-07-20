// Scores the Part B grading-quality reps against a target /api/score and
// dumps the full graded output for manual fidelity judgement.
//
// Usage:
//   BASE=https://cognify-v2-neon.vercel.app \
//   CALIBRATION_GUEST_ID=<uuid> \
//   node scripts/qa/score-grading-quality.mjs > out.json

import { REPS } from "./grading-quality-reps.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3333";
const GUID = process.env.CALIBRATION_GUEST_ID;
const FILTER = process.argv[2] ?? null;

function verbatimIn(quote, transcript) {
  if (quote == null) return null;
  // normalize whitespace/quotes for a tolerant verbatim check
  const norm = (s) =>
    s.toLowerCase().replace(/[‘’']/g, "'").replace(/\s+/g, " ").trim();
  return norm(transcript).includes(norm(quote));
}

async function scoreOne(rep) {
  const body = {
    transcript: rep.transcript,
    promptText: rep.promptText,
    durationMs: rep.durationMs,
  };
  const res = await fetch(`${BASE}/api/score`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(GUID ? { cookie: `cognify_guest_id=${GUID}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 300)}`);
  }
  return res.json();
}

const results = [];
for (const rep of REPS) {
  if (FILTER && !rep.id.includes(FILTER)) continue;
  const t0 = Date.now();
  try {
    const s = await scoreOne(rep);
    const dims = {};
    for (const d of s.dimensions ?? []) dims[d.dimension] = d.score;
    const cf = s.coachFocus ?? {};
    const sv = s.strongerVersion ?? null;
    const perSkill = (s.dimensions ?? []).map((d) => ({
      dim: d.dimension,
      score: d.score,
      subSkill: d.subSkill ?? null,
      feedback: (d.feedback ?? d.signals?.join(" | ") ?? "").slice(0, 400),
    }));
    // weakest dimension actually returned
    const weakestActual = Object.entries(dims).sort((a, b) => a[1] - b[1])[0]?.[0];
    results.push({
      id: rep.id,
      kind: rep.kind,
      latencyMs: Date.now() - t0,
      modelVersion: s.modelVersion,
      isMock: s.modelVersion === "mock-fallback-v1",
      composite: s.composite,
      dims,
      weakestActual,
      expected: rep.expected,
      headline: s.headline ?? null,
      headlineTone: s.headlineTone ?? null,
      nextRepHint: s.nextRepHint ?? null,
      coachFocus: {
        dimension: cf.dimension ?? null,
        subSkill: cf.subSkill ?? null,
        behavior: cf.behavior ?? null,
        why: cf.why ?? null,
        action: cf.action ?? null,
      },
      strongerVersion: sv
        ? {
            quote: sv.quote,
            quoteVerbatim: verbatimIn(sv.quote, rep.transcript),
            quoteLen: sv.quote?.length ?? 0,
            rewrite: sv.rewrite,
          }
        : null,
      perSkill,
    });
    process.stderr.write(
      `${rep.id.padEnd(28)} comp=${String(s.composite).padStart(3)} weakest=${weakestActual} ${s.modelVersion === "mock-fallback-v1" ? "!!MOCK!!" : ""}\n`,
    );
  } catch (err) {
    results.push({ id: rep.id, kind: rep.kind, error: err.message });
    process.stderr.write(`${rep.id.padEnd(28)} ERROR ${err.message}\n`);
  }
}

process.stdout.write(JSON.stringify({ base: BASE, count: results.length, results }, null, 2));
