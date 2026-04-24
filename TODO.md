# Cognify Merge — Remaining TODO

**Status:** Code continues to ship on `supabase-migration` (20+ commits and counting — V2 strategic plan + Product Sweep fixes landed 2026-04-23). **Preview deploy to `cognify-v2-neon.vercel.app` is unblocked** and works on demand via `npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects` — see `docs/DEPLOYMENT.md` §0. **Production cutover to `cognifygym.com` is still Bob-gated.**

**Two deploy targets, two different states** (corrected 2026-04-23):

| Target                                | Owner              | State      | How it deploys                                              |
| ------------------------------------- | ------------------ | ---------- | ----------------------------------------------------------- |
| `cognify-v2-neon.vercel.app` (demo)   | Max / `maxvolkov202s-projects` | ✅ Working | Manual `npx vercel deploy --prod --yes`. Git-auto-deploy not yet wired (Vercel GitHub app not installed). |
| `cognifygym.com` (real production)    | Bob / upstream     | ⛔ Bob-gated | Merge PR `maxvolkov202:supabase-migration → bobsides-AICodebase:main`. |

**The critical question — when does v2 go live on `cognifygym.com`?**

The moment v2 replaces Bob's v1 on the domain is the **"Merge PR to main"** step below. Everything before that step is preparation; everything after is polish. With focused work and Bob responsive, this is realistically **half a day to a day** of real-time. Until then, `cognify-v2-neon.vercel.app` is the demo surface where all current work is visible.

---

## Critical path to launch (do in order)

### 1. Get write access or PR flow set up (BLOCKER — Bob)
- [ ] Decide with Bob: either he grants you push access on `bobsides-AICodebase/Cognify-Product-Description`, OR you open a PR from `maxvolkov202/Cognify-Product-Description:supabase-migration` → `bobsides-AICodebase:main`
- [ ] Also confirm with Bob: is he OK with this replacing his v1 on the main branch? (His v1 stays in git history + `v1.0-stable` tag, but won't be the default.)
- [ ] Tell Bob: you reset the DB password to `VokloV1223!` on 2026-04-15 — his v1 app is broken until he updates his env vars (he likely doesn't need to if he's OK with v2 taking over)

**Owner:** Max (to contact Bob) • **Blocks:** everything else • **ETA:** a text message → a few hours to a day

### 2. Get Vercel access (BLOCKER — Bob or Max)
- [ ] Confirm who owns the existing Vercel project that `cognifygym.com` points at. Likely Bob.
- [ ] Either: Bob adds Max as a member of the Vercel project, OR Bob does Steps 3–5 himself following `docs/DEPLOYMENT.md`
- [ ] Alternative: create a new Vercel project under Max's account, deploy there first, then later transfer the domain

**Owner:** Max (to coordinate) • **Blocks:** 3, 4, 5 • **ETA:** 5 min with Bob active

### 3. Configure Vercel env vars (Max — 15 min)
Open `docs/DEPLOYMENT.md` § Step 2 for the exact list. Key values to paste into Vercel → Settings → Environment Variables:

- [ ] `DATABASE_URL` (Supabase pooler URL with URL-encoded password)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`
- [ ] `RESEND_API_KEY` (existing, if configured), `EMAIL_FROM`
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (existing, if configured)
- [ ] `INTERNAL_SCORING_SECRET` (generate random 32-byte hex — one-liner in the guide)
- [ ] `NEXT_PUBLIC_USE_ASYNC_SCORING=false` (leave off for launch — flip on later)
- [ ] **Remove** legacy env vars if present: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `BLOB_READ_WRITE_TOKEN`
- [ ] Also update Vercel framework preset → Next.js (usually autodetects from package.json)

**Owner:** Max • **Blocks:** 4 • **ETA:** 15 min

### 4. Open PR and trigger preview deploy (Max — 10 min)
- [ ] Open the PR per `docs/DEPLOYMENT.md` § Step 1 (one `gh pr create` command)
- [ ] Vercel will auto-build a preview URL from the branch (like `cognify-xxx.vercel.app`)
- [ ] Verify the preview loads, landing page renders, no build errors

**Owner:** Max • **Blocks:** 5 • **ETA:** 10 min (build runs automatically)

### 5. Smoke test on preview URL (Max — 20 min)
- [ ] Sign up with email/password on the preview
- [ ] Complete one Daily Workout rep (records audio → transcribes → scores → feedback panel)
- [ ] Complete one Build a Rep scenario (framework generation → score)
- [ ] Verify `/progress`, `/friends`, `/leaderboard` load without errors
- [ ] Check audio playback in the feedback panel (signed URL from Supabase Storage)
- [ ] Sign out → sign back in → history preserved

If any of these fail: fix, push, Vercel re-deploys automatically. Don't merge until green.

**Owner:** Max (browser testing) • **Blocks:** 6 • **ETA:** 20 min

### 6. **🚀 Merge PR to main — v2 goes live on `cognifygym.com`**
- [ ] Merge the PR on GitHub (or have Bob merge)
- [ ] Vercel auto-deploys main to production (~3-5 min build)
- [ ] Domain `cognifygym.com` now serves v2 automatically (same Vercel project = domain follows)
- [ ] Do one live smoke test in incognito — sign up, do a rep, confirm it works on the real domain

**This is the launch moment.** Before this step: v2 is on preview URLs only. After this step: `cognifygym.com` is the v2 product.

**Owner:** Max (or Bob if push access not granted) • **ETA:** 10 min

---

## Post-launch polish (in priority order — do after Step 6)

### 7. Configure Google OAuth (1 hour)
Email/password works without this, but Google is a much better UX. Step-by-step in `docs/DEPLOYMENT.md` § Step 3.

- [ ] Google Cloud Console: create OAuth client ID (Web application)
- [ ] Authorized redirect URIs: `https://dunnoccrvrqzsgxsfjuv.supabase.co/auth/v1/callback` + `http://localhost:3333/auth/callback`
- [ ] Supabase Dashboard → Auth → Providers → Google → enable + paste Client ID/Secret
- [ ] Supabase Dashboard → Auth → URL Configuration → Site URL = `https://cognifygym.com`, Redirect URLs include prod + localhost
- [ ] Test Google sign-in on production

**Owner:** Max

### 8. Deploy async Edge Function (30 min) — optional optimization
Makes scoring non-blocking (user can close the tab mid-scoring). Steps in `docs/DEPLOYMENT.md` § Step 4.

- [ ] `npx supabase login` (opens browser — one-time)
- [ ] `npx supabase link --project-ref dunnoccrvrqzsgxsfjuv`
- [ ] `npx supabase secrets set INTERNAL_API_URL=... INTERNAL_SCORING_SECRET=... ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=...`
- [ ] `npx supabase functions deploy process-rep`
- [ ] Vercel → Env Vars → flip `NEXT_PUBLIC_USE_ASYNC_SCORING` to `true` (production only at first)
- [ ] Test one rep with async enabled — should show "Scoring in the background…" then flip to feedback panel

**Owner:** Max • **Can Claude help:** yes — say "walk me through the Edge Function deploy"

### 9. Monitoring + observability (1 hour)
- [ ] Add Sentry or similar error tracking
- [ ] Set up Vercel Analytics (or similar) for basic usage numbers
- [ ] Watch Supabase logs for the first few real users

**Owner:** Max

### 10. Mobile testing (30 min)
Do real iPhone + Android Safari/Chrome tests. Known risk areas: audio recording permission, feedback panel layout on small screens.

**Owner:** Max

---

## Nice-to-haves / future work (not blocking launch)

- **Archive Bob's v1 repo** — rename `Cognify-Product-Description` → `Cognify-v1-archive` once confident (Bob's action)
- **Rate limit dashboards** — currently graceful degrades, but no visibility into how often it triggers
- **Calibration regression** — the scoring rubric has a TODO for external-validation data driving calibration; implement when data accumulates
- **Phase 4 full port** — if you ever want the Edge Function to do Claude scoring directly (no callback to Next.js), port the knowledge base
- **SSO/SCIM** for enterprise plans — deferred from v2 roadmap

---

## What are "the next things we should tackle"? My instinct

**Today / next session:** Step 1 only — get Bob on a 10-min call. You can't do 2-6 until he's decided on access/PR flow.

**If Bob is responsive:** Steps 2 → 6 all fit in 2-3 hours of focused work. You'd be live on `cognifygym.com` the same day.

**If Bob is slow:** Do Step 7 (Google OAuth) locally — it's the only item you can do without him. Once he's ready, the rest is fast.

**Don't skip in the order:** Steps 1 → 6 are a chain. Skipping one breaks the next. Steps 7–10 can happen in any order after launch.

---

## 🚨 Known issues to fix right now

1. **Anthropic credits depleted** — production `/api/score` and `/api/talking-points` fall back to mock responses because the Anthropic account is out of credits. API returns 400 with "Your credit balance is too low to access the Anthropic API." Fix: add credits at https://console.anthropic.com/settings/billing. No redeploy needed (key is read at runtime). Until fixed, ALL AI features show placeholder output.
2. **Supabase email confirmation is on by default** — signups don't auto-log-in, require clicking a confirmation link in email. To disable for easier demoing: Supabase Dashboard → Authentication → Providers → Email → uncheck "Confirm email" → save.

## Product sweep findings (2026-04-16)

See **`docs/PRODUCT_SWEEP_2026-04-16.md`** for the full first-time-user feedback. Top 10:

1. **[CRITICAL]** `/try` shows scores but no transcript/callouts — defeats the product's core value prop
2. **[CRITICAL]** Pause workout code exists but has no visible button
3. **[HIGH]** No timer bar while speaking — users don't know if they're at 20s or 60s
4. **[HIGH]** Settings missing password reset / email change / data export / account delete
5. **[HIGH]** Build a Rep doesn't preview generated talking points before starting rep
6. **[MEDIUM]** Friends/Leaderboard "Preview" badge is too subtle — use full-width banner
7. **[MEDIUM]** Challenge buttons hidden on mobile (`hidden md:flex` — backwards)
8. **[MEDIUM]** Validation flow unclear — no preview of shareable link / listener view
9. **[MEDIUM]** No data export in Settings (CSV of reps / JSON of callouts)
10. **[LOW]** Onboarding doesn't frame baseline as the anchor before the baseline rep

## Reference documents

- **Plan file:** `C:\Users\MaxVolkov\.claude-personal\plans\wise-cuddling-owl.md` (original merge design — all phases done)
- **Deployment guide:** `docs/DEPLOYMENT.md` (step-by-step with exact commands/env values)
- **Domain cutover guide:** `docs/DOMAIN_CUTOVER.md` (3 paths to move cognifygym.com to v2)
- **Product sweep:** `docs/PRODUCT_SWEEP_2026-04-16.md` (user-perspective feedback, all 10 journeys)
- **Deferred work memory:** `C:\Users\MaxVolkov\.claude-personal\projects\C--Users-MaxVolkov-dev-cognify\memory\project_deferred-work.md`
- **Git branch:** `supabase-migration` on `maxvolkov202/Cognify-Product-Description`
- **Live preview:** https://cognify-v2-neon.vercel.app
