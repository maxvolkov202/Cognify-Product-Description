---
name: Deferred migration work
description: Items left after the V1+V2 Supabase merge. Revisit before production launch. Check git log on supabase-migration branch first to confirm phase status.
type: project
originSessionId: 9b154b74-1399-441e-8545-629bc87b1277
---
As of commit `b818160a`:

**Done:** All of Phases 0, 1, 2, 3, 5. Phase 4 **infrastructure** (Edge Function, RLS, realtime hook, internal scoring route, `insertPendingRep` action) is built and committed — UI wiring + deploy remain.

**Remaining work, in rough order to tackle:**

1. **Deploy Phase 4 Edge Function + wire RepSurface to async path**
   - Prereq: Next.js app has a public URL (Vercel deploy). Edge Function can't call localhost.
   - Steps (paste to Max):
     ```
     supabase login                                      # one-time
     supabase link --project-ref dunnoccrvrqzsgxsfjuv
     supabase secrets set INTERNAL_API_URL=https://<public-url> \
       INTERNAL_SCORING_SECRET=<generate-random> \
       ANTHROPIC_API_KEY=<value> DEEPGRAM_API_KEY=<value>
     supabase functions deploy process-rep
     ```
   - Add `INTERNAL_SCORING_SECRET` to Next.js env (Vercel Settings → Env Vars)
   - Refactor RepSurface.tsx to use async path for authenticated users:
     `insertPendingRep` → `supabase.functions.invoke('process-rep', {body: {repId}})`
     → `useRepStatus(repId)` → render feedback panel when status === 'completed'
   - Guests keep sync `saveRep` (no auth.users JWT, can't use realtime)

2. **Google OAuth configuration** — DEFERRED.
   - Email/password works out of the box (Supabase default)
   - Google OAuth requires: (a) Google Cloud OAuth client ID/secret, (b) enable Google provider in Supabase Dashboard with redirect URI `https://dunnoccrvrqzsgxsfjuv.supabase.co/auth/v1/callback`
   - UI already wired up — just needs the provider config
   - The "SDR Console" Google Cloud project Max saw is a DIFFERENT product of his, unrelated to Cognify

3. **Notify Bob about DB password reset (2026-04-15)**
   - Max reset DB password to `VokloV1223!` — Bob's v1 app stays broken until he updates his env vars

4. **Production deploy to cognifygym.com** — REQUIRES MULTI-PARTY COORDINATION.
   - Domain currently points at Bob's v1 Vercel deployment
   - Need Bob to: grant push access to upstream repo OR accept PR from Max's fork
   - Vercel dashboard: update framework preset (Vite → Next.js), set env vars (DATABASE_URL, SUPABASE_*, ANTHROPIC_API_KEY, DEEPGRAM_API_KEY, RESEND_API_KEY, UPSTASH_*, INTERNAL_SCORING_SECRET)
   - Decide: same Vercel project (swap framework config) OR new project + domain cutover

5. **Manual browser E2E tests** (plan lines 393–410):
   - Fresh user: marketing → sign up → onboard → tutorial
   - Guest → email sign-up → history preserved
   - Daily Workout: 4 reps with async processing + realtime (after #1)
   - Skill Lab / Build a Rep / Compare / Validation / Ops deep testing
   - Mobile (iPhone/Android) recording
   - Scoring quality regression (5 reps, compare to baseline)

6. **Archive Bob's v1 repo** — Max to rename `Cognify-Product-Description` → `Cognify-v1-archive` once merge is live.

**How to apply:** Items 1 (deploy + wiring) and 2 (Google OAuth) can be done by Claude if Max provides CLI/dashboard access or runs `supabase login` once. Items 3, 4, 6 are Max's coordination tasks. Item 5 is manual browser testing only Max can do.
