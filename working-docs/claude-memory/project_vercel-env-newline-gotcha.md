---
name: vercel-env-newline-gotcha
description: "Setting Vercel env vars via stdin is a trap three ways (trailing newline, empty value, write-only Sensitive); use `vercel env add NAME production --value X --no-sensitive --yes`, then pull + grep to verify"
metadata: 
  node_type: memory
  type: project
  originSessionId: 02b578b6-3d0c-439f-898d-9152c897f32c
---

**What happened (2026-07-07):** Setting Vercel env vars by piping (`echo "true" | vercel env add FF_X production`) stored the value WITH a trailing newline (`"true\n"`). Every strict equality check (`process.env.FF_X === "true"` in src/lib/flags.ts) evaluated false, so ALL five v3 flags were silently OFF in production after launch — prod served the legacy Skill Lab until Max spotted it from a screenshot. 19 vars were corrupted this way (including pre-existing keys, which survived only because their consumers trim: URL parsing, SDK clients).

**Why:** the flag helper `defaultOnOutsideProduction` falls through to "off in production" for any unrecognized value — corruption degrades silently, no error anywhere.

**Two more stdin traps found 2026-07-15 (CLI 56.2):**
- `printf 'true' | vercel env add` (NO trailing newline) stores an EMPTY value — the CLI's readline discards a non-newline-terminated line. Reported "✓ Added" anyway.
- stdin-piped adds are created as type "Sensitive" (write-only): `vercel env pull` returns them BLANK, so you can't even verify what landed. `vercel env ls` may still display "Encrypted", which is misleading.

**How to apply:**
- Set Vercel env values with explicit flags, never stdin: `vercel env add NAME production --value 'true' --no-sensitive --yes` (CLI ≥56 has --value/--no-sensitive).
- ALWAYS verify after setting: `vercel env pull` + grep the var — a clean value shows `FF_X="true"`, corruption shows `FF_X="true\n"`.
- Post-deploy smoke must include a FLAG-DEPENDENT surface (e.g. /skill-lab shows the applications hub), not just health/routes — routes 200 with flags off looks identical to launched.
- Secret-valued vars (API keys, DATABASE_URL) still carry the trailing newline in prod but work because consumers trim; classifier blocks mass-rewriting them. Fix only if one ever misbehaves.

Related: [[prd-v3-rebuild]]
