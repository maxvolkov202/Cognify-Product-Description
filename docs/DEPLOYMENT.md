# Cognify v2 — Deployment Guide

> **Two deploy targets, two different flows** (corrected 2026-04-23):
> - **Preview / iteration** → `cognify-v2-neon.vercel.app` (Max-owned, under `maxvolkov202s-projects` team). Fully unblocked; deploy any time with a single CLI command.
> - **Production** → `cognifygym.com` (Bob-owned upstream Vercel project). Gated on Bob's PR merge.
>
> This guide covers both. Start with §0 for the fast-path if you just want to get today's commits visible on `cognify-v2-neon.vercel.app`.

---

## 0. Current preview deploy (fast path)

The Vercel project `cognify-v2` at team `maxvolkov202s-projects` (ID `prj_SwZBC9rMztIlOxSdJPwVpHvr5seE`) is already linked via `.vercel/project.json`. It serves **`https://cognify-v2-neon.vercel.app`** (production alias inside Max's hobby tier — this is the demo/preview URL, NOT the real `cognifygym.com` production).

**As of 2026-04-23:** git integration is **not connected** on this project (`link: null` per Vercel API). That means pushes to `origin/supabase-migration` do not auto-trigger builds. Deploy manually after each push:

```bash
# From C:\Users\MaxVolkov\dev\cognify — deploys current working dir
npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects

# Output ends with:
#   Production: https://cognify-v2-<hash>-maxvolkov202s-projects.vercel.app
#   Aliased:    https://cognify-v2-neon.vercel.app
```

Build takes ~45–60s. The `--prod` flag promotes the deployment to the `cognify-v2-neon.vercel.app` alias. Because this project is on Max's hobby tier, `--prod` here is a misnomer — it just means "update the alias"; it does NOT touch `cognifygym.com`.

To wire up auto-deploy-on-push later (optional), install the Vercel GitHub app on `maxvolkov202`'s account, then:

```bash
npx vercel@latest git connect https://github.com/maxvolkov202/Cognify-Product-Description.git \
  --scope maxvolkov202s-projects --yes
```

If the Vercel GitHub app isn't authorized on Max's GitHub, `git connect` will 4xx. Install it at https://github.com/apps/vercel first.

---

## 1. Production cutover to cognifygym.com

This section assumes the `supabase-migration` branch is code-complete (all 9+ checkpoint commits pushed).

## Prerequisites

- [ ] Access to the Supabase project `dunnoccrvrqzsgxsfjuv`
- [ ] Access to the Vercel project currently deployed at `cognifygym.com`
- [ ] Push access to `bobsides-AICodebase/Cognify-Product-Description` (or you'll open a PR from your fork)
- [ ] Bob has updated his v1 app's env vars with the new DB password (otherwise his deploy is broken)

## Step 1 — Merge the branch

Option A (you have push access): merge `supabase-migration` → `main` on Bob's upstream repo.

Option B (no push access): open a PR from `maxvolkov202/Cognify-Product-Description:supabase-migration` → `bobsides-AICodebase/Cognify-Product-Description:main`. Have Bob merge.

```bash
gh pr create \
  --repo bobsides-AICodebase/Cognify-Product-Description \
  --base main --head maxvolkov202:supabase-migration \
  --title "Cognify v2 merge — Supabase migration" \
  --body "$(cat <<'EOF'
Migrates Cognify v2 onto Supabase (DB + Auth + Storage + Edge Functions).
Bob's v1 tables in public schema stay untouched; v2 lives in cognify_v2.

## Phases shipped
- 0: Repo + infra
- 1: Neon → Supabase Postgres (postgres-js driver, cognify_v2 schema)
- 2: NextAuth → Supabase Auth (Google + email/password + guest promotion)
- 3: Vercel Blob → Supabase Storage (signed URLs)
- 4: Async Edge Function process-rep + realtime subscriptions + RLS
- 5: Mic pre-warming + framework scoring weight profiles

## Deployment steps
See docs/DEPLOYMENT.md in this branch.
EOF
)"
```

## Step 2 — Configure Vercel

The existing Vercel project was built for Bob's Vite SPA. The new branch is Next.js 15. Vercel auto-detects from `package.json`, but confirm:

1. Vercel Dashboard → Project → Settings → General:
   - **Framework Preset:** `Next.js` (Vercel should autodetect)
   - **Build Command:** leave default (`next build`)
   - **Install Command:** leave default
   - **Output Directory:** leave default

2. Vercel Dashboard → Settings → Environment Variables — add these to **Production** + **Preview**:

   ```
   DATABASE_URL=postgresql://postgres.dunnoccrvrqzsgxsfjuv:VokloV1223%21@aws-1-us-east-2.pooler.supabase.com:6543/postgres
   NEXT_PUBLIC_SUPABASE_URL=https://dunnoccrvrqzsgxsfjuv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_qHGxQ-rfkyBeWgqQTVofkg_xtrvcMbz
   SUPABASE_SERVICE_ROLE_KEY=<paste sb_secret_... value from Supabase Dashboard → API>
   ANTHROPIC_API_KEY=<paste value from .env.local>
   DEEPGRAM_API_KEY=<paste value from .env.local>
   RESEND_API_KEY=<existing value, if configured>
   EMAIL_FROM=Cognify <hello@your-domain.com>
   UPSTASH_REDIS_REST_URL=<existing, optional>
   UPSTASH_REDIS_REST_TOKEN=<existing, optional>
   INTERNAL_SCORING_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   NEXT_PUBLIC_USE_ASYNC_SCORING=false   # flip to "true" after Step 4 smoke tests pass
   ```

3. Remove these legacy env vars if present:
   - `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (NextAuth — removed)
   - `BLOB_READ_WRITE_TOKEN` (Vercel Blob — removed)

4. Trigger a deploy:
   - Push to main → Vercel auto-deploys, OR
   - Vercel Dashboard → Deployments → Redeploy latest

5. Verify: visit the deployed URL (Vercel gives you `cognify-xxx.vercel.app` preview). Landing + `/signin` should load. Sign up with email/password should work.

## Step 3 — Configure Google OAuth (optional but recommended)

Email/password works without this; Google OAuth is nice-to-have.

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
   - Create a project for Cognify (or use an existing one — **NOT** the "SDR Console" project, that's unrelated)
   - APIs & Services → OAuth consent screen → configure (External user type, app name "Cognify", support email, logo optional, authorized domains: `cognifygym.com`)
   - APIs & Services → Credentials → Create Credentials → **OAuth client ID** (NOT API key)
   - Application type: Web application
   - Authorized redirect URIs:
     - `https://dunnoccrvrqzsgxsfjuv.supabase.co/auth/v1/callback`
     - `http://localhost:3333/auth/callback` (for local dev)
   - Copy the Client ID and Client Secret

2. **Supabase Dashboard** → Authentication → Providers → Google:
   - Enable
   - Paste Client ID + Client Secret
   - Save

3. **Supabase Dashboard** → Authentication → URL Configuration:
   - Site URL: `https://cognifygym.com`
   - Redirect URLs (add both): `https://cognifygym.com/auth/callback`, `http://localhost:3333/auth/callback`

4. Test: visit `/signin` → "Continue with Google" → complete OAuth → should land on `/dashboard`.

## Step 4 — Deploy the Edge Function (enables async scoring)

This is optional until you want the async path enabled. With it off (`NEXT_PUBLIC_USE_ASYNC_SCORING=false`), scoring runs synchronously in `/api/score` as it has throughout the migration — fully functional.

### Deploy

```bash
# One-time: install Supabase CLI (already in devDependencies)
# Log in (opens browser)
npx supabase login

# Link the project to your local checkout
npx supabase link --project-ref dunnoccrvrqzsgxsfjuv

# Set secrets that the Edge Function reads at runtime
npx supabase secrets set \
  INTERNAL_API_URL="https://cognifygym.com" \
  INTERNAL_SCORING_SECRET="<same value as set in Vercel>" \
  ANTHROPIC_API_KEY="<paste from .env.local>" \
  DEEPGRAM_API_KEY="<paste from .env.local>"

# Deploy
npx supabase functions deploy process-rep
```

### Enable async path

After deploy + smoke test:

1. Vercel Dashboard → Settings → Env Vars → change `NEXT_PUBLIC_USE_ASYNC_SCORING` from `false` → `true` (Production only at first, leave Preview as `false` for safer testing).
2. Redeploy.
3. Test: sign in as authenticated user → complete a rep → UI should show "Scoring in the background…" then flip to the feedback panel when the Edge Function finishes. Check `cognify_v2.reps` in Supabase → the row should transition pending → processing → completed.

### Verify Edge Function logs

Supabase Dashboard → Edge Functions → `process-rep` → Logs. Look for 200 responses and any 500s.

## Step 5 — Cutover the domain

If Bob's Vercel project = your Vercel project (same repo → same project), nothing to do. The domain is already pointed at it; the new deploy is live.

If you created a new Vercel project, transfer the domain:
1. Old project → Settings → Domains → remove `cognifygym.com`
2. New project → Settings → Domains → add `cognifygym.com`
3. Wait for DNS propagation (usually seconds, up to 15 min)

## Step 6 — Archive Bob's v1 repo

Once you're confident in production:
- Bob renames `bobsides-AICodebase/Cognify-Product-Description` → `bobsides-AICodebase/Cognify-v1-archive`
- Or leaves `main` as v2 and tags `v1-stable` permanently on the pre-merge commit (already tagged as `v1.0-stable`)

## Manual E2E checklist (post-deploy)

Walk through in a browser, production-signed-in:

- [ ] Landing page loads, CTAs work
- [ ] Sign up with email/password → onboarding → tutorial → dashboard
- [ ] Complete one Daily Workout rep → audio plays back → feedback displays
- [ ] Complete one Build a Rep scenario → framework generation works → score displays
- [ ] `/progress` trend charts render
- [ ] `/friends` loads (may show mock data if no friendships yet)
- [ ] `/leaderboard` loads
- [ ] Ops dashboard at `/ops` loads (for operators — set `users.is_operator=true` via SQL)
- [ ] Sign out → landing page → sign in as guest → complete rep → sign up → history preserved
- [ ] Mobile (iPhone/Android Safari): audio record works, feedback panel usable
- [ ] Rate limiting returns 429 with friendly message when exceeded
- [ ] Scoring quality: run 5 reps with varied quality, confirm scores vary reasonably

## Rollback

If something breaks in prod:

1. Vercel Dashboard → Deployments → find the last known good → "Promote to Production"
2. If DB schema changed badly: restore from a Supabase backup (Settings → Database → Backups)
3. The frozen v2 backup at `cognify-v2-backup-pre-merge` has pre-migration code if you need to start over

## Known deferred items

See `~/.claude-personal/projects/C--Users-MaxVolkov-dev-cognify/memory/project_deferred-work.md` for the full list. Most critically:

- Google OAuth setup (Step 3) — email/password works without it
- Async Edge Function enablement (Step 4) — sync path works without it
- Bob's v1 DB credentials still point at the old password; notify him when this ships

## Quick reference

| Resource | URL / Identifier |
|---|---|
| Supabase project | `dunnoccrvrqzsgxsfjuv` |
| Supabase URL | `https://dunnoccrvrqzsgxsfjuv.supabase.co` |
| Pooler connection | `aws-1-us-east-2.pooler.supabase.com:6543` |
| v2 tables | `cognify_v2` schema (17 tables) |
| Bob's v1 tables | `public` schema (`reps`, `delivery_scores`) — untouched |
| Domain | `cognifygym.com` |
| Branch | `supabase-migration` on `maxvolkov202/Cognify-Product-Description` |
| Plan file | `C:\Users\MaxVolkov\.claude-personal\plans\wise-cuddling-owl.md` |
