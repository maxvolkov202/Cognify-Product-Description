# Deploy — local → production

This is the "how do I make my local changes resonate on the production site" guide. Follow it top to bottom once, then it becomes `git push`.

Target stack: **Vercel** (Next.js 15 host) + **Neon Postgres** (database) + **Vercel Blob** (audio storage) + **Upstash Redis** (rate limit) + **Anthropic + Deepgram + Resend** (APIs).

---

## 0. One-time: confirm the repo is connected to GitHub + Vercel

If not yet wired:

```bash
# From repo root
git init
git add .
git commit -m "Initial commit"
gh repo create cognify --private --source=. --push
# Or create the repo in the GitHub UI and:
# git remote add origin git@github.com:<you>/cognify.git
# git push -u origin main
```

Then at [vercel.com/new](https://vercel.com/new):

1. Import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory: leave as `./`.
4. Build command: default (`next build`).
5. Output directory: default.
6. Skip env vars for now — we'll add them in step 2.
7. Click **Deploy**.

The first deploy will likely fail (no env vars). That's expected.

## 1. Provision the data + services

| Service     | What for                              | Signup                                                                  |
| ----------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Neon        | Postgres (users, reps, scores, etc.)  | [neon.tech](https://neon.tech) → new project → copy `DATABASE_URL`      |
| Vercel Blob | Audio file storage                    | Vercel dashboard → Storage → Blob → "Create" → copy `BLOB_READ_WRITE_TOKEN` |
| Upstash     | Rate-limit + streak counters (Redis)  | [upstash.com](https://upstash.com) → new Redis DB → copy REST URL + token |
| Anthropic   | Claude Sonnet (scoring) + Opus (frameworks) | [console.anthropic.com](https://console.anthropic.com) → API keys      |
| Deepgram    | Speech-to-text on rep audio           | [console.deepgram.com](https://console.deepgram.com) → API keys         |
| Resend      | Welcome emails + /help contact form   | [resend.com](https://resend.com) → API keys                             |

All of these have free / low-volume tiers that cover the beta.

## 2. Set env vars in Vercel

Vercel dashboard → your project → **Settings** → **Environment Variables**.

Add each of these with the value from step 1. Set all of them for **Production**, **Preview**, and **Development** unless noted.

| Name                        | Required | Notes                                                                    |
| --------------------------- | -------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`              | yes      | From Neon. Production gets the main branch DB; Preview can reuse it or point at a branch DB. |
| `AUTH_SECRET`               | yes      | `openssl rand -base64 32` — same value across environments.              |
| `AUTH_URL`                  | yes      | `https://your-domain.com` in prod. Vercel injects `VERCEL_URL` if unset but be explicit. |
| `AUTH_GOOGLE_ID`            | yes      | From Google Cloud → Credentials. Add `https://your-domain.com/api/auth/callback/google` as an authorized redirect URI. |
| `AUTH_GOOGLE_SECRET`        | yes      | Same Google OAuth client.                                                |
| `AUTH_RESEND_KEY`           | optional | For magic-link email sign-in (Auth.js uses this separately from `RESEND_API_KEY`). |
| `RESEND_API_KEY`            | yes      | Used by welcome email + `/api/support` contact form.                     |
| `EMAIL_FROM`                | optional | Default `Cognify <onboarding@resend.dev>`. Use a verified sending domain in prod. |
| `SUPPORT_INBOX`             | optional | Where `/api/support` messages land. Default `support@cognifygym.com`.    |
| `ANTHROPIC_API_KEY`         | yes      | **Production-only required.** Without it scoring + progression degrade. |
| `ANTHROPIC_SCORING_MODEL`   | optional | Defaults to `claude-sonnet-4-6`.                                         |
| `ANTHROPIC_FRAMEWORK_MODEL` | optional | Defaults to `claude-opus-4-6`.                                           |
| `DEEPGRAM_API_KEY`          | yes      | Speech-to-text on every rep.                                             |
| `BLOB_READ_WRITE_TOKEN`     | yes      | Vercel Blob token. Audio uploads fail without this.                      |
| `UPSTASH_REDIS_REST_URL`    | yes      | Rate limit + streak counters.                                            |
| `UPSTASH_REDIS_REST_TOKEN`  | yes      |                                                                          |
| `NEXT_PUBLIC_APP_URL`       | yes      | `https://your-domain.com` in prod.                                       |
| `NEXT_PUBLIC_MARKETING_MODE`| optional | `dual \| enterprise \| consumer`. Default `dual`.                        |

After saving, click **Redeploy** on the most recent deploy (three-dot menu → Redeploy → pick the "use existing build cache: no" option the first time).

## 3. Push the database schema

Only once per environment (run again when `schema.ts` changes):

```bash
# From local, pointed at the PROD Neon URL:
DATABASE_URL="postgres://...prod..." npm run db:push
```

That creates all the tables — `users`, `reps`, `practice_sessions`, `scenarios`, `teams`, etc.

To seed yourself as an operator (so `/ops` is reachable):

```bash
DATABASE_URL="postgres://...prod..." npx tsx -e "
  import('./src/lib/db/client.js').then(async ({ db }) => {
    const { users } = await import('./src/lib/db/schema.js');
    const { eq } = await import('drizzle-orm');
    await db.update(users).set({ isOperator: true }).where(eq(users.email, 'maxvolkov202@gmail.com'));
    console.log('ops seat granted');
    process.exit(0);
  });
"
```

## 4. The everyday loop

After step 0–3 are done:

```bash
# 1. Work on a branch
git checkout -b feature/thing

# 2. Commit + push
git commit -am "add thing"
git push

# 3. Open a PR — Vercel auto-creates a preview deploy on every push.
# Click the Vercel bot comment on the PR to hit the preview URL.

# 4. Merge to main when happy → Vercel auto-deploys to production.
```

Every push to `main` → production. Every push to any other branch → a unique preview URL. No manual step in between. That is what "local changes resonate on production" means on this stack.

## 5. Verifying a prod deploy is healthy

After a release, hit these:

1. `https://your-domain.com/` — marketing hero renders
2. `https://your-domain.com/help` — help center renders, contact form loads
3. Sign in via Google — first-time user sees `/onboarding` → `/tutorial` → `/workout`
4. Run one rep — feedback renders with quotes, suggested rewrites, "Why this matters" popover works
5. Check `/dashboard` — calendar strip + this-week card populated after at least one rep
6. `/ops` loads if you're flagged as an operator; 403 otherwise

If any of those fail, check the Vercel runtime logs (Project → Deployments → the deploy → Runtime Logs). 90% of issues are missing env vars.

## 6. Rolling back

Vercel dashboard → Deployments → find the last known-good deploy → three-dot menu → **Promote to production**. That promotes without a rebuild. Takes under a minute.

For DB-affecting rollbacks: Neon keeps point-in-time branches. Create a branch at the last-good timestamp, copy the URL into `DATABASE_URL`, redeploy. This is a nuclear option — prefer forward-fixing.

## 7. Domain setup

Vercel dashboard → Project → **Domains** → add `cognifygym.com` (or whatever). Vercel shows the DNS records to add at your registrar. After DNS propagates (typically a few minutes, up to an hour):

1. Update `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://cognifygym.com`.
2. Update the Google OAuth redirect URI to `https://cognifygym.com/api/auth/callback/google`.
3. Redeploy.

## 8. Cost sanity check

Typical monthly cost during the beta (single-digit users):
- Vercel: **$0** (Hobby tier)
- Neon: **$0** (free tier, 0.5 GB)
- Vercel Blob: **~$0** (free tier, 1 GB)
- Upstash: **$0** (free tier, 10k req/day)
- Resend: **$0** (3k emails/mo free)
- Anthropic: **~$2–10** (Sonnet is cheap; Opus for frameworks adds a little)
- Deepgram: **~$1–5** (pay-per-minute)

Budget **$15–30/mo** for early usage. Scales roughly linearly with active reps.
