/**
 * Phase A — IANA timezone validator tests.
 *
 * Run: npx tsx tests/timezones-iana.test.ts
 */

import { isValidIana } from "@/lib/timezones/iana";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) pass++;
  else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

section("valid IANA zones");
for (const tz of [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Argentina/Buenos_Aires",
  "Etc/GMT+5",
  "Etc/GMT-12",
]) {
  assert(isValidIana(tz), `accepts ${tz}`);
}

section("rejects malformed");
for (const bad of [
  "",
  " ",
  "/America/New_York",
  "America//New_York",
  "America/New York", // space
  "Mars/Olympus_Mons", // unknown zone
  "<script>",
  "America\\Los_Angeles",
  "x".repeat(100), // too long
  "; DROP TABLE users;",
  "../etc/passwd",
]) {
  assert(!isValidIana(bad), `rejects ${JSON.stringify(bad)}`);
}

section("rejects non-strings");
// @ts-expect-error — runtime guard test
assert(!isValidIana(null), "rejects null");
// @ts-expect-error — runtime guard test
assert(!isValidIana(undefined), "rejects undefined");
// @ts-expect-error — runtime guard test
assert(!isValidIana(42), "rejects number");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFAILURES:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
