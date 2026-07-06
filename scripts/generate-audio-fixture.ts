/**
 * Phase 11.B2 — generate the spoken-audio fixture for the authed E2E
 * harness (Chromium --use-file-for-fake-audio-capture needs a WAV).
 *
 * The text is a deliberately decent ~45s spoken answer (concrete, one
 * analogy, clean close) so live scoring lands mid-band — good enough to
 * assert contracts, imperfect enough to generate a real Coach's Focus.
 *
 *   npx tsx scripts/generate-audio-fixture.ts
 *
 * Output: tests/fixtures/spoken-rep.wav (checked in; regenerate only if
 * the harness needs different speech).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TEXT =
  "A firewall is basically a security guard for your computer network. " +
  "Imagine your office building with one main entrance, and a guard who checks " +
  "everyone coming in against a guest list. That is exactly what a firewall does " +
  "with information. Every piece of data that tries to enter your network gets " +
  "checked against a set of rules. If it looks safe, it comes through. If it looks " +
  "suspicious, it gets turned away at the door. You already rely on one every day, " +
  "because your home router has a firewall built in. So the next time your bank asks " +
  "why their network is safe, you can say: there is a guard at the door, checking " +
  "every single visitor, all day long. That is a firewall.";

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("[audio-fixture] OPENAI_API_KEY not set");
    process.exit(1);
  }
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: TEXT,
      response_format: "wav",
      speed: 1.0,
    }),
  });
  if (!res.ok) {
    console.error("[audio-fixture] TTS failed:", res.status, await res.text());
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const out = resolve("tests/fixtures/spoken-rep.wav");
  mkdirSync(resolve("tests/fixtures"), { recursive: true });
  writeFileSync(out, buf);
  console.log(`[audio-fixture] wrote ${out} (${Math.round(buf.length / 1024)} KB)`);
}

void main();
