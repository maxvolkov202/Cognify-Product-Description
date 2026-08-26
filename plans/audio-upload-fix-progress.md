# Audio upload fix + follow-ups — build tracker

Branch: `fix/audio-upload-mime` · started 2026-08-26 · base `main` @ `ac73ff6f`

Scope: one real production bug (rep audio has not been stored since ~2026-07-24), one latent
hardening item bundled with it, and two documentation corrections. **No scoring prompt or model is
touched by any task in this batch, so the CLAUDE.md calibration guardrail does not apply and the
calibration suite is deliberately NOT re-run.**

---

## Status

| Phase | Task | State |
|---|---|---|
| A | `/api/upload` rejects the browser's parameterized MIME type | code done, prod verify pending |
| B | `useHasAudioControl` reports provider presence, not audio presence | code done |
| C | Tracker correction — stale "Daily Workout was NOT re-run" note in the PR #70 entry | done |
| D | Test accounts hidden from leaderboards / social (Max's ask) | verified — already covered |
| — | Open question back to Max: the `/onboarding/done` baseline-redo copy | awaiting Max |

---

## Phase A — `/api/upload` rejects `audio/webm;codecs=opus`

### The bug

Reproduced twice on production through the real UI:

```
POST /api/upload → 500
{"error":"upload_failed","message":"Supabase Storage upload failed:
 mime type audio/webm;codecs=opus is not supported"}
```

The `rep-audio` Supabase Storage bucket's `allowed_mime_types` is
`[audio/webm, audio/ogg, audio/mp4, audio/mpeg, audio/wav]`. `MediaRecorder` in Chrome/Edge reports
`audio/webm;codecs=opus`, Safari reports `audio/mp4`. Supabase matches the **full** `contentType`
string exactly, so the parameterized form never matches the allowlist and Storage rejects the write.

Path: `src/app/api/upload/route.ts:58` reads `file.type` into `mime`, passes it unmodified to
`uploadAudio` (`src/lib/audio/upload.ts:15`), which hands it to Storage as `contentType`.

### Impact — CORRECTED against the live DB and Storage

The briefing for this batch said `reps.audio_url` "has been NULL for EVERY rep since ~2026-07-24
(last reps with audio: 5 on 2026-07-23)". **That framing is wrong, and the correction matters** —
the bug is older and narrower than a July regression.

What the data actually shows (queried 2026-08-26 against the prod DB and the Storage bucket):

- **Every rep that has ever stored audio is `.mp4` — 36 of them, spanning 2026-04-22 to
  2026-08-26.** Listing the bucket directly agrees: every object under `reps/` is `.mp4`, and not a
  single `.webm` object has ever existed.
- Audio is **not** currently broken for everyone. Three reps stored audio on 2026-08-26 (00:25–00:30
  UTC, `aidan.a.holt@apogemcapital.com`).

So there was no regression on 2026-07-24. `PREFERRED_MIME_TYPES` in `src/lib/audio/capture.ts:28`
tries `audio/webm;codecs=opus` first, then `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`:

- **Chrome / Edge** support the first entry, so they send the parameterized
  `audio/webm;codecs=opus` — rejected by Storage. Broken **since the feature shipped**, not since
  July.
- **Safari** supports none of the webm/ogg entries and falls through to `audio/mp4`, which is
  **bare** — no parameter — so it matches the bucket allowlist and uploads fine. That is why 100% of
  stored audio is mp4.

The apparent "outage starting 2026-07-24" is a change in which browser was being used for testing,
not a change in the code. The real defect is: **rep audio has never worked on Chrome or Edge.** That
is a larger user-facing bug than the brief described, and it is what this fix closes.

Unchanged from the brief: it hides well because in-session playback uses a **local blob URL**, so
recording, grading, "Listen back" and the v4.1.0 "Hear it at m:ss" seek button all work while you
are still in the session. What is dead is listening back to a **past** rep. Upload failure is
best-effort, so reps still save and grade correctly — playback-only.

**Existing Chrome/Edge reps' audio is unrecoverable.** It was never written to Storage; there is
nothing to backfill from. The fix makes new reps store audio; it does not revive old ones.

### Root cause proven against production Storage

Not inferred — probed directly (temporary object, deleted afterwards, bucket re-listed to confirm):

| Content-Type sent | Storage response |
|---|---|
| `audio/webm;codecs=opus` | `415 InvalidMimeType` — *"mime type audio/webm;codecs=opus is not supported"* (Max's exact error) |
| `audio/webm` | `200 OK`, object created |

The bucket's live `allowed_mime_types` was also read back and matches `ALLOWED_AUDIO_MIME_TYPES`
exactly, so the new 415 gate cannot reject anything Storage would have accepted.

### Decision A1 — normalize the MIME, do not widen the bucket allowlist

Strip MIME parameters before use: `audio/webm;codecs=opus` → `audio/webm`. Rejected the alternative
(adding every parameterized variant to the bucket's `allowed_mime_types`) because the parameter set
is open-ended — codec strings vary by browser and version, so an enumeration is a treadmill that
silently breaks again on the next browser that adds a parameter. Normalizing at the boundary is
closed-form and also covers Safari's `audio/mp4;codecs=...`.

### Decision A2 — normalize in a pure module, not inline in the route

Per the repo convention that pure logic lives in `src/lib/` and is unit-tested, the normalization
and the extension derivation move to `src/lib/audio/mime.ts` with a unit test. The route stays thin.
This also lets the extension derivation be tested rather than assumed.

### Decision A3 — validate against the bucket allowlist in the route

The `mime.startsWith("audio/")` guard admits types the bucket will reject (`audio/aac`,
`audio/flac`, ...), which surfaces as a 500 from the catch-all rather than a useful status. The
normalized type is now checked against the same five types the bucket allows and returns 415 with a
clear message when unsupported. This converts a confusing 500 into an accurate client error and,
critically, would have made the original bug obvious the first time it happened.

### Verify checklist — Phase A

- [ ] `npm run test` green (new `tests/audio-mime.test.ts` included in the `test` script)
- [ ] `npm run lint` green
- [ ] `npm run typecheck` green
- [ ] `/code-review` run on the PR, findings addressed
- [ ] **Prod:** a NEW rep recorded through the real UI writes a non-null `reps.audio_url`
- [ ] **Prod:** that stored audio plays back on a PAST rep (the point of the fix), not just
      in-session

---

## Phase B — `useHasAudioControl` tests the wrong thing

`src/components/product/feedback/AudioControlContext.tsx:49` — `useHasAudioControl()` returns
`useContext(...) != null`, i.e. whether the **provider** is mounted, not whether audio exists.
`FeedbackPanel.tsx:184` mounts `AudioControlProvider` unconditionally, while the `<audio>` element
only renders when `audioUrl` is present (`FeedbackPanel.tsx:274`). `GroundedMomentDetail` in
`DimensionCard.tsx:192` gates the "Hear it at m:ss" button on `moment.quoteAtMs != null && canSeek`.
So if `FeedbackPanel` ever mounts without `audioUrl`, it renders a visible seek button whose
`seekToMs` hits `if (!a) return` — a dead button.

**For `GroundedMomentDetail` specifically: not reproduced.** In-session always has the local blob
URL, so that consumer's dead-button path stays theoretical. Hardening, not a live defect.

### But the sibling consumer IS live — `CalloutDetail`

Found while implementing this. `CalloutDetail` (`DimensionCard.tsx:204`) has the **same** gap and
never applied the guard at all: it gated its "Jump to m:ss" button on `hasTimestamp` alone, with no
`canSeek` check. And `ImprovementReview.tsx:363` mounts `DimensionGrid` with real
`retry.score.callouts` and **no `AudioControlProvider`** — so `useAudioControl()` falls back to the
no-op `seekToMs`, and every callout carrying a `transcriptStart` rendered a **visibly dead button in
production** on the Improvement Review screen.

This is precisely the case the context's own comment names ("the Improvement Review's grid has its
own scrubbers, no provider"). The guard existed; this consumer just never used it. Fixed here
alongside B1 — fixing one consumer and not the other would leave the abstraction half-applied.

So Task 2 is **not purely latent** after all: the item as described is latent, but the defect class
has a live instance one function away. Called out plainly rather than filed as hardening.

The context's own comment states the intent — the flag exists to "HIDE seek affordances instead of
rendering a silently dead button". The implementation just infers audio presence from provider
presence, which is only accidentally correct.

### Decision B1 — thread real audio availability through the context value

Add `hasAudio: boolean` to the `AudioControl` value and have `useHasAudioControl()` read it, instead
of inferring from provider presence. `FeedbackPanel` passes `Boolean(audioUrl)` — the same condition
that gates the `<audio>` element, so the flag and the element cannot disagree. The no-provider
fallback keeps returning `false`, so the Improvement Review grid is unaffected.

### Verify checklist — Phase B

- [ ] Seek button still renders in a normal in-session feedback panel (audio present)
- [ ] Seek button is hidden when `FeedbackPanel` is given no `audioUrl`
- [ ] Improvement Review grid unchanged (no provider → `false`, as before)

---

## Phase C — tracker correction (documentation debt)

`plans/system-change-v2-progress.md`, PR #70 entry, currently reads:

> "Daily Workout was NOT re-run: both test accounts were already consumed for 2026-08-25 EDT"

That is stale. Later on 2026-08-25 a fresh production account closed the gap. Correcting the entry so
the tracker is not stale on its own record of the ship.

### Verify checklist — Phase C

- [ ] PR #70 entry no longer claims Daily Workout was skipped
- [ ] The replacement records what actually passed, with the numbers

---

## Phase D — test accounts hidden from leaderboards and social

Max's ask when approving keeping the two prod test accounts: they must not be visible on
leaderboards, social surfaces, etc.

**Audited — already covered, no code change needed.** Reporting this rather than inventing work:

| Surface | Status |
|---|---|
| Leaderboard, all three scopes (`global` / `this_week` / `team`) | Excluded — `excludeInternalAccounts()` at `src/lib/db/queries/leaderboard.ts:89`, applied in the base aggregation (`:325`), so it also covers the self row, `topStreak` and `biggestClimb`, which all read that same aggregate |
| Leagues / `LeagueBoard` | Excluded — same `NOT ILIKE '%@cognify.test'` predicate at `src/lib/db/queries/leagues.ts:177` |
| Friends / activity feed | Not exposed — both are scoped to the user plus **accepted** friendships; there is no global user directory or search anywhere in the codebase (grepped for `searchUsers` / `ilike` across `src/lib/db/queries/` and `src/server/`), so a test account can only appear to someone who deliberately friends it |
| Weekly challenges | Per-user only; the one `from(users)` read (`weekly-challenges.ts:83`) resolves the current user's own committed-day count |

Both accounts are on the `@cognify.test` domain, so the existing predicate matches them.

**One item left deliberately unchanged:** `src/lib/db/queries/ops.ts` counts test accounts in its
internal metrics. That is an operator-only surface — `/admin` is gated on `profile.isOperator`
(`src/app/admin/layout.tsx:14`) — so it is not "leaderboards and social". Flagging it rather than
changing it: if Max wants prod *metrics* to exclude harness accounts too, that is a separate call.

---

## Open question back to Max

`/onboarding/done` carries **two** Settings sentences:

- `page.tsx:52` — *"You can change your selections later under Settings."* This is **accurate**;
  Settings does let you edit vertical, committed days, etc.
- `page.tsx:32` — *"60 seconds, one prompt. You can redo **it** from Settings if you need to."* This
  sits inside the paragraph whose subject is the baseline rep, so "it" reads as the baseline — and
  that promise is **unbacked**: `src/app/onboarding/baseline/page.tsx:22` redirects to `/tutorial`
  as soon as `profile.baselineRepId` is set, and Settings has no redo control.

The vertical/days promise is already covered by line 52. Line 32 is the unsupported one. Awaiting
Max's call: fix the copy, or build the Settings control (bigger — needs a decision on what happens
to the old baseline rep and to the progress deltas anchored on it).

---

## Decision log

| id | decision |
|---|---|
| A1 | Normalize the MIME at the boundary rather than widening the bucket allowlist — parameter sets are open-ended, an enumeration is a treadmill. |
| A2 | Pure normalization + extension derivation into `src/lib/audio/mime.ts`, unit-tested; route stays thin. |
| A3 | Validate the normalized type against the bucket's allowlist in the route → accurate 415 instead of a catch-all 500. |
| B1 | Thread real audio availability (`hasAudio`) through the context value instead of inferring it from provider presence. |
| — | No calibration re-run: no task in this batch touches a scoring prompt or model. |
