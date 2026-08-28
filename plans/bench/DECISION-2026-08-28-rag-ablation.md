# Grading plan WS7 — RAG on/off ablation (2026-08-28)

Calibration bank (48 reps: 29 band + 19 independence), `calibrate-scoring.mjs --json`, N runs per condition on the same
local server pair (RAG on :3333 / RAG off :3334, `FF_RAG_RETRIEVE=false`). MAE is against the bank's expected scores
(band reps only; see audit §1.8 on what the bank measures). Human-set comparison pending the labeled sheets.

| condition | runs | calls | failed | pass rate | comp MAE | clarity | structure | concise | thinking | delivery | tone | spread mean/max | lat p50 | lat p90 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--|--:|--:|
| RAG on | 3 | 144 | 0 | 49% | 7.0 | 6.6 | 10.9 | 6.4 | 13.2 | 7.9 | 8.2 | 1.6 / 12 | 21133 ms | 25111 ms |
| RAG off | 3 | 144 | 0 | 51% | 7.0 | 6.6 | 10.6 | 5.5 | 12.4 | 8.1 | 8.6 | 1.8 / 13 | 21356 ms | 24288 ms |

Composite MAE delta (on − off): 0.06; latency p50 delta: -223 ms.

**Read:** no accuracy difference beyond the bank's noise; per the audit (§1.10) and plan §3.7, RAG off for scoring (`FF_RAG_RETRIEVE=false`); the corpus stays for prompt generation.
