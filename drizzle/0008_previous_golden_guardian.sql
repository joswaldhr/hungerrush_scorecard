CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" date NOT NULL,
	"minutes_late" integer,
	"points_assigned" real,
	"notes" text,
	"excused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coaching_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"meeting_note_id" uuid,
	"metric_definition_id" uuid,
	"topic" text NOT NULL,
	"notes" text,
	"expected_improvement" text,
	"follow_up_date" date,
	"outcome" text,
	"outcome_notes" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid,
	"team_id" uuid,
	"manager_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"source" text DEFAULT 'manager' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discussed_at" timestamp with time zone,
	"meeting_note_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"meeting_note_id" uuid,
	"ticket_id" text NOT NULL,
	"ticket_url" text,
	"category" text NOT NULL,
	"notes" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "owner" text DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD COLUMN "life_check_in" text;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_records" ADD CONSTRAINT "coaching_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_records" ADD CONSTRAINT "coaching_records_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_records" ADD CONSTRAINT "coaching_records_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_records" ADD CONSTRAINT "coaching_records_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_topics" ADD CONSTRAINT "discussion_topics_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reviews" ADD CONSTRAINT "ticket_reviews_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reviews" ADD CONSTRAINT "ticket_reviews_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reviews" ADD CONSTRAINT "ticket_reviews_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_events_employee_id_idx" ON "attendance_events" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "attendance_events_occurred_at_idx" ON "attendance_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "coaching_records_employee_id_idx" ON "coaching_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "coaching_records_manager_id_idx" ON "coaching_records" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "coaching_records_metric_id_idx" ON "coaching_records" USING btree ("metric_definition_id");--> statement-breakpoint
CREATE INDEX "discussion_topics_employee_id_idx" ON "discussion_topics" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "discussion_topics_team_id_idx" ON "discussion_topics" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "discussion_topics_status_idx" ON "discussion_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ticket_reviews_employee_id_idx" ON "ticket_reviews" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "ticket_reviews_manager_id_idx" ON "ticket_reviews" USING btree ("manager_user_id");