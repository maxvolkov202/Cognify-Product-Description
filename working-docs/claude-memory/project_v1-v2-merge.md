---
name: Cognify V1+V2 Merge
description: Major migration merging CTO's v1 (Supabase backend) with Max's v2 (product-rich Next.js). Full Supabase migration in progress.
type: project
originSessionId: 9b154b74-1399-441e-8545-629bc87b1277
---
Cognify is merging two codebases as of 2026-04-15:
- **Max's v2** (`C:\Users\MaxVolkov\dev\cognify`): Next.js 15, Drizzle/Neon, NextAuth, Claude/Deepgram. 48+ components, 22 tables, 9 rep types. THE product base.
- **CTO's v1** (`C:\Users\MaxVolkov\dev\cognify-v1-cto`, cloned from `bobsides-AICodebase/Cognify-Product-Description`): Vite SPA + Supabase (Auth/DB/Storage/Edge Functions) + OpenAI. Better backend architecture, simpler product surface.

**Why:** CTO (Bob, girlfriend's dad of Max's partner) has better infrastructure patterns (async Edge Functions, realtime subscriptions, status state machine). Max has the better product. Combining both.

**How to apply:**
- V2 product is always predominant — never discard features/knowledge/scoring for v1 patterns
- Migration target: Supabase (Postgres + Auth + Storage + Edge Functions)
- AI stays Claude + Deepgram (not OpenAI)
- Auth: Supabase Auth with Google OAuth + email/password
- New repo: `bobsides-AICodebase/Cognify-v2`
- CTO has invited Max to Supabase project (dashboard access)
- The CTO's "backend" IS Supabase — no separate backend repo exists
