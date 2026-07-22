---
name: Supabase migration progress
description: V1+V2 Cognify merge status as of 2026-04-16. All phases code-complete including Phase 4 UI wiring behind feature flag. Deployment remains. Check git log on supabase-migration branch before trusting.
type: project
originSessionId: 9b154b74-1399-441e-8545-629bc87b1277
---
**Plan file:** `C:\Users\MaxVolkov\.claude-personal\plans\wise-cuddling-owl.md`

**Deployment guide:** `C:\Users\MaxVolkov\dev\cognify\docs\DEPLOYMENT.md` (6-step walkthrough)

**Branch:** `supabase-migration` on `maxvolkov202/Cognify-Product-Description` (Max's fork of Bob's repo).

**Supabase project:** `dunnoccrvrqzsgxsfjuv` (shared with Bob's v1). V2 tables in `cognify_v2` schema (17 tables, RLS on reps); Bob's v1 in `public` (reps, delivery_scores) — untouched.

**DB password:** `VokloV1223!` (reset 2026-04-15). Bob's v1 app is broken until he updates his env vars.

**Phase status — all code-complete:**
- Phase 0: DONE — repo, Supabase CLI, ESLint
- Phase 1: DONE — Drizzle postgres-js, cognify_v2 schema, reps.status column
- Phase 2: DONE — Supabase Auth full replacement, NextAuth removed
- Phase 3: DONE — Supabase Storage, signed URLs
- Phase 4: DONE — async Edge Function + realtime + RLS + RepSurface UI wiring behind `NEXT_PUBLIC_USE_ASYNC_SCORING` flag (default off until deployed)
- Phase 5: DONE — mic pre-warming, framework scoring weight profiles
- Phase 6: N/A — no production data to migrate

**Commits on supabase-migration:**
```
24dda5fc  wire RepSurface to async Edge Function path + deployment guide
b818160a  Phase 4 — async scoring infrastructure
914d0e3e  Phase 2 cleanup — remove NextAuth
4ce0eaec  Phase 5 — mic pre-warming + framework scoring profiles
f2f2ad8b  fix: email/password form in LoginDialog modal
bcd3a0be  Phase 2b — Supabase Auth sign-in/out + OAuth callback
b0323408  Phase 2a — Supabase Auth client utilities
4c5a5599  chore: claude settings cache
0ff62aad  Phase 3 — storage migration
32fbf467  Phase 1 — DB migration
73b82cf1  Phase 0 — Supabase CLI + ESLint
2d9b7bb7  Phase 0 — initial v2 codebase
```

**Backups (frozen):**
- v2 pre-merge: `C:\Users\MaxVolkov\dev\cognify-v2-backup-pre-merge`
- v1 reference: `C:\Users\MaxVolkov\dev\cognify-v1-cto`

**What's left — all deployment coordination, zero code work:** see project_deferred-work.md. High-level:
1. Open PR from fork → Bob's upstream (or Bob grants push access)
2. Vercel config: framework → Next.js, set env vars (including the new INTERNAL_SCORING_SECRET + NEXT_PUBLIC_USE_ASYNC_SCORING)
3. Google OAuth: create Google Cloud OAuth client, enable provider in Supabase Dashboard
4. Deploy Edge Function via `supabase login` + `supabase functions deploy process-rep`
5. Manual browser E2E tests per docs/DEPLOYMENT.md checklist
6. Notify Bob about DB password reset
7. Flip `NEXT_PUBLIC_USE_ASYNC_SCORING` to "true" after smoke-testing the async path

**How to apply:** If Max says "resume the migration," read docs/DEPLOYMENT.md — that's the canonical next-steps document. The code side is done.
