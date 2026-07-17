#!/usr/bin/env node
/**
 * Audio tone/pacing calibration harness — the Phase 3 exit criterion:
 * "the same script delivered monotone vs expressive scores differently."
 *
 * Iterates the kind="audio-tone" reference reps (promoted spike
 * fixtures: 5 scripts × flat/expressive/rushed), serves each clip over
 * a local HTTP server so the prosody worker can fetch it, POSTs through
 * /api/score, then asserts:
 *
 *   per-clip   : tone bounds from the bank (flat ≤55, expressive ≥70)
 *   tone pair  : tone(expressive) − tone(flat) ≥ 10 per script
 *                (sign mandatory; <15 is a warning — spike measured 25–38)
 *   pacing pair: delivery(expressive) − delivery(rushed) ≥ 8 per script
 *                (ADVISORY — warns, never fails; see inline comment)
 *   provenance : every clip's tone signals must carry
 *                [toneSource: prosody] — if the text tier served the
 *                request the whole run is invalid, not "failing".
 *
 * Prerequisites (the harness checks and fails fast with instructions):
 *   1. Prosody worker running:  cd infra/prosody-worker && uvicorn main:app --port 8080
 *   2. Dev server started with: FF_PROSODY_WORKER=true PROSODY_WORKER_URL=http://127.0.0.1:8080
 *   3. CALIBRATION_GUEST_ID set (same convention as calibrate-scoring.mjs)
 *
 * Usage:
 *   CALIBRATION_GUEST_ID=<uuid> node scripts/calibrate-audio-tone.mjs
 *   node scripts/calibrate-audio-tone.mjs --json
 *
 * Exit codes: 0 pass · 1 assertion failures · 2 config/provenance error
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const BANK = resolve(__dirname, "calibration", "reference-reps.json");
const BASE_URL = process.env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const JSON_OUT = process.argv.includes("--json");

const TONE_PAIR_MIN = 10; // hard gate (phase exit criterion)
const TONE_PAIR_WARN = 15; // manifest rule — spike measured 25–38
const PACING_PAIR_MIN = 8; // advisory only — see pacing-pair comment below

const MIME = { ".wav": "audio/wav", ".mp3": "audio/mpeg", ".webm": "audio/webm" };

function loadAudioReps() {
  const bank = JSON.parse(readFileSync(BANK, "utf8"));
  const reps = (bank.reps ?? []).filter((r) => r.kind === "audio-tone");
  if (reps.length === 0) {
    console.error("No audio-tone reps in reference-reps.json — run scripts/calibration/promote-audio-reps.mjs");
    process.exit(2);
  }
  return reps;
}

/** Serve the fixture files on an ephemeral port. The prosody worker
 *  (localhost) fetches clips from here — no bucket round-trip needed
 *  for local calibration. */
function startFixtureServer(reps) {
  const byRoute = new Map(
    reps.map((r) => [`/${encodeURIComponent(r.localAudioFile.split("/").pop())}`, resolve(REPO_ROOT, r.localAudioFile)]),
  );
  const server = createServer((req, res) => {
    const path = byRoute.get(req.url ?? "");
    if (!path) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = readFileSync(path);
      res.writeHead(200, {
        "content-type": MIME[extname(path)] ?? "application/octet-stream",
        "content-length": body.length,
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolveP) => {
    server.listen(0, "127.0.0.1", () => resolveP(server));
  });
}

async function scoreOne(rep, audioUrl) {
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.CALIBRATION_GUEST_ID
        ? { cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` }
        : {}),
    },
    body: JSON.stringify({
      transcript: rep.transcript,
      promptText: rep.promptText,
      durationMs: rep.durationMs,
      audioUrl,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

function toneSourceOf(score) {
  const tone = (score.dimensions ?? []).find((d) => d.dimension === "tone");
  const tagged = (tone?.signals ?? []).find((s) => typeof s === "string" && s.includes("[toneSource:"));
  const m = typeof tagged === "string" ? tagged.match(/\[toneSource:\s*(\w+)\]/) : null;
  return m?.[1] ?? "unknown";
}

function dimScore(score, dim) {
  return (score.dimensions ?? []).find((d) => d.dimension === dim)?.score ?? null;
}

async function main() {
  const reps = loadAudioReps();
  const server = await startFixtureServer(reps);
  const port = server.address().port;

  if (!JSON_OUT) {
    console.log(`\nCognify audio-tone calibration harness`);
    console.log(`Target: ${BASE_URL} · fixtures served on 127.0.0.1:${port}`);
    console.log(`Clips: ${reps.length}\n`);
  }

  let failures = 0;
  let warnings = 0;
  const results = [];

  try {
    for (const rep of reps) {
      const file = rep.localAudioFile.split("/").pop();
      const audioUrl = `http://127.0.0.1:${port}/${encodeURIComponent(file)}`;
      const t0 = Date.now();
      let score;
      try {
        score = await scoreOne(rep, audioUrl);
      } catch (err) {
        failures++;
        results.push({ id: rep.id, error: String(err.message ?? err) });
        if (!JSON_OUT) console.log(`FAIL ${rep.id} — request failed: ${err.message}`);
        continue;
      }
      const outcome = {
        id: rep.id,
        scriptId: rep.scriptId,
        style: rep.style,
        latencyMs: Date.now() - t0,
        tone: dimScore(score, "tone"),
        delivery: dimScore(score, "delivery"),
        toneSource: toneSourceOf(score),
        modelVersion: score.modelVersion,
        clipFailures: [],
      };

      if (score.modelVersion === "mock-fallback-v1") {
        outcome.clipFailures.push("mock fallback — scoring provider unreachable");
      }
      // Provenance gate: a text-tier tone score makes the whole run
      // meaningless (that's the degrade path, not the thing under test).
      if (outcome.toneSource !== "prosody" && outcome.toneSource !== "audio") {
        console.error(
          `\n[calibrate-audio-tone] ${rep.id}: toneSource=${outcome.toneSource} — the prosody worker did not serve this request.\n` +
            `  1. cd infra/prosody-worker && uvicorn main:app --port 8080\n` +
            `  2. dev server env: FF_PROSODY_WORKER=true PROSODY_WORKER_URL=http://127.0.0.1:8080\n` +
            `  3. restart the dev server and re-run.`,
        );
        process.exit(2);
      }
      for (const a of rep.assertions ?? []) {
        const actual = dimScore(score, a.dimension);
        if (actual == null) {
          outcome.clipFailures.push(`${a.dimension} missing from response`);
        } else if (a.kind === "maxScore" && actual > a.max) {
          outcome.clipFailures.push(`${a.dimension}=${actual} > max ${a.max} (${a.rationale ?? ""})`);
        } else if (a.kind === "minScore" && actual < a.min) {
          outcome.clipFailures.push(`${a.dimension}=${actual} < min ${a.min} (${a.rationale ?? ""})`);
        }
      }
      failures += outcome.clipFailures.length;
      results.push(outcome);
      if (!JSON_OUT) {
        const ok = outcome.clipFailures.length === 0;
        console.log(
          `${ok ? "PASS" : "FAIL"} ${rep.id} (tone ${outcome.tone} · delivery ${outcome.delivery} · ${outcome.toneSource} · ${outcome.latencyMs}ms)`,
        );
        for (const f of outcome.clipFailures) console.log(`     ✗ ${f}`);
      }
    }

    // ——— Pair separations ————————————————————————————————
    const byScript = new Map();
    for (const r of results) {
      if (r.error) continue;
      if (!byScript.has(r.scriptId)) byScript.set(r.scriptId, {});
      byScript.get(r.scriptId)[r.style] = r;
    }
    const pairs = [];
    const specimenScripts = new Set(
      reps.filter((r) => r.upspeakSpecimen).map((r) => r.scriptId),
    );
    if (!JSON_OUT) console.log("\n=== Pair separations ===");
    for (const [scriptId, styles] of byScript) {
      const { flat, expressive, rushed } = styles;
      if (specimenScripts.has(scriptId)) {
        if (!JSON_OUT)
          console.log(
            `SKIP        ${scriptId}: expressive clip is an upspeak specimen (DNA rule 4) — pair gates not applicable`,
          );
        continue;
      }
      if (flat && expressive && flat.tone != null && expressive.tone != null) {
        const sep = expressive.tone - flat.tone;
        const fail = sep < TONE_PAIR_MIN;
        const warn = !fail && sep < TONE_PAIR_WARN;
        if (fail) failures++;
        if (warn) warnings++;
        pairs.push({ scriptId, kind: "tone", separation: sep, fail, warn });
        if (!JSON_OUT)
          console.log(
            `${fail ? "FAIL" : warn ? "WARN" : "PASS"} tone   ${scriptId}: expressive ${expressive.tone} − flat ${flat.tone} = ${sep >= 0 ? "+" : ""}${sep} (gate ≥${TONE_PAIR_MIN})`,
          );
      }
      // Pacing pairs are ADVISORY (warn, never fail): the TTS
      // "expressive" clips are not rate-controlled (one measures
      // 184wpm — legitimately fast, so zero separation vs its rushed
      // twin is honest grading), and production delivery is
      // deterministically overridden from word timings regardless.
      // Tone pairs above are the hard phase gate.
      if (rushed && expressive && rushed.delivery != null && expressive.delivery != null) {
        const sep = expressive.delivery - rushed.delivery;
        const warn = sep < PACING_PAIR_MIN;
        if (warn) warnings++;
        pairs.push({ scriptId, kind: "pacing", separation: sep, fail: false, warn });
        if (!JSON_OUT)
          console.log(
            `${warn ? "WARN" : "PASS"} pacing ${scriptId}: expressive ${expressive.delivery} − rushed ${rushed.delivery} = ${sep >= 0 ? "+" : ""}${sep} (advisory ≥${PACING_PAIR_MIN})`,
          );
      }
    }

    if (JSON_OUT) {
      console.log(JSON.stringify({ results, pairs, failures, warnings }, null, 2));
    } else {
      console.log(
        `\n${failures === 0 ? "ALL PASS" : `${failures} failure(s)`}${warnings ? ` · ${warnings} warning(s)` : ""}`,
      );
    }
    process.exit(failures === 0 ? 0 : 1);
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("[calibrate-audio-tone] unexpected error:", err);
  process.exit(2);
});
