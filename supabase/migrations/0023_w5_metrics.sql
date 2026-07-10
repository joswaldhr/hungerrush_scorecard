-- Sprint 3 (W5): Assembled State Breakdowns
-- Seeded as inactive until the rollout is complete.

INSERT INTO public.metric_definitions (key, name, coaching_prompt, source, direction, unit, is_active)
VALUES
  ('away_hours', 'Away Time', 'Amount of scheduled time spent in an Away state.', 'assembled', 'lower_is_better', 'seconds', false),
  ('transfer_hours', 'Transfer Time', 'Amount of time spent transferring tickets/calls.', 'assembled', 'lower_is_better', 'seconds', false),
  ('online_hours', 'Online Time', 'Amount of scheduled time spent Online/Available.', 'assembled', 'higher_is_better', 'seconds', false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  coaching_prompt = EXCLUDED.coaching_prompt,
  source = EXCLUDED.source,
  direction = EXCLUDED.direction,
  unit = EXCLUDED.unit;
