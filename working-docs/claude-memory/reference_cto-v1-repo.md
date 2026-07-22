---
name: CTO V1 Repo Reference
description: Location and key files of the CTO's v1 Cognify repo (cloned locally for reference during merge)
type: reference
originSessionId: 9b154b74-1399-441e-8545-629bc87b1277
---
- GitHub: `https://github.com/bobsides-AICodebase/Cognify-Product-Description.git`
- Local clone: `C:\Users\MaxVolkov\dev\cognify-v1-cto`
- Key files to reference during migration:
  - `supabase/functions/score-rep/index.ts` — async processing pattern, status state machine, optimistic locking
  - `src/app/v2/components/tryitout/ResultsScreen.tsx:122-155` — Postgres realtime subscription pattern
  - `src/app/v2/hooks/useAudioRecorder.ts:43-59` — mic pre-warming pattern
  - `src/app/types/framework.ts:47-91` — FRAMEWORK_SCORING_PROFILES (per-framework weight adjustments)
  - `docs/GRADING_SYSTEM.md` — conservative scoring philosophy
  - `docs/REP_LIFECYCLE_TECHNICAL_REPORT.md` — excellent data flow documentation
- Supabase project URL: `https://dunnoccrvrqzsgxsfjuv.supabase.co`
