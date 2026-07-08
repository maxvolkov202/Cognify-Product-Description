# Smoke matrix — post-deploy verification

Run on `https://cognify-v2-neon.vercel.app/` after `vercel deploy --prod` (Phase D2 of `plans/cutover-checklist.md`).

**Pass criterion:** all 17 MUST items green. Any MUST red → halt and execute `plans/rollback.md`.

---

## Headers + shell

- [ ] **1. (MUST)** Load `/` with DevTools Console + Network open.
  - Expected: HTTP 200, page renders, zero CSP violations in console, zero JS errors.
- [ ] **2. (MUST)** Inspect `/` response headers (Network → `/` → Headers).
  - Expected: `Content-Security-Policy` (enforcing form, contains `https:` in `img-src`); `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`; `Permissions-Policy: microphone=(self), camera=(), …`; `X-Frame-Options: DENY`; `Referrer-Policy: strict-origin-when-cross-origin`; `X-Content-Type-Options: nosniff`.

---

## Auth flows

- [ ] **3. (MUST)** Sign in with Google (fresh user, incognito window).
  - Expected: land on `/onboarding/vertical` (or `/onboarding/welcome` for first-touch). No 401/403/500 in network tab. OAuth avatar renders in nav after completing onboarding.
- [ ] **4. (MUST)** Sign in with email/password as an existing user.
  - Expected: land on `/dashboard`. Dashboard shows streak / reps / activity / trends / league sections. Network tab: 9 dashboard queries fire in parallel (not waterfall); layout's `Promise.all` for `getUserProfile` + `getCurrentSkillScores` deduped via React.cache.
- [ ] **5. (MUST)** Sign out → reload the page.
  - Expected: marketing/landing page renders; the signed-in shell does NOT flash. Confirms `cacheOnNavigation: false` is working.

---

## Workout golden path

- [ ] **6. (MUST)** Continue as guest → complete 1 rep → wait for score.
  - Expected: score returns; UI shows composite + per-dim breakdown. Network: `/api/score` returns 200; CSP allows any in-flight image fetches.
- [ ] **7. (MUST)** Sign in → `/workout` → Start → record 4 reps → day-complete summary.
  - Expected: day completes; retrospective renders. If user's first day: copy says `"First {Dim} day. Set the baseline."` Otherwise: delta vs prior day shown.
  - DB check (optional): `muscle_group_days.status = 'complete'`, `completed_reps = 4`.

---

## CSP-sensitive surfaces (Patch 1 validation)

- [ ] **8. (MUST)** Library page (`/library`).
  - Expected: YouTube thumbnails LOAD (not broken images). External OG images LOAD. No CSP `img-src` violations in console.
- [ ] **9. (MUST)** UserMenu (top-right nav) for a Google-signed-in user.
  - Expected: OAuth avatar renders. No CSP `img-src` violation for the Google avatar URL.

---

## Privacy settings (Patch 4 validation)

- [ ] **10. (MUST)** Settings → Privacy → Audio retention dropdown → select "30 days" → reload page.
  - Expected: setting persists. Reload shows "30 days" still selected. Server action `setAudioRetentionAction` succeeded.
- [ ] **11. (MUST)** Same dropdown → select "Keep forever" (NULL) → reload.
  - Expected: setting persists as null. Future audio-retention cron will skip this user's reps.

---

## Auth gate verification (curl)

- [ ] **12. (MUST)** `curl -X POST https://cognify-v2-neon.vercel.app/api/score -H "Content-Type: application/json" -d '{}'`
  - Expected: HTTP 401.
- [ ] **13. (MUST)** `curl https://cognify-v2-neon.vercel.app/api/score/health/stats`
  - Expected: HTTP 401 (operator-only).
- [ ] **14. (MUST)** `curl "https://cognify-v2-neon.vercel.app/api/cron/audio-retention?dryRun=1"` (no Authorization header).
  - Expected: HTTP 401.

---

## Cron dry-run (Patch 2 validation)

- [ ] **15. (MUST)** `curl -H "Authorization: Bearer $CRON_SECRET" "https://cognify-v2-neon.vercel.app/api/cron/audio-retention?dryRun=1"`
  - Expected: HTTP 200, body `{ "dryRun": true, "expired": 0, "sample": [] }`. Pre-checks confirmed 0 reps >180 days old.

---

## Calibration ops (Patch 3 validation)

- [ ] **16. (NICE)** `/ops/calibration` page (must be operator, i.e. `is_operator = true`).
  - If the cron has run since deploy: rows show mixed `ok` / `drift` / `fallback` status, NOT all-error.
  - If the cron hasn't run yet: manually trigger via `curl -H "Authorization: Bearer $CRON_SECRET" https://cognify-v2-neon.vercel.app/api/cron/calibration-drift` and re-check.

---

## Operator surface

- [ ] **17. (MUST)** `/ops` overview.
  - Expected: loads ONLY when `is_operator = true` on the user row. Logged-out users get 401 or redirect.

---

## Cross-cutting sanity

- [ ] **18. (MUST)** DevTools console during full session of #4 (dashboard) + #7 (workout day completion).
  - Expected: zero CSP violations, zero unhandled-promise rejections, zero React key warnings.

---

## Nice-to-pass observations

- [ ] **19. (NICE)** Audio playback on a rep recorded ≥1 week ago.
  - Expected: signed URL flow works; audio plays via `<audio>` element. Confirms `media-src` allows `*.supabase.co`.
- [ ] **20. (NICE)** Rest day trigger — sign in as a user whose `committedDays` mask excludes today.
  - Expected: `RestDayNotification` renders; +50% XP bonus mentioned. TZ keyed correctly (audit B-5).
- [ ] **21. (NICE)** Theme toggle: light → dark → system.
  - Expected: all 3 modes render legibly; choice persists in localStorage. Dark-mode coverage (audit UX-5) confirmed.
- [ ] **22. (NICE)** Mobile viewport simulation (375 × 667).
  - Expected: workout shell, library, dashboard all responsive; no horizontal scroll on 375px.

---

## Halt criteria

If ANY MUST-PASS fails, do NOT continue clicking — go to `plans/rollback.md` and execute the appropriate path.
