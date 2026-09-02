-- Phase 1: Fact Identity & Duplicate Cleanup
-- Pre-conditions verified by scripts/phase1-verify-and-backup.ts:
--   - 0 NULL source_record_ids
--   - All 274 duplicate groups from same source record
--   - All 354 surviving (newest) facts match source record payloads
--   - Exactly 601 rows to delete

-- Step 1: Remove duplicate facts (keep newest per sourceRecordId + factType group)
DELETE FROM normalized_facts
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY source_record_id, fact_type
        ORDER BY created_at DESC
      ) AS rn
    FROM normalized_facts
  ) sub
  WHERE rn > 1
);

-- Step 2: Add source_observed_at column
ALTER TABLE normalized_facts
  ADD COLUMN source_observed_at timestamptz;

-- Step 3: Backfill source_observed_at from source records
UPDATE normalized_facts nf
SET source_observed_at = COALESCE(sr.source_updated_at, sr.occurred_at, sr.ingested_at)
FROM source_records sr
WHERE sr.id = nf.source_record_id;

-- Step 4: Make source_observed_at NOT NULL after backfill
ALTER TABLE normalized_facts
  ALTER COLUMN source_observed_at SET NOT NULL;

-- Step 5: Enforce NOT NULL on source_record_id
ALTER TABLE normalized_facts
  ALTER COLUMN source_record_id SET NOT NULL;

-- Step 6: Add fact identity unique index
CREATE UNIQUE INDEX normalized_facts_identity_idx
  ON normalized_facts (source_record_id, fact_type);

-- Step 7: Add team_aggregation column to metric_definitions
ALTER TABLE metric_definitions
  ADD COLUMN team_aggregation text NOT NULL DEFAULT 'simple_average';
