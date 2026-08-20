# HungerRush Cadence — Data Model Reference v0.1

## People

Organization
- id
- name

User
- id
- organization_id
- identity_provider_subject
- email
- display_name
- status

Team
- id
- organization_id
- parent_team_id
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
- employee_id
- team_id
- role_type
- effective_from
- effective_to

ManagerAssignment
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

NormalizedFact
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
- created_at

## Context / Meetings

ContextItem
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
- employee_id
- manager_user_id
- meeting_type
- scheduled_start
- scheduled_end
- external_system
- external_id
- external_url
- status

BriefingSnapshot
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
- data_source_id
- sync_type
- status
- started_at
- completed_at
- cursor_before
- cursor_after
- records_read
- records_written
- warnings_count
- errors_count
- error_summary

SyncError
- sync_run_id
- external_record_id
- error_code
- message
- retryable
- metadata_json
- created_at
