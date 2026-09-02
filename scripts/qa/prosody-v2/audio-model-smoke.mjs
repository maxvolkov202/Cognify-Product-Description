/**
 * Prosody v2 Phase 1 — one-clip gpt-4o-audio-preview smoke (plan §0, for the record only).
 * The 2026-07-16 spike refuted the gpt-audio family in text-output mode but never tested
 * gpt-4o-audio-preview itself (pre-GA predecessor — refutation was by family inference).
 * This sends ONE flat + ONE expressive fixture through the exact spike-harness arm shape
 * (input_audio part, modalities:["text"], same system frame) and records whether the model
 * can discriminate them. Closes the thread either way; re-probe trigger stays §0's.
 *
 *   node scripts/qa/prosody-v2/audio-model-smoke.mjs [--model gpt-4o-audio-preview]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, ROOT, OUT_DIR } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const MODEL = args.model ?? "gpt-4o-audio-preview";
const FILES = ["band-strong-clean-pitch__flat.wav", "band-strong-clean-pitch__expressive.mp3"];
const FIXTURE_DIR = resolve(ROOT, "tests/fixtures/audio-grading");

// Same frame as scripts/spike-audio-grading.ts (distilled rubric; audio grounds tone).
const SYSTEM = `You score a spoken communication rep on six dimensions, 0-100 each. Be rigorous: 90+ is rare excellence, <40 is seriously flawed.

Dimensions:
- clarity: would a smart listener get the idea immediately? Jargon, vagueness, abstraction hurt.
- structure: clear open, ordered points, deliberate close.
- conciseness: no repetition, no filler content, scoped to the point.
- thinking_quality: claims supported, reasoning visible, honest about limits.
- delivery: pacing. Optimal 150-160 WPM; rushing (190+) or dragging hurts; pauses used deliberately. Judge from the audio/evidence when available.
- tone: vocal expressiveness matched to content. Varied intonation, emphasis, warmth, confidence. A flat monotone reading scores LOW on tone regardless of content quality. Judge from the audio/evidence when available.

If AUDIO or a PROSODY EVIDENCE block is provided, ground delivery and tone in it. If neither is provided, grade tone/delivery conservatively from text alone toward band center (55-70) - do not invent vocal qualities.

Return ONLY JSON: {"dimensions":{"clarity":N,"structure":N,"conciseness":N,"thinking_quality":N,"delivery":N,"tone":N},"toneRationale":"one sentence"}`;

const manifest = JSON.parse(readFileSync(resolve(FIXTURE_DIR, "manifest.json"), "utf8"));
const results = [];
for (const file of FILES) {
  const fx = manifest.fixtures.find((f) => f.file === file);
  const buf = readFileSync(resolve(FIXTURE_DIR, file));
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, modalities: ["text"], temperature: 0.2, max_completion_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "input_audio", input_audio: { data: buf.toString("base64"), format: file.endsWith(".wav") ? "wav" : "mp3" } },
          { type: "text", text: `PROMPT: Pitch your product to a CFO in 30 seconds.\n\nTRANSCRIPT:\n${fx.transcript}\n\nScore the rep.` },
        ] },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) { results.push({ file, error: body.error?.message ?? res.status }); console.log(`${file}: API error — ${body.error?.message ?? res.status}`); continue; }
  const raw = body.choices?.[0]?.message?.content ?? "";
  let verdict = null;
  try { verdict = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "")); } catch { /* keep raw */ }
  results.push({ file, style: fx.style, verdict, raw: verdict ? undefined : raw.slice(0, 500), usage: body.usage });
  console.log(`${file} (${fx.style}): tone=${verdict?.dimensions?.tone ?? "?"} — ${verdict?.toneRationale ?? raw.slice(0, 120)}`);
}
const flat = results.find((r) => r.style === "flat")?.verdict?.dimensions?.tone;
const expressive = results.find((r) => r.style === "expressive")?.verdict?.dimensions?.tone;
const separation = flat != null && expressive != null ? expressive - flat : null;
const summary = { generated_at: new Date().toISOString(), model: MODEL, results, tone_flat: flat ?? null, tone_expressive: expressive ?? null, separation, verdict: separation == null ? "inconclusive (see errors)" : separation >= 15 ? "DISCRIMINATES — §0 re-probe trigger fired, surface to Max" : "cannot discriminate (consistent with the family refutation)" };
writeFileSync(resolve(OUT_DIR, "audio-model-smoke.json"), JSON.stringify(summary, null, 2));
console.log(`\nseparation: ${separation} → ${summary.verdict}`);
