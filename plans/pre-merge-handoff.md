# Pre-merge handoff — paste this into the next chat

Last updated: 2026-05-27. This document captures everything the planning chat
needs to know without asking Max engineer-level questions.

---

## What "merge to production" means in Max's vocabulary

It does NOT mean a GitHub PR to Bob's upstream repo. Bob's `cognifygym.com`
is an old v1 Vite SPA Max stopped iterating on — out of scope for now.

It DOES mean: deploy the current branch HEAD to **`cognify-v2-neon.vercel.app`**
(Max's working production, alias of his Vercel project `cognify-v2` under team
`maxvolkov202s-projects`). The mechanic is a single CLI call:

```
npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects
```

That promotes whatever's in the working directory to the `cognify-v2-neon`
alias. Vercel git integration is OFF on this project, so there's no
automatic push-based deploy. Max controls when prod updates by running
that command.

**Note:** the session-start hook claims Vercel CLI isn't installed —
it's wrong. `vercel --version` returns `50.38.3`. The CLI is in
`C:\Users\MaxVolkov\AppData\Roaming\npm\vercel`.

---

## What's actually unmerged

The deployed code at `cognify-v2-neon.vercel.app` is **23 days old** —
last deploy was `2026-05-04 21:24 EDT`. By inspecting the live HTML
(it still says "Daily Workout" instead of "Today's Workout", and the
response has no `Content-Security-Policy` header) the deployed commit
is the dna-base layer at tag `dna-base-layer-shipped-2026-05-04`
(commit `3b10e6a2`).

**Gap: 87 commits ahead, 306 files changed (+53,482 / −2,424).**

```
git log 3b10e6a2..HEAD --oneline | wc -l    # 87 commits
git diff --shortstat 3b10e6a2..HEAD          # 306 files, +53k −2.4k
```

What's in those 87 commits, grouped:

| Layer | What it ships |
|---|---|
| RAG + scoring overhaul Phase 0–6 | telemetry, two-stage scoring, pgvector knowledge, reference rep exemplars |
| Workout pre-rep skill scenarios + rep redesign + state-machine fix | the deep workout UX rework |
| Onboarding committed-days schedule + rest-day +50% XP | Phase C scheduling |
| Calibration drift cron + ops dashboards | nightly calibration health |
| Weekly callout drift + callout corrections loop | scoring quality feedback loop |
| Theme: light/dark/system toggle + dark-mode coverage | full dark-mode |
| Wave 1 vertical prompt expansion — 4,320 prompts + picker cascade | the prompt bank |
| CTO review fixes (engagement linkage, TZ unification, picker bias) | bug sweep |
| Muscle-group pivot — 15 phases + 5 launch-prep + flag gate | the just-shipped pivot |
| Full-app audit fixes — Commit 0 split (6) + Commits 1–8 sprint (8) + 5 cleanup follow-ups (5) | last 19 commits |

The audit fixes are the LAST layer. Everything in this stack is already
on the branch; the audit just made what was there production-ready.

---

## Operating instructions — Max is not an engineer

Max is the founder, not a developer. He cannot answer engineer-level
questions like "should we apply 0026 before deploying or after?" or
"should img-src be `https:` or a hand-rolled allowlist?" He CAN answer:

- Product decisions: what users see / hear / receive.
- Communication decisions: do we email users before deleting their audio.
- Timing decisions: ship today vs Tuesday vs after [event].
- Risk-appetite decisions: shorter retention default vs longer.

**Default to production-ready.** Where two paths are technically valid,
pick the more rigorous one without asking. State the reasoning in the
plan so Max can override if the trade-off matters to him.

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

## Persisted context

### Prod data state
**Soft-launch.** Max + Bob + a small group on `cognify-v2-neon.vercel.app`.
Real users + real reps. The audio-retention cron has real blast radius.
Migrations 0026/0027 need real pre-checks against live data.

### .env.local points at the same prod Supabase project
The local `DATABASE_URL` targets the production Supabase project
(`dunnoccrvrqzsgxsfjuv`). There is no separate dev DB. "Looks good
locally" already validates against prod data. The `cognify-v2-neon`
Vercel deploy also reads from the same Supabase project.

There IS a paranoia-mode separation in the migration tooling
(`scripts/apply-migration.mjs` uses `.env.local`, `scripts/apply-prod-migration.mjs`
uses `.env.prod-temp` pulled fresh via `vercel env pull`) — but both
hit the same DB. The distinction is procedural, not topological.

### Deploy mechanic (single Vercel project)
Single Vercel project: `cognify-v2` under team `maxvolkov202s-projects`,
project ID `prj_SwZBC9rMztIlOxSdJPwVpHvr5seE`. Linked locally via
`.vercel/project.json`. Aliases:

- `cognify-v2-neon.vercel.app` ← the URL Max + Bob + soft-launch group hit
- `cognify-v2-maxvolkov202s-projects.vercel.app`
- `cognify-v2-maxvolkov202-maxvolkov202s-projects.vercel.app`

Deploy command:
```
npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects
```

After deploy, the build URL is shown as `cognify-v2-<hash>-maxvolkov202s-projects.vercel.app`
and the `cognify-v2-neon.vercel.app` alias updates to point to it
within seconds.

### Migration apply mechanism
Dev (any DB — but practically prod since .env.local IS prod):
```
node scripts/apply-migration.mjs path.sql
```
Belt-and-suspenders prod path (separate explicit env pull):
```
npx vercel env pull .env.prod-temp --environment=production --yes
node scripts/apply-prod-migration.mjs path.sql
rm .env.prod-temp
```
Both scripts split `ALTER TYPE ... ADD VALUE` statements out of the
transaction (Postgres can't use a new enum value in the same tx).

### Safety rails still in effect
- Do not push to origin without Max's approval (`git push`).
- Do not apply migrations against the prod DB without Max's approval.
- Do not run `vercel deploy --prod` without Max's approval.

---

## Findings from pre-investigation (don't redo)

### CSP gaps the planning chat should fix before deploying

The CSP enforcing header (commit `a0ff2c0d`) has an allowlist that does
NOT cover several origins the browser ACTUALLY fetches in prod:

| Origin | Why the browser fetches it | Current CSP coverage |
|---|---|---|
| `img.youtube.com` | Library page video thumbnails (`thumbnailFor()` in `src/app/(app)/library/page.tsx`) | ❌ NOT in `img-src` |
| `*.googleusercontent.com` (and similar OAuth avatar hosts) | UserMenu renders the OAuth profile photo via `<Image src={image} unoptimized>` | ❌ NOT in `img-src` |
| Arbitrary OG image hosts | `getOgImageUrl()` returns absolute external URLs the browser then fetches | ❌ NOT in `img-src` |
| `https://api.openai.com` | OpenAI scoring fallback in `src/lib/ai/claude.ts` | N/A — server-side, CSP doesn't apply to server fetches |
| `https://api.hume.ai` | Hume prosody — currently in CSP `connect-src` but it's server-side, so the entry is redundant (harmless) | ✓ but redundant |

**The CSP enforcing header WILL break library thumbnails + OAuth
avatars in prod the moment it's deployed.** Choices:

- **Production-ready default**: `img-src 'self' blob: data: https:` —
  allows any HTTPS image. Standard for content-rich apps. Trade-off:
  an XSS that injects `<img src="https://attacker.com/track">` can
  exfiltrate via the URL. Since `script-src` blocks the actual script,
  this is widely-accepted minor risk.
- **Tighter alternative**: enumerate every known OG host. Brittle —
  any new library entry silently breaks until CSP is updated.

The planning chat should pick `https:` and explain to Max in product
terms once (not as a blocking question). Then patch `next.config.ts`
in a small commit before the deploy.

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

The script was auto-blocked from executing in the prior session
(correctly — it returns PII into the transcript). The planning chat
must:
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
- Supabase Storage URLs (signed URL playback — `*.supabase.co`)
- OAuth avatar URLs (Google + future providers — `*.googleusercontent.com`)

### Live-vs-HEAD fingerprint to confirm

Quick verification the planning chat can run to double-check the
deployed commit is `3b10e6a2`-ish:

```
curl -s https://cognify-v2-neon.vercel.app/ | grep -oE "Daily Workout|Today's Workout"
curl -sI https://cognify-v2-neon.vercel.app/ | grep -i "content-security-policy"
```

- "Daily Workout" present + no CSP header = baseline confirmed pre-pivot, pre-audit.
- "Today's Workout" present or CSP header present = baseline is more
  recent than expected; re-survey before proceeding.

### Git topology
```
origin           = https://github.com/maxvolkov202/Cognify-Product-Description.git  (Max's fork)
upstream         = https://github.com/bobsides-AICodebase/Cognify-Product-Description.git  (Bob's ancient v1 — out of scope)
HEAD branch      = feat/muscle-group-pivot
distance to origin/feat/muscle-group-pivot  = 20 commits (the audit follow-ups)
distance to deployed cognify-v2-neon (≈3b10e6a2) = 87 commits (the real audit scope)
distance to upstream/main = 268 commits (irrelevant — Bob's repo isn't the target)
```

---

## Required reads (in order)

1. `docs/DEPLOYMENT.md` — most of this doc covers a Bob's-repo cutover
   that is NOT happening; ignore §1+. §0 (current preview fast-path)
   IS relevant.
2. `plans/full-app-audit-2026-05-24.md` — 68 audit findings; the 19
   most recent commits are the closure.
3. `plans/full-app-audit-followups.md` — sprint plan that drove the
   recent 19 commits.
4. `memory/project_full-app-audit-fixes.md` — what shipped, in detail.
5. `memory/project_muscle-group-pivot.md` — pivot context.
6. `plans/cto-review-2026-05-24.md` — Bob's prior review of the pivot.
7. `plans/muscle-group-pivot-launch-checklist.md` — pivot launch gates.
8. `memory/project_deferred-work.md` — things explicitly skipped.

Then survey the diff:
```
git log 3b10e6a2..HEAD --oneline                # 87 commits — the real scope
git diff --stat 3b10e6a2..HEAD                  # 306 files
git log origin/feat/muscle-group-pivot..HEAD --oneline  # last 20 audit commits
```

---

## Authorization gates — things to ask Max for

These are the only things to ask Max about. Use `AskUserQuestion` with
non-technical phrasing.

| Gate | Why we need it | When |
|---|---|---|
| Run `scripts/_audit-prechecks.mjs` against prod DB | Read-only, returns aggregate counts + case-variant emails. Required to size the migration risk. | Before running the script. |
| Apply migration 0025 against prod | Adds `users.audio_retention_days INTEGER DEFAULT 90`. Additive, no data loss. | After deploy + smoke pass. |
| Apply migration 0026 against prod | Adds 7 FKs, 3 indexes, drops 1 index, converts 4 JSONB columns to native arrays. Pre-checks must pass. | Only after pre-checks return all zeros (or after orphan-row cleanup). |
| Apply migration 0027 against prod | Switches `users.email` + `crew_invites.email` to `citext`. Pre-check must return zero case-variant duplicates. | Only after pre-check. |
| `git push origin feat/muscle-group-pivot` | Persist branch on GitHub for backup. Not required for deploy. | When confident. |
| `vercel deploy --prod --yes --scope maxvolkov202s-projects` | The actual production update. Promotes HEAD to `cognify-v2-neon.vercel.app`. | After preview-on-prod smoke + migrations applied. |

---

## Autonomous decisions — production-ready default, don't ask Max

These are engineering choices. Pick the rigorous option, state it in
the plan, move on.

- **CSP `img-src`**: Set to `'self' blob: data: https:` to cover OG
  images + OAuth avatars + YouTube thumbnails. One small commit before
  deploy. Explain to Max once in the plan, not as a question.
- **`audio-retention` cron**: Add `?dryRun=1` support mirroring the
  rollover cron's pattern BEFORE first prod run. One small commit.
- **Migration ordering**: 0025 → 0026 → 0027, all BEFORE the
  `vercel deploy --prod`. Reasoning: the v2 code already expects the
  new column shapes + native arrays; deploying code first would crash
  on the first prod request that reads them. Apply migrations first,
  deploy code second.
- **Email zod schema for `setAudioRetentionAction`**: already
  validates `30 | 90 | 180 | null`. Add a comment if confusing,
  don't change behavior.
- **`unsafe-eval` in CSP `script-src`**: keep it. Next.js prod with
  the App Router still requires it for some runtime patterns. Remove
  in a future hardening pass after confirming with a separate test
  that nothing breaks.
- **HSTS preload**: already set, 63072000s. Don't change. (Note:
  Vercel's `.vercel.app` domain ALSO sets HSTS by default on the
  edge — so the header appears on the live site even though our
  code didn't add it; once we deploy, our code adds it again,
  no conflict.)
- **First-run audio-retention cron**: schedule it for 03:30 UTC the
  NIGHT AFTER the prod deploy, so we sleep on it. Don't trigger
  manually on launch day.
- **Service worker**: `cacheOnNavigation: false` is the right call.
  Don't revisit.
- **Feature flag `FF_MUSCLE_GROUP_WORKOUT`**: currently the flag
  defaults ON in dev/preview and OFF in prod (`src/lib/flags.ts`).
  Decide whether to flip ON for the cognify-v2-neon deploy. **Default:
  flip ON in the Vercel env var for the cognify-v2-neon deploy** —
  the entire pivot is the point of this merge.

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

- **CSP rollout caution**: After applying the `img-src https:` patch,
  ask:
  > "If a third-party origin we haven't accounted for blocks on the
  > live site (e.g. a future OAuth provider, a new analytics tool),
  > users would see broken images for a few minutes until we ship
  > a patch. Acceptable, or do you want to stage in 'Report-Only'
  > mode first (the browser logs violations but doesn't block them)
  > for a day to collect data?"

- **Bob coordination timing**: Does Bob need a heads-up before the
  deploy? The Supabase project is shared with him. Migrations 0025/
  0026/0027 alter shared tables. Confirm with Max before applying.

- **Smoke matrix walk-through**: After deploy, Max needs to click
  through specific user flows. The planning chat produces the
  matrix; Max executes; planning chat reviews results.

---

## Review passes the planning chat MUST run

### Pass 1: Diff-level review (parallel)

Spawn three reviewers concurrently:

1. **`/security-review`** — security-focused review of the diff
   `3b10e6a2..HEAD`. Flag any new attack surface; verify the auth
   gates added in commit `9a9bb7b6` are correctly applied.
2. **`/code-review --effort high`** — broad correctness review at
   high effort on the same diff. Especially scrutinize:
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

- **React.cache + Promise.all interaction**: commit `62e73bc4` added
  React.cache on `currentUser` / `getUserProfile` / etc; commit `b35cc8ae`
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
- **Type cast hygiene**: commit `449d020d` removed `as unknown as
  object` casts via `.$type<>()`. Grep `as unknown as` in
  `src/server/actions/` and `src/lib/db/queries/` — should be empty
  or only client-side React patterns.
- **Pivot rollout state**: the muscle-group pivot is feature-flagged
  (`FF_MUSCLE_GROUP_WORKOUT` env var). Confirm:
  (a) what the flag is set to on the current cognify-v2 Vercel env vars
  (b) whether we're flipping it ON as part of this deploy
  (c) the rollback path if we flip ON and need to roll back

### Pass 3: Migration safety + cutover plan

- Run `scripts/_audit-prechecks.mjs` after Max authorizes.
- Read the output carefully. If any FK orphan count > 0, plan how
  to clean them BEFORE applying 0026.
- If any case-variant email dupes, plan the merge BEFORE applying
  0027 (pick which row wins by `createdAt ASC`; reassign auth_user_id
  if needed; delete the loser; re-run the pre-check).
- Document each migration's rollback SQL in the plan.
- Verify the apply order: **migrations first, then `vercel deploy`** —
  the code already expects the new schema.

### Pass 4: Smoke matrix design

Produce a numbered checklist Max can click through on the deploy
at `cognify-v2-neon.vercel.app` AFTER the `vercel deploy --prod`
runs. Each item:
- One concrete action ("Sign in with Google as a new user")
- Expected result ("Land on /onboarding/vertical")
- What to check ("DevTools Network tab: no 401/403/500; Console:
  no CSP violation warnings")
- MUST PASS or NICE TO PASS

Minimum coverage (expand as the review surfaces more):
1. Sign in with Google as a fresh user → onboarding
2. Sign in with email/password
3. Sign out → reload → confirm signed-in shell NOT served (SW
   `cacheOnNavigation: false` check)
4. Continue as guest → complete a rep → score appears
5. Workout: Start → 4 reps → day complete summary
6. Dashboard load — check Network tab: parallelized fetches, no
   waterfall
7. Library load — check images all load (CSP check on `img-src`)
8. Privacy section: change retention to 30 → reload → still 30
9. `curl -X POST https://cognify-v2-neon.vercel.app/api/score`
    unauthed → 401
10. `curl https://cognify-v2-neon.vercel.app/api/score/health/stats`
    unauthed → 401
11. DevTools console on every page visit: zero CSP violations
12. Network → Headers → confirm CSP enforcing form, HSTS,
    Permissions-Policy
13. `/ops` only loads when `is_operator=true` on the user row
14. RestDayNotification fires correctly based on profile.tz +
    committedDays
15. Audio playback works on a 1-week-old rep (signed URL flow)

### Pass 5: Reverse-the-camera review

After all the above, ask: "if this deploy breaks the live site,
what's the rollback path?" Plan:
- **Vercel rollback**: in the Vercel dashboard, "Promote to
  Production" any prior `Ready` deployment to point the alias back.
  Or run `vercel rollback <prior-deploy-url> --scope maxvolkov202s-projects`.
- **DB rollback for each migration**:
  - 0025: `ALTER TABLE cognify_v2.users DROP COLUMN IF EXISTS audio_retention_days;`
  - 0026: drop each new FK + index; reverse the JSONB casts back to
    `jsonb` (data preserved in array form is castable back).
  - 0027: drop the citext type back to text (data preserved); recreate
    the original case-sensitive UNIQUE.
- **Feature flag fallback** (`FF_MUSCLE_GROUP_WORKOUT`): flip OFF in
  the Vercel env var and redeploy — pre-pivot BetaSoon placeholder
  shows; users keep their existing workflow.
- A go/no-go criterion: "if X happens in the first 30 minutes after
  deploy, we roll back." Define X concretely.

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
3. `plans/smoke-matrix.md` — the click-through matrix for the deploy.
4. `plans/rollback.md` — DB rollback + Vercel rollback playbook.
5. Updated `memory/project_pre-merge-handoff.md` reflecting the
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
4. **Time estimate** for the cutover end-to-end (migrations →
   `vercel deploy --prod` → smoke matrix → watch period).

Use ExitPlanMode when the plan is ready for sign-off.

ultrathink. Don't be brief. Production-ready over fast.
