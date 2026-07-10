-- Sprint 3 (W4): Tickets Assigned & Backlog

INSERT INTO public.metric_definitions (key, name, coaching_prompt, source, direction, unit, is_active)
VALUES
  ('tickets_assigned', 'Tickets Assigned', 'Number of tickets assigned to the agent this period.', 'zendesk', 'higher_is_better', 'count', false),
  ('backlog', 'Backlog', 'Number of open tickets assigned to the agent.', 'zendesk', 'lower_is_better', 'count', false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  coaching_prompt = EXCLUDED.coaching_prompt,
  source = EXCLUDED.source,
  direction = EXCLUDED.direction,
  unit = EXCLUDED.unit;
