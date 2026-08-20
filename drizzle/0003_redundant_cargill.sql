CREATE TABLE "context_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"context_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"data_source_id" uuid,
	"external_reference" text,
	"visibility" text DEFAULT 'manager' NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"meeting_type" text NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone,
	"external_system" text,
	"external_id" text,
	"external_url" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"team_id" uuid,
	"fact_type" text NOT NULL,
	"numeric_value" real,
	"text_value" text,
	"boolean_value" boolean,
	"unit" text,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"data_source_id" uuid NOT NULL,
	"source_record_id" uuid,
	"dimensions_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_record_type" text NOT NULL,
	"external_record_id" text NOT NULL,
	"employee_id" uuid,
	"occurred_at" timestamp with time zone,
	"period_start" date,
	"period_end" date,
	"payload_json" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "sync_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"error_type" text NOT NULL,
	"message" text NOT NULL,
	"external_record_id" text,
	"retryable" boolean DEFAULT false NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"records_ingested" integer DEFAULT 0 NOT NULL,
	"records_normalized" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"cursor" text,
	"metadata_json" jsonb
);
--> statement-breakpoint
ALTER TABLE "context_items" ADD CONSTRAINT "context_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_items" ADD CONSTRAINT "context_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_items" ADD CONSTRAINT "context_items_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_references" ADD CONSTRAINT "meeting_references_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_references" ADD CONSTRAINT "meeting_references_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_facts" ADD CONSTRAINT "normalized_facts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_facts" ADD CONSTRAINT "normalized_facts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_facts" ADD CONSTRAINT "normalized_facts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_facts" ADD CONSTRAINT "normalized_facts_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_facts" ADD CONSTRAINT "normalized_facts_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "context_items_employee_id_idx" ON "context_items" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "context_items_context_type_idx" ON "context_items" USING btree ("context_type");--> statement-breakpoint
CREATE INDEX "meeting_references_employee_id_idx" ON "meeting_references" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "meeting_references_manager_id_idx" ON "meeting_references" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "normalized_facts_employee_id_idx" ON "normalized_facts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "normalized_facts_fact_type_idx" ON "normalized_facts" USING btree ("fact_type");--> statement-breakpoint
CREATE INDEX "normalized_facts_period_idx" ON "normalized_facts" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "normalized_facts_source_record_id_idx" ON "normalized_facts" USING btree ("source_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_records_dedup_idx" ON "source_records" USING btree ("data_source_id","external_record_type","external_record_id");--> statement-breakpoint
CREATE INDEX "source_records_employee_id_idx" ON "source_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "source_records_period_idx" ON "source_records" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "sync_errors_sync_run_id_idx" ON "sync_errors" USING btree ("sync_run_id");--> statement-breakpoint
CREATE INDEX "sync_runs_data_source_id_idx" ON "sync_runs" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "sync_runs_status_idx" ON "sync_runs" USING btree ("status");