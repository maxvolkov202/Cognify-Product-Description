# Handoff: grading build plan (paste after /clear)

```
I'm continuing the Cognify grading work. On 2026-08-26/27 we ran a read-only audit of the grading
pipeline and Max approved a single build plan. Read, in this order, before doing anything:

1. plans/grading-audit-2026-08-26.md — the whole thing: §1 findings with numbers, §2 decisions and
   evidence gates, §3 the build plan (9 workstreams, in execution order, each with files, changes,
   tests and a verify gate), §4 short-rep ruleset, §5 labeling protocol, §7 handoff pointers.
2. ~/Documents/Projects/Cognify grading docs/00-how-grading-works.md (and 01–07 as needed) — the
   live prompt stack, team-readable.
3. CLAUDE.md conventions: branch + PR + /code-review for every change; never push to main; any
   scoring-prompt change re-runs the calibration suite and is noted in the tracker; flags are
   server-resolved.

Facts not to re-derive: Pacing is a deterministic override (92 for any fluent rep); Tone fell to
the text tier for 92% of v4.1.0 reps until PR #72; Thinking Quality is a 60/40 blend that
compresses the model's range; the calibration bank is machine re-authored so its pass rate is
self-consistency, not accuracy; prod arm is signals-drop at 100%; 26% of recent reps were mock
fallbacks (validation char caps + OpenAI credits + 20 s fallback timeout); scoring_telemetry.rep_id
is NULL everywhere. Priority: accuracy > feedback quality > latency > cost. Nothing closes on one
rep; use the evidence gates in §2.

Execute §3 top to bottom, one workstream per branch, each through commit → PR → /code-review →
merge → deploy, updating plans/system-change-v2-progress.md and giving me a verify checklist after
each. Workstream 1's first commit also adds the uncommitted audit files (this plan,
plans/handoff-grading-p0-p1.md, scripts/qa/grading-audit/, the tracker entry). Workstream 2 is
DB-read-only and needs no PR; raters are me plus one other (still to be named). Record the
workstream-2 baseline in the tracker before starting workstream 3. Stop and ask me at any verify
gate that is not met, before anything destructive, and whenever the PRD conflicts with the plan.
```
