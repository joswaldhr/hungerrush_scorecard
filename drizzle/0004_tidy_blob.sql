CREATE TABLE "reconciliation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_run_id" uuid NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"cadence_value" real,
	"source_value" real,
	"absolute_delta" real,
	"relative_delta_pct" real,
	"status" text NOT NULL,
	"cadence_calculation_version" integer,
	"metric_key" text NOT NULL,
	"fact_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"triggered_by" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"team_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"threshold_pct" real DEFAULT 5 NOT NULL,
	"total_comparisons" integer DEFAULT 0 NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"mismatch_count" integer DEFAULT 0 NOT NULL,
	"source_missing_count" integer DEFAULT 0 NOT NULL,
	"cadence_missing_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_reconciliation_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliation_run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reconciliation_results_run_id_idx" ON "reconciliation_results" USING btree ("reconciliation_run_id");--> statement-breakpoint
CREATE INDEX "reconciliation_results_employee_id_idx" ON "reconciliation_results" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "reconciliation_results_metric_id_idx" ON "reconciliation_results" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_org_id_idx" ON "reconciliation_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_status_idx" ON "reconciliation_runs" USING btree ("status");