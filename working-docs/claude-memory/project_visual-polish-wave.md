---
name: visual-polish-wave
description: "2026-07-08 platform review + visual wave on feat/workout-prompt-audit — what shipped, what the ranked visual roadmap still holds"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7779856e-6267-48cd-bb16-628f0e3efe85
---

2026-07-08 session on `feat/workout-prompt-audit` (see tracker session log for full detail): closed out the interrupted prompt reseed (dev DB now 6,714 active doc-aligned prompts; 31,731 stale rows deactivated — **RESOLVED 2026-07-15: dev and prod share one Supabase DB (postgres.dunnoccrvrqzsgxsfjuv), so the reseed+prune already covered prod**), fixed ~18 confirmed review findings (tagWorkoutRep uuid[] self-heal, /signup 404 CTAs, light-mode dim-gradient contrast, dark mode on progress/leaderboard, fake longest-streak, UTC today-ring), and shipped a 3-agent visual wave (ImprovementReview animated reveal, brand-gradient CTA unification, RankBadge rebuild, PrepHome theming, nav active states).

**Ranked visual roadmap still open** (from the 3-auditor pass; details in final report + tracker):
1. Communication Score hero ring + dashboard zoning (13-card stack → labeled zones)
2. Dim-color unification — promote `src/lib/workout/dim-theme.ts` to the app-wide single source (3 competing palettes: SixSkillsBar, DIMENSION_ACCENTS, DIM_THEMES)
3. slate-* → ink-* sweep in the workout shell (two gray systems side by side)
4. Wire orphaned PersonalBestToast + LevelUpCelebration (built, zero importers)
5. Landing social proof section; ProgressChartMock real time-axis chart
6. Onboarding: unify selection states on the days-page gradient pattern, animate done page, 6-step progress truth
7. Delete LoginDialog (duplicate auth UI), restyle signin in surface-card
8. Mobile bottom tab bar (Home/Workout/Lab/Progress) replacing hidden hamburger nav

**Why:** Max asked for "more visually appealing, ultimately a better platform" — this is the standing priority list.
**How to apply:** Pick from the top; items 1-3 are the biggest perceived-quality jumps. Relates to [[prd-v3-rebuild]] and [[muscle-group-pivot]].
