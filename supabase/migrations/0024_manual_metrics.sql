-- Sprint 3 (W6): Manual Metrics (Attendance & QA)

-- Add 'manual' to the source enum if not already present
ALTER TYPE metric_source ADD VALUE IF NOT EXISTS 'manual';

INSERT INTO public.metric_definitions (key, name, coaching_prompt, source, direction, unit, is_active)
VALUES
  ('attendance_points', 'Attendance Points', 'Number of attendance points accrued (lower is better).', 'manual', 'lower_is_better', 'count', true),
  ('tickets_audited', 'QA Audits', 'Number of tickets reviewed for Quality Assurance.', 'manual', 'higher_is_better', 'count', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  coaching_prompt = EXCLUDED.coaching_prompt,
  source = EXCLUDED.source,
  direction = EXCLUDED.direction,
  unit = EXCLUDED.unit;

-- Create RLS policies for manual metric insertion/updating

CREATE POLICY "metric_snapshots_insert_manual" ON metric_snapshots FOR INSERT
  WITH CHECK (
    employee_id IN (SELECT visible_employee_ids())
    AND metric_key IN (SELECT key FROM metric_definitions WHERE source = 'manual')
  );

CREATE POLICY "metric_snapshots_update_manual" ON metric_snapshots FOR UPDATE
  USING (
    employee_id IN (SELECT visible_employee_ids())
    AND metric_key IN (SELECT key FROM metric_definitions WHERE source = 'manual')
  )
  WITH CHECK (
    employee_id IN (SELECT visible_employee_ids())
    AND metric_key IN (SELECT key FROM metric_definitions WHERE source = 'manual')
  );
