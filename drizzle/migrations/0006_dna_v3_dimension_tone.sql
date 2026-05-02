-- 0006_dna_v3_dimension_tone.sql
-- DNA reconciliation (2026-05-01) — Adaptability is renamed to Tone in
-- the v3 rubric. Postgres cannot remove enum values with existing rows
-- referencing them, so the migration is purely additive: add 'tone' to
-- the dimension enum if not already present.
--
-- The 'tone' value already existed in the enum from v1 (see migration
-- 0001) and was repurposed there as a legacy name for adaptability via
-- src/lib/scoring/dimension-aliases.ts. As of v3, 'tone' is once again
-- the canonical name; 'adaptability' is now the legacy alias.
-- This file is therefore primarily a NO-OP at the SQL level — it exists
-- to bookmark the dimension semantics change and to fail-safe in case
-- 'tone' was ever dropped from the enum out-of-band.
--
-- Application-level code (src/lib/scoring/dimension-aliases.ts) handles
-- the read-time projection: rows with dimension='adaptability' now
-- surface as 'tone' to the UI, and v1 'tone' rows continue to surface
-- as 'tone' (now matching the canonical name directly).
--
-- IRREVERSIBLE for data semantics — once v3 reps land with
-- dimension='tone', rolling back means treating those rows as v1-style
-- tone (different signal definition). Code rollback retains data
-- integrity; rubric semantics are forward-only.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'dimension'
      AND n.nspname = 'cognify_v2'
      AND e.enumlabel = 'tone'
  ) THEN
    ALTER TYPE "cognify_v2"."dimension" ADD VALUE 'tone';
  END IF;
END
$$;
