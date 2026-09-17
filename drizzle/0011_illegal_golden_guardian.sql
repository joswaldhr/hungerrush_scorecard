DROP INDEX "metric_visibility_overrides_unique_idx";--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "metric_visibility_overrides" ADD CONSTRAINT "metric_visibility_overrides_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "metric_visibility_overrides_unique_idx" ON "metric_visibility_overrides" USING btree ("scope","manager_user_id","target_employee_id","metric_definition_id","team_id","line");