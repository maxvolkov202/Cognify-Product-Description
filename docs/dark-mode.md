# Dark mode

Light/dark/system theme toggle for app surfaces. Marketing routes stay light by design.

## Pieces

- **`src/components/theme/ThemeProvider.tsx`** — context provider. Reads `cognify:theme` from localStorage on mount and applies the `.dark` class to `<html>`. Watches `prefers-color-scheme` when preference is "system".
- **`src/components/theme/ThemeToggle.tsx`** — the `<section>` UI used on `/settings`. Light / Dark / System pills.
- **`src/app/layout.tsx` `THEME_SCRIPT`** — inline IIFE that runs *before* React paints, so authenticated users with `theme=dark` don't see a light-mode flash on first paint.
- **`src/app/(app)/layout.tsx`** — mounts `<ThemeProvider>` around the whole app tree.

## How to add a new app route

`src/app/layout.tsx` carries a hardcoded list of route prefixes that participate in dark mode. **Any new app route must be added to that list** or it will flash light on hard navigation for users who picked dark.

```ts
// src/app/layout.tsx, line ~101
var appPrefixes = [
  '/dashboard', '/workout', '/skill-lab', '/build-a-rep', '/library',
  '/progress', '/leaderboard', '/friends', '/settings', '/achievements',
  '/onboarding', '/compare', '/tutorial', '/admin', '/dev', '/ops',
  '/report', '/scenario', '/validate',
];
```

Routes NOT in this list (e.g. the marketing homepage `/`) are forced to light. The pre-hydration script removes the `.dark` class on those paths even if the user has `theme=dark` stored.

## Tailwind contract

Use `dark:` variants on every surface, color, and border touched by app routes:

```tsx
className="bg-white dark:bg-ink-900 text-ink-900 dark:text-white border-ink-200 dark:border-ink-700"
```

The palette lives at `docs/dark-palette.md`. The brand gradients (`brand-gradient`, `brand-blue/magenta/purple`) work on both themes without modification — they're saturated enough on dark and light. Only neutral grays need `dark:` swaps.

## Persistence + no-flash

- Storage key: `cognify:theme` (string: `"light"`, `"dark"`, `"system"`).
- Default: `"light"` (also the no-flash script default on first visit).
- Pre-hydration script reads localStorage *synchronously* before React mounts and writes the `.dark` class directly so the FIRST paint matches the user's preference.
- `ThemeProvider` then syncs React state with the already-applied class on mount.

## Why the path whitelist exists

The marketing site, public sign-in, OG image route, etc. were designed light-only — they don't have `dark:` variants on every element and would render with broken contrast in dark mode. Rather than auditing every public surface, the whitelist confines dark mode to surfaces that have been audited.

When a public route grows enough dark coverage to participate, add its prefix to `appPrefixes` and verify visually.
