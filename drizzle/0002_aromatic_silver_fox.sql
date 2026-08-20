CREATE TABLE "briefing_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"briefing_type" text NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"employee_id" uuid,
	"team_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_freshness_at" timestamp with time zone,
	"generation_version" integer DEFAULT 1 NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefing_snapshots" ADD CONSTRAINT "briefing_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "briefing_snapshots_manager_id_idx" ON "briefing_snapshots" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "briefing_snapshots_team_id_idx" ON "briefing_snapshots" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "briefing_snapshots_period_idx" ON "briefing_snapshots" USING btree ("period_start","period_end");