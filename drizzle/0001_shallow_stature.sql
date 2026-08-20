CREATE TABLE "metric_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"team_id" uuid,
	"employee_id" uuid,
	"role_key" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"visible_on_home" boolean DEFAULT true NOT NULL,
	"visible_on_team" boolean DEFAULT true NOT NULL,
	"visible_on_employee" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"unit" text,
	"value_type" text DEFAULT 'numeric' NOT NULL,
	"direction" text DEFAULT 'higher_is_better' NOT NULL,
	"aggregation_type" text,
	"calculation_type" text DEFAULT 'latest' NOT NULL,
	"calculation_config_json" jsonb,
	"default_period" text DEFAULT 'week' NOT NULL,
	"source_strategy" text,
	"status" text DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"observation_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"explanation" text,
	"current_value" real,
	"comparison_value" real,
	"target_value" real,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"evidence_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"team_id" uuid,
	"employee_id" uuid,
	"role_key" text,
	"target_type" text DEFAULT 'minimum' NOT NULL,
	"target_value" real NOT NULL,
	"warning_value" real,
	"effective_from" date,
	"effective_to" date,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_definition_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"team_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"numeric_value" real,
	"text_value" text,
	"calculation_version" integer DEFAULT 1 NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_freshness_at" timestamp with time zone,
	"provenance_json" jsonb,
	"quality_status" text DEFAULT 'complete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_assignments" ADD CONSTRAINT "metric_assignments_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_assignments" ADD CONSTRAINT "metric_assignments_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_assignments" ADD CONSTRAINT "metric_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_observations" ADD CONSTRAINT "metric_observations_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD CONSTRAINT "metric_targets_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD CONSTRAINT "metric_targets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD CONSTRAINT "metric_targets_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metric_assignments_definition_id_idx" ON "metric_assignments" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "metric_assignments_team_id_idx" ON "metric_assignments" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "metric_definitions_org_id_idx" ON "metric_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_definitions_org_key_version_idx" ON "metric_definitions" USING btree ("organization_id","key","version");--> statement-breakpoint
CREATE INDEX "metric_observations_employee_id_idx" ON "metric_observations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "metric_observations_definition_id_idx" ON "metric_observations" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "metric_observations_period_idx" ON "metric_observations" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "metric_targets_definition_id_idx" ON "metric_targets" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "metric_targets_team_id_idx" ON "metric_targets" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "metric_values_employee_id_idx" ON "metric_values" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "metric_values_definition_id_idx" ON "metric_values" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "metric_values_period_idx" ON "metric_values" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_values_unique_idx" ON "metric_values" USING btree ("metric_definition_id","employee_id","period_start","period_end");