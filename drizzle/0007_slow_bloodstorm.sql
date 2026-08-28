CREATE TABLE "roster_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_email" text,
	"external_display_name" text,
	"change_type" text NOT NULL,
	"employee_id" uuid,
	"suggested_team_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roster_source_team_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"external_group_id" text NOT NULL,
	"external_group_label" text NOT NULL,
	"team_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_suggested_team_id_teams_id_fk" FOREIGN KEY ("suggested_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_source_team_mappings" ADD CONSTRAINT "roster_source_team_mappings_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_source_team_mappings" ADD CONSTRAINT "roster_source_team_mappings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_candidates_data_source_id_idx" ON "roster_candidates" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "roster_candidates_status_idx" ON "roster_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "roster_mappings_data_source_id_idx" ON "roster_source_team_mappings" USING btree ("data_source_id");