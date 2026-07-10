-- Sprint 3 (W3): Zendesk Talk Telephony Metrics
-- Seeded as inactive until the feature flag/rollout is complete.

INSERT INTO public.metric_definitions (key, name, coaching_prompt, source, direction, unit, is_active)
VALUES
  ('ib_calls_offered', 'Inbound Calls Offered', 'Volume of inbound calls routed to this agent.', 'zendesk', 'higher_is_better', 'count', false),
  ('ib_calls_answered', 'Inbound Calls Answered', 'Number of inbound calls successfully answered.', 'zendesk', 'higher_is_better', 'count', false),
  ('ib_calls_declined', 'Inbound Calls Declined', 'Number of inbound calls manually declined by the agent.', 'zendesk', 'lower_is_better', 'count', false),
  ('ib_calls_missed', 'Inbound Calls Missed', 'Number of inbound calls that rang out and were missed.', 'zendesk', 'lower_is_better', 'count', false),
  ('ib_talk_time', 'Inbound Talk Time (Avg)', 'Average talk time for inbound calls.', 'zendesk', 'lower_is_better', 'seconds', false),
  ('ob_talk_time', 'Outbound Talk Time (Avg)', 'Average talk time for outbound calls.', 'zendesk', 'lower_is_better', 'seconds', false),
  ('ob_calls', 'Outbound Calls', 'Volume of outbound calls made.', 'zendesk', 'higher_is_better', 'count', false)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  coaching_prompt = EXCLUDED.coaching_prompt,
  source = EXCLUDED.source,
  direction = EXCLUDED.direction,
  unit = EXCLUDED.unit;
