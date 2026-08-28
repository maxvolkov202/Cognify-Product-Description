/**
 * Grading plan 1b — withTimeout race helper (middleware auth refresh budget).
 * Run: npx tsx tests/with-timeout.test.ts
 */
import { withTimeout } from "@/lib/util/with-timeout";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
{
  const r = await withTimeout(Promise.resolve("fast"), 50, () => "fb");
  check("fast promise resolves", r.kind === "resolved" && r.value === "fast");
}
{
  const slow = sleep(200).then(() => "slow");
  const t0 = Date.now();
  const r = await withTimeout(slow, 30, () => "fb");
  const dt = Date.now() - t0;
  check("stalled promise → timeout with fallback", r.kind === "timeout" && r.value === "fb");
  check("returns at the budget, not the promise", dt < 150, `${dt}ms`);
}
{
  const r = await withTimeout(Promise.reject(new Error("boom")), 50, () => "fb");
  check("rejecting promise → error with fallback", r.kind === "error" && r.value === "fb");
  check("error is surfaced", r.kind === "error" && (r.error as Error).message === "boom");
}
{
  // Fallback is lazy: only called when needed.
  let calls = 0;
  await withTimeout(Promise.resolve(1), 50, () => (calls++, 0));
  check("fallback not called on success", calls === 0);
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all with-timeout tests pass");
else process.exitCode = 1;
}
void main();
