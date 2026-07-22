---
name: reference_authed-smoke-rate-limit
description: Repeated authed Playwright smokes hit Supabase auth rate limits; reuse storageState to avoid re-signing-in
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9134c1e0-37f0-4b11-a6b6-213ad897308f
---

Running many authed Playwright runs back-to-back (each triggers `auth.setup.ts`, which signs in
the e2e + demo users through the real UI) trips **Supabase auth rate limiting**: sign-in stops
leaving `/signin`, so `expect(page).not.toHaveURL(/\/signin/)` times out (30s) and the whole
`setup` project fails → dependent specs "did not run". It looks like a code bug but is purely
the rapid-sign-in cadence. Two dev servers competing for CPU makes it worse.

**Workaround that avoids fresh sign-ins entirely:** the setup already wrote valid sessions to
`tests/e2e/authed/.auth/user.json` (and `demo.json`); Supabase access tokens last ~1h. Run the
target spec against a throwaway Playwright config whose project sets
`storageState: .auth/user.json`, replicates the fake-audio `launchOptions`
(`--use-file-for-fake-audio-capture=tests/fixtures/spoken-rep.wav` + `permissions:["microphone"]`),
and has **no `dependencies: ["setup"]`** — so it reuses the existing session and never re-signs-in.
This got the full fake-mic workout loop to pass after rate-limiting had blocked every setup.

See [[reference_authed-e2e-and-db]] for the harness, fake-mic loop, and `reset-e2e-day.mjs`.
Also: the SessionStart Vercel hook falsely claims "Vercel CLI is not installed" — it is (v56+);
`vercel deploy --prod` works (see [[reference_prod-deploy]]).
