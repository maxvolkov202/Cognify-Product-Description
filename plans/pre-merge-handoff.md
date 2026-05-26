# Pre-merge handoff — paste this into the next chat

Last updated: 2026-05-26. This document captures everything the planning chat
needs to know without asking Max engineer-level questions.

---

## What we're actually shipping

Not a 19-commit audit cleanup. A **full v1 → v2 codebase cutover**:

- `upstream/main` = Bob's v1 Vite SPA, currently serving `cognifygym.com` to
  Max + Bob + a small soft-launch group.
- `origin/feat/muscle-group-pivot` (Max's fork) = the v2 Next.js codebase
  with the full Supabase migration + muscle-group pivot + audit fixes.
- `HEAD` is **268 commits ahead of upstream/main**, ~66k file diff
  (the 2.5M deletions are v1's removal).
- When the PR from Max's fork merges into Bob's `main`, `cognifygym.com`
  flips entirely from v1 to v2.

The 19 audit follow-up commits are the LAST layer. They sit on top of:

| Layer | Roughly |
|---|---|
| Phase 0/1/3 Supabase migration (DB / Storage) | ~30 commits |
| Phase 2 NextAuth → Supabase Auth | ~10 commits |
| Phase 4 async Edge Function scaffolding | code present, flag off |
| Phase 5 mic pre-warming + framework weight profiles | ~3 commits |
| Muscle-group pivot (15 phases + launch-prep) | ~30 commits |
| Full-app audit fixes (Commit 0 split + Commits 1–8 sprint + 5 follow-ups) | 19 commits |

`docs/DEPLOYMENT.md` is the v1 → v2 cutover playbook. **Read it first.**

---

## Operating instructions — Max is not an engineer

Max is the founder, not a developer. He cannot answer engineer-level
questions like "should we apply 0026 before deploying or after?" or
"should img-src be `https:` or a hand-rolled allowlist?" He CAN answer:

- Product decisions: what users see / hear / receive.
- Communication decisions: do we email users before deleting their audio.
- Timing decisions: ship today vs Tuesday vs after Bob's vacation.
- Risk-appetite decisions: shorter retention default vs longer.

**Default to production-ready.** Where two paths are technically valid,
pick the more rigorous one without asking. State the reasoning so Max
can override if the trade-off matters to him.

When you must ask Max, use `AskUserQuestion` and phrase questions in
**non-technical product language**. Examples:

- BAD: "Should we use a tighter CSP allowlist or `img-src https:`?"
- GOOD: "When users add their own profile photo from Google sign-in, the
  app needs permission to display images from Google's servers. Two
  ways: allow ANY https image (covers Google + every other source we
  add later, slightly less safe), or maintain an explicit list (safer,
  but a future provider that's not in the list won't display photos
  until we update the list). Which do you prefer?"

---

## Persisted context from prior session

### Prod data state
**Soft-launch.** Max + Bob + a small group. Real users + real reps.
The audio-retention cron has real blast radius. Migrations 0026/0027
need real pre-checks against live data.

### .env.local points at PROD
The local DATABASE_URL targets the production Supabase project
(`dunnoccrvrqzsgxsfjuv`). There is no separate dev DB. "Looks good
locally" already validates against prod data. **Implication: any
migration applied via `scripts/apply-migration.mjs` from Max's machine
hits prod.** The separate `scripts/apply-prod-migration.mjs` uses
`.env.prod-temp` pulled fresh via `vercel env pull` — but it goes to
the same DB. The distinction is paranoia, not a different target.

### Deploy mechanism (per docs/DEPLOYMENT.md)
- **Preview**: `cognify-v2-neon.vercel.app` (Max's hobby Vercel project,
  scope `maxvolkov202s-projects`). Git integration is OFF. Deploy
  manually with:
  ```
  npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects
  ```
  `--prod` here means "promote to the `cognify-v2-neon` alias" — it
  does NOT touch real production.
- **Production**: `cognifygym.com`. Lives on Bob's Vercel project under
  `bobsides-AICodebase/Cognify-Product-Description`. Real prod deploy
  happens when a PR from `maxvolkov202:feat/muscle-group-pivot` →
  `bobsides-AICodebase:main` merges. Bob owns the merge.

### Migration apply mechanism
Dev (any DB):
```
node scripts/apply-migration.mjs path.sql        # reads .env.local
```
Prod (explicit, via fresh prod env pull):
```
npx vercel env pull .env.prod-temp --environment=production --yes
node scripts/apply-prod-migration.mjs path.sql
rm .env.prod-temp
```
Both scripts split `ALTER TYPE ... ADD VALUE` statements out of the
transaction (Postgres can't use a new enum value in the same tx).

### Safety rails still in effect
- Do not push to origin without Max's approval (`git push`).
- Do not apply migrations against prod without Max's approval.
- Do not open PRs without Max's approval.

---

## Findings from pre-investigation (don't redo)

### CSP gaps the planning chat should fix before shipping

The CSP enforcing header (commit `a0ff2c0d`) has an allowlist that does
NOT cover several origins the browser ACTUALLY fetches in prod:

| Origin | Why the browser fetches it | Current CSP coverage |
|---|---|---|
| `img.youtube.com` | Library page video thumbnails (`thumbnailFor()` in `src/app/(app)/library/page.tsx`) | ❌ NOT in `img-src` |
| `*.googleusercontent.com` (and similar OAuth avatar hosts) | UserMenu renders the OAuth profile photo via `<Image src={image} unoptimized>` | ❌ NOT in `img-src` |
| Arbitrary OG image hosts | `getOgImageUrl()` returns absolute external URLs the browser then fetches | ❌ NOT in `img-src` |
| `https://api.openai.com` | OpenAI scoring fallback in `src/lib/ai/claude.ts` | N/A — server-side, CSP doesn't apply to server fetches |
| `https://api.hume.ai` | Hume prosody — currently in CSP `connect-src` but it's server-side, so the entry is redundant (harmless) | ✓ but redundant |

**The CSP enforcing header will block library thumbnails + OAuth
avatars in prod the moment it's deployed.** Choices:

- **Production-ready default**: `img-src 'self' blob: data: https:` —
  allows any HTTPS image. Standard for content-rich apps. Trade-off:
  an XSS that injects `<img src="https://attacker.com/track">` can
  exfiltrate via the URL. Since `script-src` blocks the actual script,
  this is widely-accepted minor risk.
- **Tighter alternative**: enumerate every known OG host. Brittle —
  any new library entry silently breaks until CSP is updated.

The planning chat should pick `https:` and explain to Max in product
terms ("display any image our content links to vs only images from
specific approved sources"). Then patch `next.config.ts` accordingly.

### `audio-retention` cron missing dry-run

`src/app/api/cron/muscle-group-day-rollover/route.ts` supports
`?dryRun=1` (counts what would happen, doesn't write). The newer
`/api/cron/audio-retention/route.ts` does **not**. Production-ready
add: same `?dryRun=1` flag. The planning chat should patch this
BEFORE first prod run so Max can preview the blast radius.

### Pre-check script exists, not yet run

`scripts/_audit-prechecks.mjs` (gitignored — `/scripts/_*.mjs`
pattern in `.gitignore`) contains read-only SELECTs for:

- 0025 first-run blast radius (count of reps with audio older than 90/30 days)
- 0026 orphan rows for each new FK (7 separate checks)
- 0026 malformed JSONB array detection (would block the type-change cast)
- 0027 case-variant email duplicates (would block the UNIQUE recreate)
- Misc: operator count, user count, guest count, oldest rep sample

The script was auto-blocked from executing (correctly — it returns
PII into the transcript). The planning chat must:
1. Ask Max explicitly to authorize "run `node scripts/_audit-prechecks.mjs`
   against the production database — read-only, returns aggregate counts
   plus any case-variant email addresses that would block the migration."
2. Run it once authorized.
3. Bake the actual numbers into the merge plan.

### Inventory of external origins in the codebase

From `grep` across `src/`:
- `https://api.hume.ai` (server-side prosody worker)
- `https://img.youtube.com` (browser — library thumbnails)
- `https://www.youtube.com`, `https://youtu.be` (URL parsing only)
- `https://www.ted.com` (library link target)
- `https://link.springer.com` (library)
- `https://www.genardmethod.com` (library)
- `https://hiring.monster.com` (library)
- `https://procurementtactics.com` (library)
- `https://www.google.com` (URL strings in copy, not fetches)
- `https://cognify-v2-neon.vercel.app`, `https://cognifygym.com` (self refs)
- Supabase Storage URLs (signed URL playback — `*.supabase.co`)
- OAuth avatar URLs (Google + future providers — `*.googleusercontent.com`)

### Git topology
```
origin    = https://github.com/maxvolkov202/Cognify-Product-Description.git   (Max's fork)
upstream  = https://github.com/bobsides-AICodebase/Cognify-Product-Description.git  (Bob's prod repo)
HEAD branch  = feat/muscle-group-pivot
distance to upstream/main = 268 commits ahead, ~66k files in diff
upstream/main package.json name = "@figma/my-make-file" (Vite SPA — confirms v1 is Bob's pre-cutover code)
```

---

## Required reads (in order)

1. `docs/DEPLOYMENT.md` — the v1→v2 cutover playbook. **Critical.**
2. `plans/full-app-audit-2026-05-24.md` — 68 audit findings; the 19 commits are the closure.
3. `plans/full-app-audit-followups.md` — sprint plan that drove the 19 commits.
4. `memory/project_full-app-audit-fixes.md` — what shipped, in detail.
5. `memory/project_muscle-group-pivot.md` — pivot context.
6. `plans/cto-review-2026-05-24.md` — Bob's prior review of the pivot.
7. `plans/muscle-group-pivot-launch-checklist.md` — pivot launch gates.
8. `memory/project_deferred-work.md` — things explicitly skipped.

Then survey the diff:
```
git log --oneline upstream/main..HEAD          # 268 commits
git log --oneline origin/feat/muscle-group-pivot..HEAD   # the 19 audit follow-ups
git diff --stat upstream/main..HEAD            # ~66k files (v1 deletion noise)
git diff --stat origin/feat/muscle-group-pivot..HEAD     # the 84-file audit diff
```

---

## Authorization gates — things to ask Max for

These are the only things to ask Max about. Use `AskUserQuestion` with
non-technical phrasing.

| Gate | Why we need it | When |
|---|---|---|
| Run `scripts/_audit-prechecks.mjs` against prod DB | Read-only, returns aggregate counts + case-variant emails. Required to size the migration risk. | Before running the script. |
| Apply migration 0025 against prod | Adds `users.audio_retention_days INTEGER DEFAULT 90`. Additive, no data loss. | After preview deploy + smoke pass. |
| Apply migration 0026 against prod | Adds 7 FKs, 3 indexes, drops 1 index, converts 4 JSONB columns to native arrays. Pre-checks must pass. | Only after pre-checks return all zeros. |
| Apply migration 0027 against prod | Switches `users.email` + `crew_invites.email` to `citext`. Pre-check must return zero case-variant duplicates. | Only after pre-check. |
| Push `feat/muscle-group-pivot` → `origin` | Makes the branch visible on GitHub for PR-creation. | After all above. |
| Deploy to Max's preview (`cognify-v2-neon`) | Runs `vercel deploy --prod --yes --scope maxvolkov202s-projects`. Updates only the preview alias. | After push. |
| Open PR from Max's fork → `bobsides-AICodebase:main` | Real prod cutover begins. Bob does the merge. | After Max + Bob have walked the preview. |
| Merge PR | Vercel auto-deploys `cognifygym.com` to v2. | Bob's call. |

---

## Autonomous decisions — production-ready default, don't ask Max

These are engineering choices. Pick the rigorous option, state it in
the plan, move on.

- **CSP `img-src`**: Set to `'self' blob: data: https:` to cover OG
  images + OAuth avatars + YouTube thumbnails. Explain to Max once,
  not as a question.
- **`audio-retention` cron**: Add `?dryRun=1` support mirroring the
  rollover cron's pattern BEFORE first prod run. One small commit.
- **Migration ordering**: 0025 → 0026 → 0027, all BEFORE the prod
  Vercel deploy. Reasoning: the v2 code already expects the column +
  array shapes; deploying code first would crash on the first prod
  request. Apply migrations first, then deploy code.
- **Email zod schema for `setAudioRetentionAction`**: already
  validates `30 | 90 | 180 | null`. Add a comment if confusing,
  don't change behavior.
- **`unsafe-eval` in CSP `script-src`**: keep it. Next.js prod with
  the App Router still requires it for some runtime patterns. Remove
  in a future hardening pass after confirming with a preview deploy
  that nothing breaks.
- **HSTS preload**: already set, 63072000s. Don't change.
- **First-run audio-retention cron**: schedule it for 03:30 UTC the
  NIGHT AFTER the prod deploy, so we sleep on it. Don't trigger
  manually on launch day.
- **Service worker**: `cacheOnNavigation: false` is the right call.
  Don't revisit.

---

## Reserved for Max — DO ask, in product language

- **Audio retention default (30 / 90 / 180 / forever)**: The migration
  sets default 90 days. The first cron run will sweep audio older than
  90 days from existing users. Ask Max:
  > "We're about to add a setting that auto-deletes voice recordings
  > after a chosen window. The default is 90 days — anything older
  > than 90 days gets cleaned out on the first nightly sweep. Some
  > users in the soft-launch group may have recordings that old.
  > Three choices: (a) keep 90 days, let the cleanup run (b) bump
  > the default to 180 days for a softer first run (c) email the
  > soft-launch group with a heads-up before the first sweep."

- **Audio cleanup announcement**: only if Max picks (c) above. Plan
  the email copy.

- **CSP rollout caution**: After explaining the `img-src https:`
  decision, ask:
  > "If a third-party origin we haven't accounted for blocks on
  > production (e.g. a future OAuth provider, a new analytics
  > tool), users would see broken images for a few minutes until
  > we ship a patch. Acceptable, or do you want to stage this in
  > Report-Only mode on the preview deploy for a day first to
  > collect data?"

- **Bob coordination timing**: When in the week should the prod
  cutover happen? Don't ship Friday afternoon. Confirm with Max
  before opening the PR.

- **Smoke matrix walk-through**: After preview deploy, Max needs to
  click through specific user flows. The planning chat produces the
  matrix; Max executes; planning chat reviews results.

---

## Review passes the planning chat MUST run

### Pass 1: Diff-level review (parallel)

Spawn three reviewers concurrently:

1. **`/security-review`** — security-focused review of the diff vs
   `upstream/main`. Flag any new attack surface; verify the auth gates
   added in commit 9a9bb7b6 are correctly applied.
2. **`/code-review --effort high`** — broad correctness review at high
   effort. Especially scrutinize:
   - `src/server/actions/workout-session.ts` (folded tagWorkoutRep tx
     + ownership in one commit; complex)
   - `src/server/actions/workout-day.ts` (TZ-keyed days + ON CONFLICT)
   - `src/app/api/cron/audio-retention/route.ts` (new, never tested
     in prod conditions)
   - `instrumentation.ts` + `src/lib/env.server.ts` (boot-time
     validation, could panic prod on env misconfiguration)
   - `next.config.ts` CSP allowlist (see §Findings above)
3. **Manual semantic review** — does each of the 19 audit commits
   actually fix what the audit flagged? Spot-check by:
   - Reading the audit finding (`plans/full-app-audit-2026-05-24.md`)
   - Reading the commit diff
   - Confirming the code now satisfies the audit's "Fix:" recommendation
   - Verifying no scope creep beyond what the audit asked for

### Pass 2: Cross-cutting integration review

Things only visible across multiple commits, not in any single diff:

- **React.cache + Promise.all interaction**: commit 62e73bc4 added
  React.cache on currentUser/getUserProfile/etc; commit b35cc8ae
  parallelized layout/dashboard. Trace one request flow end-to-end
  and confirm the cache deduplication actually fires across the
  parallel calls.
- **TZ keying consistency**: every site that reads or writes
  `muscle_group_days.day_date` MUST use `todayYmdInTz(profile.tz)`.
  Grep for the old `todayISODateUTC` / `todayUTC()` patterns and
  confirm nothing snuck back in.
- **Auth gate completeness**: every route under `src/app/api/` that
  burns Anthropic / Deepgram / Vercel Blob should require a logged-in
  user OR a cron secret OR an operator. Audit by enumerating
  `src/app/api/**/route.ts` and verifying each one's auth check.
- **Type cast hygiene**: commit 449d020d removed `as unknown as
  object` casts via `.$type<>()`. Grep `as unknown as` in
  `src/server/actions/` and `src/lib/db/queries/` — should be empty
  or only client-side React patterns.

### Pass 3: Migration safety + cutover plan

- Run `scripts/_audit-prechecks.mjs` after Max authorizes.
- Read the output carefully. If any FK orphan count > 0, plan how
  to clean them BEFORE applying 0026.
- If any case-variant email dupes, plan the merge BEFORE applying
  0027 (pick which row wins by `createdAt ASC`; reassign auth_user_id
  if needed; delete the loser; re-run the pre-check).
- Document each migration's rollback SQL in the plan.

### Pass 4: Smoke matrix design

Produce a numbered checklist Max can click through on the preview
deploy at `cognify-v2-neon.vercel.app` AFTER the push. Each item:
- One concrete action ("Sign in with Google as a new user")
- Expected result ("Land on /onboarding/vertical")
- What to check ("DevTools Network tab: no 401/403/500; Console:
  no CSP violation warnings")
- MUST PASS or NICE TO PASS

Minimum coverage (expand as the review surfaces more):
1. Sign in with Google as a fresh user → onboarding
2. Sign in with email/password
3. Sign out → reload → confirm signed-in shell NOT served (SW
   cacheOnNavigation: false check)
4. Continue as guest → complete a rep → score appears
5. Workout: Start → 4 reps → day complete summary
6. Dashboard load — check Network tab: parallelized fetches, no
   waterfall
7. Library load — check images all load (CSP check on `img-src`)
8. Privacy section: change retention to 30 → reload → still 30
9. `curl -X POST https://...preview.../api/score` unauthed → 401
10. `curl https://...preview.../api/score/health/stats` unauthed → 401
11. DevTools console on every page visit: zero CSP violations
12. Network → Headers → confirm CSP enforcing form, HSTS, Permissions-Policy
13. /ops only loads when `is_operator=true` on the user row
14. RestDayNotification fires correctly based on profile.tz + committedDays
15. Audio playback works on a 1-week-old rep (signed URL flow)

### Pass 5: Reverse-the-camera review

After all the above, ask: "if this merge breaks production, what's
the rollback path?" `docs/DEPLOYMENT.md` §Rollback covers Vercel
deployment rollback; planning chat should add:
- DB rollback for each migration (drop column for 0025; drop
  constraints + reverse JSONB casts for 0026; drop citext extension
  + revert column type for 0027)
- Feature flag fallbacks (`FF_MUSCLE_GROUP_WORKOUT` flips to BetaSoon
  placeholder if needed)
- A go/no-go criterion: "if X happens in the first 30 minutes after
  cutover, we roll back."

---

## Deliverables

By the end of the planning session, produce these in the repo:

1. `plans/pre-merge-review.md` — synthesis of all 5 review passes.
2. `plans/cutover-checklist.md` — the executable, ordered checklist.
   Max should be able to execute it step-by-step with no engineering
   judgment required. Each step has:
   - Exact command to run
   - Expected output
   - What to do if it fails
3. `plans/smoke-matrix.md` — the click-through matrix for the
   preview deploy.
4. `plans/rollback.md` — DB rollback + Vercel rollback playbook.
5. Updated `memory/project_full-app-audit-fixes.md` reflecting the
   review verdict + cutover status.

---

## Final report-back to Max

At the end of planning, give Max:

1. **One-paragraph readiness verdict.** "Ready to ship / ready with
   caveats / not yet ready."
2. **Top 3 risks** in plain language. Not "race condition in X" but
   "if users on iOS Safari sign out and back in, their old workout
   shell might briefly flash."
3. **Asks**: a numbered list of decisions or authorizations needed
   from Max.
4. **Time estimate** for the cutover end-to-end (push → preview
   smoke → migrations → PR → merge → prod smoke).

Use ExitPlanMode when the plan is ready for sign-off.

ultrathink. Don't be brief. This needs to be airtight.
