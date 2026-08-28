# Grading audit scripts (2026-08-26)

Read-only SELECTs against prod `cognify_v2` using `DATABASE_URL` from `.env.local`. Run from repo root:
`node scripts/qa/grading-audit/analyze_real.mjs`. Produced the numbers in `plans/grading-audit-2026-08-26.md`.

- `db.mjs` — connection (postgres pkg, ssl required)
- `analyze.mjs` / `analyze_real.mjs` — per-dim distributions, correlations, retry deltas, 25-rep sample (real = excludes seed/mock)
- `q1..q3.mjs` — per-user/week/model breakdowns, duplicate-transcript noise, delivery vs WPM
- `mock.mjs` / `mock2.mjs` — mock-fallback attribution and `error_detail` causes
- `arms.mjs` — telemetry by hour/arm (separates local calibration bursts from prod)
- `sample25_real.json`, `analysis_real.txt` — outputs from 2026-08-26

Filter `model_version` (exclude `seed-demo-v1`, `mock-fallback-v1`) before trusting any aggregate.
