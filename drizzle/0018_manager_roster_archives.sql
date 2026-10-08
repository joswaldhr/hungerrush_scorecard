CREATE TABLE "manager_roster_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"reason" text NOT NULL,
	"archived_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"restored_at" timestamp with time zone,
	"restored_by" uuid,
	"restore_reason" text
);
--> statement-breakpoint
ALTER TABLE "manager_roster_archives" ADD CONSTRAINT "manager_roster_archives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_roster_archives" ADD CONSTRAINT "manager_roster_archives_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_roster_archives" ADD CONSTRAINT "manager_roster_archives_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_roster_archives" ADD CONSTRAINT "manager_roster_archives_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_roster_archives" ADD CONSTRAINT "manager_roster_archives_restored_by_users_id_fk" FOREIGN KEY ("restored_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manager_roster_archive_active_idx" ON "manager_roster_archives" USING btree ("manager_user_id","employee_id") WHERE "manager_roster_archives"."restored_at" is null;--> statement-breakpoint
CREATE INDEX "manager_roster_archive_org_idx" ON "manager_roster_archives" USING btree ("organization_id");