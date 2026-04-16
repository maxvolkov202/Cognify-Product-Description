# Cognify v2 — First-Time User Sweep

Full product walkthrough treating the app as a cold visitor / new user would experience it. Organized by journey. Captured 2026-04-16 post-Vercel-deploy from live URL `https://cognify-v2-neon.vercel.app` + codebase.

## Top 10 before showing Bob

Priority-ordered. The first 3 are the difference between "works" and "lands."

1. **[CRITICAL] /try (Quick Rep) shows scores but no transcript + callouts.** Users get 6 numbers and no explanation. Defeats the product's core promise ("transcript-anchored feedback"). Fix: show top weakness with a quote.
2. **[CRITICAL] Pause workout is invisible.** Code has localStorage-backed pause/resume but no button in the UI. Users can't step away. Add a `⏸ Pause` button on the rep screen.
3. **[HIGH] No timer bar while speaking.** Users don't know if they're at 20s or 60s. Add a bottom progress bar (green → yellow → orange as time depletes).
4. **[HIGH] Settings is incomplete.** Missing: change email, reset password, delete account, export data. These are table-stakes for SaaS. Verify `SettingsClient` has them; add if missing.
5. **[HIGH] Build a Rep doesn't preview talking points before rep starts.** Show the generated structure as a preview card with Regenerate/Edit/Practice buttons.
6. **[MEDIUM] Friends + Leaderboard mock data is still confusing.** The "Preview · demo data" badge is too subtle. Use a full-width banner at the top of these pages.
7. **[MEDIUM] Challenge buttons hidden on mobile.** `hidden md:flex` on Swords icon in Friends page. Mobile users want to invite friends too.
8. **[MEDIUM] Validation results flow unclear.** After creating a validation, users don't know what link they got, what the listener sees, or where to check results.
9. **[MEDIUM] Data export missing from Settings.** Add a CSV export of reps + JSON export of callouts. Useful for coaching relationships.
10. **[LOW] Onboarding doesn't emphasize baselines.** Add a sentence before the baseline rep: "Your baseline sets the anchor. Every future rep gets measured against it."

---

## Journey 1 — Landing page

**👍 Works**
- Hero copy is clear ("The Duolingo for communication"), CTAs are distinct.
- Nav is clean and sticky.

**😕 Confusing**
- "Thinking structure" is used repeatedly but never explained until `/product` (3 screens down).
- StatsBar numbers lack context (is "15,000+ reps" a lot? Per month?).

**🔴 Missing**
- No inline video/gif showing what a rep actually looks like. Cold visitors have to click `/try` to understand the core loop.

**💡 Suggestion** — Add a 20-second autoplayed silent loop showing prompt → recording → feedback. This answers the #1 cold-visitor question: "what am I actually doing?"

---

## Journey 2 — Quick Rep (`/try`)

**👍 Works**
- No-signup framing earns trust.
- 6-dimension score grid is satisfying.

**😕 Confusing**
- "Every word has to earn its place" is vague — penalized for silence? Repetition?
- Unclear if "See full breakdown" requires signup.

**🔴 Missing**
- **No transcript or callouts shown.** This is the whole product value prop — the user does a rep, sees numbers, and never knows *what they said*. Huge miss.

**💡 Suggestion** — Show one positive callout + one critical callout with transcript quotes + timestamps. This closes the feedback loop and makes the value tangible.

---

## Journey 3 — Onboarding (`/onboarding/*`)

**👍 Works**
- Progress bar visible (Step 1 of 4).
- Questions are brief, concrete options.
- Skip on personas is good.

**😕 Confusing**
- As a "Business Analyst," which vertical do I pick? No "Other" guidance.
- Personas page doesn't explain *what changes* if I pick "Your CEO" vs "Customers."
- Goals page is opaque on what effect each choice has.

**🔴 Missing**
- No back/edit after selection.
- Baseline rep is never framed as *the* anchor metric before you do it.

**💡 Suggestion** — After Goals, before Baseline: show a summary card. "You're a Sales leader talking to VPs. We'll weight your workouts toward Pitches and Tough Feedback. Your next rep becomes your baseline — every future rep gets measured against it."

---

## Journey 4 — Daily Workout (`/workout`)

**👍 Works**
- Countdown creates focus.
- 4 × ~10 min is a concrete promise.
- Auto-picks next rep based on weakest dimension (invisible + smart).
- Retry overlay is useful.

**😕 Confusing**
- Unclear if "Go" is the countdown ending or an explicit prompt.
- "Framework cheat-sheet" mentioned in copy but not visible in RepSurface.

**🔴 Missing**
- **No timer visible while speaking.** Essential for pacing. Users can't tell if they're at 20s or 60s.
- Pause is in code but there's no button.
- Yesterday's composite comparison may exist but isn't prominent on the end screen.

**💡 Suggestion** — Bottom timer bar + visible "⏸ Pause" button. Low risk, high impact.

---

## Journey 5 — Build a Rep (`/build-a-rep`)

**👍 Works**
- Two intake modes (quick / custom) is smart.
- Custom scenario builder covers situation, stakeholder, outcome, constraints.

**😕 Confusing**
- Only 5 prompts per vertical — what if none match? Custom path is unclear.
- Talking points invisible until rep starts. Users commit without knowing what they're getting.
- Unclear if "Regenerate" has cost / limits.

**🔴 Missing**
- Bridge between picking scenario and starting rep. The generated structure should be previewable.
- No guidance on when to use Build a Rep vs Daily Workout for first-timers.

**💡 Suggestion** — After generation, show: "3-section structure, 8 bullet points. Regenerate · Edit · Practice." Makes the invisible magic tangible.

---

## Journey 6 — Progress (`/progress`)

**👍 Works**
- Stat card grid is clean.
- Empty state is honest.

**😕 Confusing**
- Line chart noise: is a 7-point composite jump good? Over what timeframe?
- Radar chart has no legend — what's a "good shape"?
- Activity heatmap: color intensity = rep count or avg score?

**🔴 Missing**
- No "Export" button for CSV/PDF.
- Improvements aren't celebrated — a +6 pacing jump over 30 days shows on the chart but there's no narrative.
- No bridge to `/validate` when a user has enough reps to benefit.

**💡 Suggestion** — Add a "You improved X by Y since baseline" banner when any dimension crosses +5. Link to /validate when user has 2+ reps on the same prompt.

---

## Journey 7 — Friends + Leaderboard

**👍 Works**
- Leaderboard podium layout is fun.
- Medals + rank styling lands.

**😕 Confusing**
- Friends page says "Bring a real teammate in" then shows 6 fake friends. Badge says "Preview" but the contradictory copy makes users unsure if it's real.
- Leaderboard "demo data" badge is easily missed.
- What does "winning a challenge" mean — same prompt? Higher composite?

**🔴 Missing**
- Challenge button hidden on mobile (`hidden md:flex`). Backwards.
- Invite friend UX not clear (email? link? form?).
- No comments or messaging on challenges — purely one-directional.

**💡 Suggestion** — Replace tiny "Preview" badge with a full-width banner at top: "🔒 Demo mode — invite a real friend to activate this page." Unmissable.

---

## Journey 8 — Settings (`/settings`)

**👍 Works**
- "Each section saves independently" is reassuring.
- Incomplete-onboarding banner is helpful.

**😕 Confusing**
- Unclear from code what sections are actually there (SettingsClient not inspected).

**🔴 Missing (table-stakes gaps)**
- **No password reset.**
- **No email change.**
- **No data export.**
- **No account deletion.**
- **No notification preferences** — users don't know what emails they'll get or how to stop them.

**💡 Suggestion** — Add an "Account" section (email, password, delete) and a "Data" section (export CSV/JSON). These are non-negotiable for a modern SaaS.

---

## Journey 9 — Validation (`/validate/new`)

**👍 Works**
- Compelling concept — blind-ranking is a differentiator.
- Correctly requires 2+ reps on the same prompt.
- Empty state is instructive.

**😕 Confusing**
- Shareable link preview not shown — what will the listener see? Does it show your name?
- Topic selector UX unclear (dropdown vs cards).

**🔴 Missing**
- No preview of what the listener gets.
- Results flow unclear — where do rankings show up? Email notification?
- No "why this matters beyond the ranking number" explanation.

**💡 Suggestion** — After creating a link, show a preview card: "Your listener sees 3 unlabeled reps in random order. They rank 1st/2nd/3rd. No scores, no AI — pure human feedback. Copy link: [button]."

---

## Journey 10 — Marketing pages

**👍 Works**
- `/product` has clear two-mode explanation + 9 rep types grid.
- `/pricing` is legible (free = 3 reps/day, Pro = unlimited).
- `/help` FAQs are well-organized.

**😕 Confusing**
- `/pricing` says "Start Pro trial" but no trial length stated. 7 days? 14?
- `/for-teams` B2B "Book a pilot" — no price floor shown.

**🔴 Missing / broken**
- `/help` line 30 typo: "Sign in, run a Daily Workout" — cold visitors haven't signed in yet. Should be "Create an account and run a Daily Workout."
- No `/how-it-works` inspected; verify it explains methodology differently from `/product`.
- No `/about` team bios shown.

**💡 Suggestion** — On `/pricing`: "$12/mo or $99/yr. 14-day free trial — no card required." On B2B: "From $[X]/seat. Let's talk." Giving a floor builds trust.

---

## Cross-cutting observations

**Jargon creep** — "Rep type," "Dimension," "Callout," "Composite score," "Structural adherence" are never defined on the marketing site. Add a mini-glossary card.

**Mobile UX gaps** — Several features hidden with `hidden md:flex` — challenge button on Friends being the most egregious (mobile users are the ones who'd invite friends).

**Tone consistency** — Casual + encouraging tone ("Hey {firstName}. Time to train.") is good and consistent. Keep it.

**Missing retention hooks** — No daily digest email, no weekly insight email, no "share your progress" CTA. Users have to remember to come back.

**Product sprawl** — V2 has: 2 modes × 9 rep types × 6 dimensions + Validation + Friends + Leaderboard + Challenges + Progress + Settings + Admin. For a v2 launch, this is a lot. Consider hiding Friends/Leaderboard/Challenges behind "Coming soon" until the core loop is hardened.

---

## Honest assessment

**What's strong:**
- Core rep loop (prompt → record → feedback) is fast and compelling.
- 6-dimension rubric feels research-grounded, not hand-wavy.
- Transcript-anchored callouts (when shown) are genuinely unique.
- Voice and tone are consistent and likeable.

**What's rough:**
- Core value prop is invisible until you do a rep. Cold visitors shouldn't have to click into `/try` to understand.
- Dense surface area — too many features for v2, not all finished.
- Mobile incomplete.
- Settings / account flows are stubby.

**What would unlock growth:**
- "Share your rep" — send a rep with feedback to a coach/friend/manager.
- Weekly insight email — rebuild habit.
- Comparison mode — "Rep 1 vs Rep 2: Clarity 72→78, here's what changed."

**Recommendation for Bob demo:**
1. Ship with Daily Workout + Build a Rep only.
2. Gate Friends/Leaderboard/Challenges behind a "Coming soon" badge.
3. Fix the top 5 from the priority list.
4. Add the transcript + callout preview to `/try`.
5. Add a timer bar and visible pause to workouts.

Core is unshakeable; sprawl is the enemy.
