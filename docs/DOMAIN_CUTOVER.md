# Domain Cutover — `cognifygym.com` to v2

This is the plan for moving `cognifygym.com` from Bob's v1 Vercel deployment to the v2 deployment, with rollback at every step.

## Current state of the "interesting" setup

```
cognifygym.com
   └─ DNS A/CNAME record → Bob's Vercel project (cognify-product-description or similar)
          └─ connected to: bobsides-AICodebase/Cognify-Product-Description (main branch)
          └─ currently builds: Bob's v1 Vite SPA
          └─ env vars: Bob's Supabase keys, old DB password (broken since 2026-04-15 reset)

Max's fork: maxvolkov202/Cognify-Product-Description
   └─ branch: supabase-migration (has all v2 code — 14 commits)
   └─ will deploy to: Max's personal Vercel project → cognify-v2-xxx.vercel.app
   └─ env vars: Supabase keys (same project as Bob's — shared DB)

Supabase project: dunnoccrvrqzsgxsfjuv (SHARED between Bob and Max)
   └─ public schema: Bob's v1 tables (reps, delivery_scores) — untouched
   └─ cognify_v2 schema: v2's 17 tables
   └─ DB password: VokloV1223! (reset 2026-04-15 — Bob's env still has the old one)
```

Both deployments hit the SAME Supabase database. They just read/write different schemas. No data collision possible (RLS + schema isolation).

---

## The three cutover paths

Pick the path after Bob reviews the preview URL and says yes. All three are reversible.

### Path A — PR merge to Bob's upstream (RECOMMENDED)

**What happens:** Max opens a PR from his fork → Bob's repo. Bob merges. Bob's Vercel project auto-deploys from `main`. The framework preset auto-updates to Next.js (detected from package.json). `cognifygym.com` serves v2 with zero DNS changes.

**Prereq:**
- Bob grants Max **collaborator access** (Settings → Collaborators → add `maxvolkov202`) OR Bob merges the PR himself
- Bob grants Max **member access** to his Vercel project so Max can set env vars

**Steps:**
1. Open PR:
   ```bash
   gh pr create --repo bobsides-AICodebase/Cognify-Product-Description \
     --base main --head maxvolkov202:supabase-migration \
     --title "Cognify v2 — Supabase migration" \
     --body-file docs/DEPLOYMENT.md
   ```
2. Before merging, update env vars on Bob's Vercel project (Settings → Environment Variables — see `docs/DEPLOYMENT.md` § Step 2 for the full list). CRITICAL — without these, the deploy will fail.
3. Bob (or Max with write access) merges the PR
4. Vercel auto-builds `main` → Next.js deploy → `cognifygym.com` serves v2 (~3-5 min build)
5. Smoke-test production immediately (sign up, do a rep, verify feedback)
6. If broken: rollback via Vercel → Deployments → previous deploy → "Promote to Production"

**Pros:** Zero DNS work, Bob's Vercel project stays authoritative (billing/ownership unchanged), clean git history.
**Cons:** Requires Bob's active involvement (add collaborators + set env vars).
**Reversibility:** Perfect. Promote a previous Vercel deploy in one click.

---

### Path B — Domain transfer to Max's Vercel project

**What happens:** Deploy to Max's personal Vercel as the long-term home. Detach `cognifygym.com` from Bob's Vercel project, attach to Max's. Bob's repo becomes a historical archive.

**Steps:**
1. Deploy v2 to Max's personal Vercel (this is what we're doing next — `vercel` CLI)
2. Smoke-test the preview URL (`cognify-v2-xxx.vercel.app`)
3. Share URL with Bob for review
4. Once approved, detach the domain from Bob's Vercel:
   - Bob (or anyone with access) → Vercel Dashboard → Bob's cognify project → Settings → Domains → find `cognifygym.com` → **Remove**
5. Attach to Max's Vercel project:
   - Max → Vercel Dashboard → his new project → Settings → Domains → **Add Domain** → enter `cognifygym.com`
   - Vercel shows the required DNS records (should already match what's configured)
6. DNS propagation: usually seconds, up to 15 min. Vercel verifies automatically.
7. `cognifygym.com` now serves v2 from Max's Vercel
8. Archive Bob's repo: `bobsides-AICodebase/Cognify-Product-Description` → rename to `Cognify-v1-archive`

**Pros:** Max owns the deployment, no dependency on Bob's Vercel access. Lower coordination overhead going forward.
**Cons:** Bob loses the domain from his account. If billing/enterprise Vercel features matter, this may affect him.
**Reversibility:** Good. Reverse the two "Domains" steps — takes 5 min to move it back. During the ~15-min propagation window, the domain may briefly resolve to Vercel's "no project found" page.

---

### Path C — Vercel project transfer

**What happens:** Max builds the v2 project under his Vercel account, then transfers ownership to Bob's Vercel team. Domain stays attached throughout transfer.

**Steps:**
1. Deploy v2 to Max's personal Vercel (same as Path B step 1)
2. Configure Bob's Vercel team with Max added as member
3. Vercel Dashboard → Max's project → Settings → General → Advanced → **Transfer project** → pick Bob's team
4. Update the Git repo connection to point at Bob's upstream (or leave it on Max's fork if Bob's OK with that)
5. Domain follows the project — `cognifygym.com` continues serving without interruption

**Pros:** No DNS changes, no data loss, domain stays attached through transfer.
**Cons:** Vercel project transfers are a less-trodden path; requires Bob accepting the transfer. Sometimes requires both parties to be on the same Vercel plan tier.
**Reversibility:** Transfer back is possible but awkward.

---

## Recommended sequence

1. **Today:** Deploy to Max's personal Vercel → preview URL. No domain changes yet.
2. **Share preview with Bob.** Bob clicks around, kicks tires, gives feedback.
3. **Once Bob approves:** Pick Path A (clean merge) unless Bob specifically wants one of the others. Path A is the lowest-risk way to flip `cognifygym.com` to v2 because it requires zero DNS work.
4. **Rollback ready:** if anything breaks post-cutover, one-click rollback via Vercel Deployments → Promote previous.

---

## What could break during cutover + mitigations

| Risk | How it manifests | Mitigation |
|---|---|---|
| Env vars missing on production Vercel | Build succeeds but /api/score, /api/transcribe, /api/upload all 500 | Set env vars BEFORE merge (Path A) or BEFORE domain attach (Path B) |
| DB password mismatch | Every Supabase call fails with "password authentication failed" | Verify `DATABASE_URL` in Vercel has `VokloV1223%21` (URL-encoded !) |
| OAuth redirect URL not whitelisted | Google sign-in redirects to `/signin?error=...` after auth | Update Supabase → Auth → URL Configuration to include `https://cognifygym.com/auth/callback` |
| Vercel framework preset still "Vite" | Build runs `vite build`, fails on Next.js-specific config | Path A: update in Vercel settings before merge. Path B: auto-detected on new project. |
| RLS blocking authenticated reads | Pages showing empty progress/friends data, console shows 401s | Verify `auth_user_id` column is linked when users sign up — the resolveSupabaseUser action handles this automatically on first sign-in |
| Supabase Storage bucket private with wrong policies | Audio upload succeeds but playback 403s | Bucket already configured via our code; verify signed URLs are being generated (check /api/validate/audio/[repId]) |
| Bob's v1 app still pointing at the shared DB with the broken password | Bob's app crashes on any DB call | Tell Bob to update his env vars. If his app is disposable, no action needed. |

---

## Final verification after domain points at v2

Visit `https://cognifygym.com` in incognito and confirm:

- [ ] Landing page loads (not a Vercel 404 or old v1 UI)
- [ ] `View Source` → it's a Next.js app (contains `__NEXT_DATA__` or `/_next/`)
- [ ] `/signin` loads with email/password form + Google button
- [ ] Sign up with a fresh email → redirected to `/dashboard`
- [ ] Do one Daily Workout rep → scoring completes → feedback panel renders
- [ ] Check `cognify_v2.users` in Supabase → new row created with your auth_user_id
- [ ] Sign out → landing page
- [ ] Check Vercel deployment log for any runtime errors in the first 10 min

If any of these fail, rollback via Vercel Deployments → Promote previous deploy. Then diagnose offline.

---

## Quick reference

- **Supabase project:** `dunnoccrvrqzsgxsfjuv` (shared — don't delete)
- **DB password (URL-encoded):** `VokloV1223%21`
- **v2 branch:** `supabase-migration` on `maxvolkov202/Cognify-Product-Description`
- **Latest v2 commit to verify against:** check with `git log supabase-migration -1 --oneline`
- **Deployment guide (env vars + step-by-step):** `docs/DEPLOYMENT.md`
- **TODO list (what's left):** `TODO.md`
