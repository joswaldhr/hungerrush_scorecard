-- 0011_metric_definitions_seed.sql
-- Adds display_order column to metric_definitions and seeds the 8 metrics
-- (5 from Zendesk, 3 from Assembled). Keys match connector metricKey values.

-- =============================================================================
-- SCHEMA CHANGE
-- =============================================================================

ALTER TABLE metric_definitions
  ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO metric_definitions (key, name, unit, source, direction, display_order, coaching_prompt) VALUES
  -- Zendesk metrics (1–5)
  ('ticket_volume', 'Ticket Volume', 'count', 'zendesk', 'higher_is_better', 1,
   'How is throughput building this week? Recognize strong output and discuss what support could help maintain the momentum.'),

  ('first_reply_time', 'First Reply Time', 'seconds', 'zendesk', 'lower_is_better', 2,
   'How is initial response speed improving? Discuss what''s working well and explore opportunities to build toward even faster engagement.'),

  ('csat_score', 'Customer Satisfaction', 'percent', 'zendesk', 'higher_is_better', 3,
   'What''s driving positive customer feedback? Highlight what''s growing and explore opportunities to build on that momentum.'),

  ('sla_compliance', 'SLA Compliance', 'percent', 'zendesk', 'higher_is_better', 4,
   'How are service-level commitments being met? Recognize improving trends and discuss what could help build toward more consistent results.'),

  ('resolution_rate', 'Resolution Rate', 'percent', 'zendesk', 'higher_is_better', 5,
   'Look at how effectively issues are being resolved. What''s working in strong weeks? Where is there an opportunity to grow?'),

  -- Assembled metrics (6–8)
  ('schedule_adherence', 'Schedule Adherence', 'percent', 'assembled', 'higher_is_better', 6,
   'Explore how schedule follow-through is going. What routines are working well? Where might there be an opportunity to adjust the daily flow?'),

  ('occupancy', 'Occupancy', 'percent', 'assembled', 'higher_is_better', 7,
   'Look at the balance between productive time and availability. Is the pace sustainable? Discuss what''s growing well and where there''s an opportunity to improve.'),

  ('handle_time', 'Average Handle Time', 'seconds', 'assembled', 'lower_is_better', 8,
   'Review how customer interaction efficiency is improving. What patterns from strong weeks can be applied more broadly?');

-- =============================================================================
-- ROLLBACK:
-- DELETE FROM metric_definitions WHERE key IN (
--   'ticket_volume', 'first_reply_time', 'csat_score', 'sla_compliance',
--   'resolution_rate', 'schedule_adherence', 'occupancy', 'handle_time'
-- );
-- ALTER TABLE metric_definitions DROP COLUMN display_order;
-- =============================================================================
