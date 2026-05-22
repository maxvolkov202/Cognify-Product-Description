# Capacitor compatibility audit — muscle-group pivot

Phase 12 deliverable. Catalogues every new server-side endpoint shipped
by the muscle-group pivot (Phases 1-11) plus its WebView verdict so a
future Capacitor shell can be added in ~1 sprint with zero Workout-code
rewrites.

## Verdict legend

- ✅ **Capacitor-compatible** — works unchanged via HTTPS from the
  WebView. Server actions and route handlers are POST/GET over the
  network; the Capacitor shell points at the same Vercel host.
- ⚠️ **Capacitor-compatible with tweak** — works, but needs an explicit
  cache header or behavior tweak for predictable WebView caching.
- ❌ **Native-only path required** — the web API has no WebView
  equivalent; needs a Capacitor plugin.

## Server actions

| File                                                | Action                                  | Verdict | Notes                                              |
|-----------------------------------------------------|------------------------------------------|---------|----------------------------------------------------|
| `src/server/actions/workout-day.ts`                 | `suggestTodaysMuscleGroup`               | ✅      | Pure DB read.                                       |
| `src/server/actions/workout-day.ts`                 | `startMuscleGroupDay`                    | ✅      | Idempotent insert; safe over flaky network.         |
| `src/server/actions/workout-day.ts`                 | `swapMuscleGroup`                        | ✅      |                                                     |
| `src/server/actions/workout-session.ts`             | `updateWorkoutSessionState`              | ✅      | 300ms debounced; survives backgrounding.            |
| `src/server/actions/workout-session.ts`             | `getActiveWorkoutSession`                | ✅      |                                                     |
| `src/server/actions/workout-session.ts`             | `completeWorkoutSession`                 | ✅      |                                                     |
| `src/server/actions/workout-session.ts`             | `recordGraduationRep`                    | ✅      |                                                     |
| `src/server/actions/workout-session.ts`             | `tagWorkoutRep`                          | ✅      | Backfills `reps.exercise_id` + `muscle_group_day_id`. |
| `src/server/actions/workout-session.ts`             | `fetchDayRetrospective`                  | ✅      |                                                     |
| `src/server/actions/prompt-selection.ts`            | `fetchPromptCandidates`                  | ✅      |                                                     |
| `src/server/actions/prompt-selection.ts`            | `listAllPrompts`                         | ⚠️      | Cache `?dim=` results 30s — list is bounded.        |
| `src/server/actions/prompt-selection.ts`            | `logPromptSelection`                     | ✅      | Fire-and-forget.                                    |
| `src/server/actions/notifications.ts`               | `fetchPendingDayNotification`            | ✅      |                                                     |
| `src/server/actions/notifications.ts`               | `markNotificationRead`                   | ✅      |                                                     |
| `src/server/actions/skill-lab-promo.ts`             | `fetchTodayPromoState`                   | ✅      |                                                     |

## Route handlers

| Route                                       | Verdict | Notes                                                            |
|---------------------------------------------|---------|------------------------------------------------------------------|
| `/api/score` + `/api/score/stage1+stage2`   | ✅      | Same HTTPS POST as today; Phase 8 added exercise body fields.    |
| `/api/score-internal`                       | ✅      | Edge Function ping — runs on Vercel, callable from WebView.      |
| `/api/cron/muscle-group-day-rollover`       | ✅      | Vercel-cron triggered; never invoked from the client.            |

## Pages

| Page                              | Verdict | Notes                                                          |
|-----------------------------------|---------|----------------------------------------------------------------|
| `/workout`                        | ✅      | Server component; payload arrives on first paint.              |
| `/dev/mascot`                     | ⚠️      | Dev-only; ship-gate behind `NODE_ENV !== 'production'`.        |
| `/progress/muscle-groups`         | ✅      | Server-rendered; no client-only deps.                          |
| `/skill-lab` + promo + tooltip    | ✅      |                                                                |

## Platform shims (Phase 12 stubs)

| Shim                                              | Web today                                | Native TODO                                                    |
|---------------------------------------------------|-------------------------------------------|----------------------------------------------------------------|
| `src/lib/platform/mic.ts`                         | `navigator.mediaDevices.getUserMedia`     | `@capacitor/microphone` permission + `MediaRecorder` w/ stream  |
| `src/lib/platform/recording-store.ts`             | IDB via `network-buffer.idbStore`         | `@capacitor/filesystem` + JSON metadata                         |
| `src/lib/platform/haptics.ts`                     | `navigator.vibrate`                       | `@capacitor/haptics` Impact API                                 |
| `src/hooks/use-swipe.ts`                          | Pointer-events, no library                | Works unchanged                                                 |
| `src/hooks/use-idle-timeout.ts`                   | document interaction events               | Works unchanged                                                 |
| `src/components/product/workout/Mascot.tsx`       | `motion/react` + SVG                      | Works unchanged in WebView; verify frame-time on Pixel 6a.      |

## WebView caching tweaks needed

For the muscle-group pivot, the only endpoint that benefits from explicit
caching is `listAllPrompts` — it's bounded by the catalog size (≤300
rows per dim) and changes only when the seed re-runs. Suggest:

```ts
// in /api/exercise-catalog (if extracted) or via Server Action wrapper:
export const dynamic = "force-static";
export const revalidate = 1800; // 30 min
```

All other endpoints are user-scoped and must stay dynamic so the
WebView always sees the user's latest state.

## What still needs hands-on shell work (out of scope for Phase 12)

1. `npx cap add ios` + `npx cap add android` — bootstrapping the shell
   project. Needs an Apple Developer account + Android Studio.
2. App-store metadata (icons in 1024 + screenshots + descriptions).
3. Signing certificates + provisioning profiles.
4. Native push notifications (the `user_notifications` table is ready
   to power them; the delivery path is native).
5. Deep linking from notifications + universal links.

## Risk register

| Risk                                            | Mitigation                                                                  |
|-------------------------------------------------|-----------------------------------------------------------------------------|
| Mascot frame-time > 8ms on mid-tier Android     | Detect low-end devices via `navigator.hardwareConcurrency <= 4`; collapse to MascotFallback. |
| Service worker collides with App Router RSC     | When Serwist lands, allowlist only `/manifest.webmanifest`, `/icons/*`, `/api/exercise-catalog`. Never cache HTML or RSC payloads. |
| iOS Safari ignores `beforeinstallprompt`        | Accept gracefully; show install instructions in the InstallPrompt component. |
| Swipe conflicts with iOS back-swipe             | Never attach `useSwipe` handlers to elements within 24px of the viewport left edge. |
| Capacitor mic permission denied on first open   | Surface a fallback "open Settings" link via the mic shim's `MicPermissionStatus`. |

## Deferred from this phase (Phase 12.5 / post-launch)

- Playwright e2e mobile-audit harness asserting ≥44×44 tap targets across `/workout` + `/progress/muscle-groups`.
- Serwist + service worker config caching the static catalog JSON.
- Bottom-sheet variant of PromptPicker via vaul (or a custom Drawer) on ≤768px.
- Real app icons (currently placeholder paths in manifest.webmanifest).
- Moto-G7 Lighthouse perf-budget gate in CI.
- MediaSession metadata for lock-screen "Workout in progress" display.
