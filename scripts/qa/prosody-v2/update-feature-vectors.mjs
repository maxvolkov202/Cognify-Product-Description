/**
 * Regenerate tests/fixtures/audio-grading/features-v2.json from a fixtures-run
 * output — the committed tone-core test vectors are real worker output, never a
 * hand-copy. Run after any worker redeploy that changes extraction:
 *
 *   node scripts/qa/prosody-v2/fixtures-run.mjs --worker-url <v2 url> --worker-token <tok> --label v2-deployed
 *   node scripts/qa/prosody-v2/update-feature-vectors.mjs out/fixtures-v2-deployed-<date>.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, HARNESS_DIR } from "./env.mjs";

const src = process.argv[2];
if (!src) throw new Error("usage: update-feature-vectors.mjs <fixtures-run output json>");
const d = JSON.parse(readFileSync(resolve(HARNESS_DIR, src), "utf8"));
const vecs = {};
for (const r of d.results) {
  const f = { ...r.features };
  delete f.segmentTails; // bulky; the tail-derived ratios are already fields
  vecs[r.file] = { style: r.style, scriptId: r.scriptId, features: f };
}
const out = resolve(ROOT, "tests/fixtures/audio-grading/features-v2.json");
writeFileSync(out, JSON.stringify({
  source: `${d.worker?.url ?? "?"} run ${d.generated_at}`,
  note: "committed worker-v2 output so tone-core unit tests need no audio or worker; regenerate with scripts/qa/prosody-v2/update-feature-vectors.mjs",
  fixtures: vecs,
}, null, 1));
console.log(`wrote ${Object.keys(vecs).length} vectors → ${out}`);
