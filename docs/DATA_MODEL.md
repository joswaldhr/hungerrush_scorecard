# HungerRush Cadence — Data Model Reference v0.2

Source of truth: `src/lib/db/schema.ts`. This document is an overview — see the schema file for exact types, defaults, and foreign keys.

## People

Organization
- id
- name

User
- id
- organization_id
- identity_provider_subject
- email (unique)
- display_name
- status
- is_platform_admin

Team
- id
- organization_id
- parent_team_id (self-referential)
- name
- slug
- status

Employee
- id
- organization_id
- primary_team_id
- display_name
- email
- job_title
- employment_status

TeamMembership
- id
- employee_id
- team_id
- role_type
- effective_from
- effective_to

ManagerAssignment
- id
- manager_user_id
- team_id
- employee_id
- assignment_type
- effective_from
- effective_to

## Identity / Sources

DataSource
- id
- organization_id
- type
- display_name
- status
- configuration_reference
- last_successful_sync_at

ExternalIdentity
- id
- employee_id
- data_source_id
- external_entity_type
- external_id
- external_email
- external_display_name
- match_method
- match_confidence
- verified_at
- metadata_json

SourceRecord
- id
- data_source_id
- external_record_type
- external_record_id
- employee_id
- occurred_at
- period_start
- period_end
- payload_json
- payload_hash
- source_updated_at
- ingested_at
- sync_run_id

NormalizedFact
- id
- organization_id
- employee_id
- team_id
- fact_type
- numeric_value
- text_value
- boolean_value
- unit
- period_start
- period_end
- data_source_id
- source_record_id
- dimensions_json

## Metrics

MetricDefinition
- id
- organization_id
- key
- name
- description
- category
- unit
- value_type
- direction
- aggregation_type
- calculation_type
- calculation_config_json
- default_period
- source_strategy
- status
- version
- effective_from
- effective_to

MetricAssignment
- id
- metric_definition_id
- team_id
- employee_id
- role_key
- display_order
- is_primary
- visible_on_home
- visible_on_team
- visible_on_employee
- effective_from
- effective_to

MetricTarget
- id
- metric_definition_id
- team_id
- employee_id
- role_key
- target_type
- target_value
- warning_value
- effective_from
- effective_to
- priority

MetricValue
- id
- metric_definition_id
- employee_id
- team_id
- period_start
- period_end
- numeric_value
- text_value
- calculation_version
- calculated_at
- data_freshness_at
- provenance_json
- quality_status

MetricObservation
- id
- employee_id
- metric_definition_id
- period_start
- period_end
- observation_type
- severity
- title
- explanation
- current_value
- comparison_value
- target_value
- rule_version
- evidence_json

## Briefings

BriefingSnapshot
- id
- organization_id
- briefing_type
- manager_user_id
- employee_id
- team_id
- period_start
- period_end
- generated_at
- data_freshness_at
- generation_version
- payload_json

## Sync

SyncRun
- id
- data_source_id
- status
- started_at
- completed_at
- records_ingested
- records_normalized
- records_skipped
- error_count
- cursor
- metadata_json

SyncError
- id
- sync_run_id
- error_type
- message
- external_record_id
- retryable
- context (jsonb)

## Context / Meetings

ContextItem
- id
- organization_id
- employee_id
- context_type
- title
- summary
- occurred_at
- effective_until
- data_source_id
- external_reference
- visibility
- metadata_json

MeetingReference
- id
- employee_id
- manager_user_id
- meeting_type
- scheduled_start
- scheduled_end
- external_system
- external_id
- external_url
- status

## Reconciliation

ReconciliationRun
- id
- organization_id
- triggered_by (user_id)
- status
- team_id
- period_start
- period_end
- threshold_pct
- total_comparisons
- match_count
- mismatch_count
- source_missing_count
- cadence_missing_count
- started_at
- completed_at

ReconciliationResult
- id
- reconciliation_run_id
- metric_definition_id
- employee_id
- period_start
- period_end
- cadence_value
- source_value
- absolute_delta
- relative_delta_pct
- status
- cadence_calculation_version
- metric_key
- fact_type
- notes
