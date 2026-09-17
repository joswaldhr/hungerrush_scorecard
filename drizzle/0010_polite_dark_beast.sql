CREATE TABLE "metric_visibility_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"manager_user_id" uuid,
	"target_employee_id" uuid,
	"metric_definition_id" uuid NOT NULL,
	"line" text,
	"hidden" boolean NOT NULL,
	"hidden_by" uuid NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "metric_targets" ALTER COLUMN "target_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "line" text;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD COLUMN "target_min" real;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD COLUMN "target_max" real;--> statement-breakpoint
ALTER TABLE "metric_targets" ADD COLUMN "line" text;--> statement-breakpoint
ALTER TABLE "roster_source_team_mappings" ADD COLUMN "line" text;--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD CONSTRAINT "metric_visibility_overrides_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD CONSTRAINT "metric_visibility_overrides_target_employee_id_employees_id_fk" FOREIGN KEY ("target_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD CONSTRAINT "metric_visibility_overrides_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD CONSTRAINT "metric_visibility_overrides_hidden_by_users_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metric_visibility_overrides_manager_idx" ON "metric_visibility_overrides" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "metric_visibility_overrides_employee_idx" ON "metric_visibility_overrides" USING btree ("target_employee_id");--> statement-breakpoint
CREATE INDEX "metric_visibility_overrides_metric_def_idx" ON "metric_visibility_overrides" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_visibility_overrides_unique_idx" ON "metric_visibility_overrides" USING btree ("scope","manager_user_id","target_employee_id","metric_definition_id","line");