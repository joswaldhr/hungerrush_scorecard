CREATE TABLE "action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"meeting_note_id" uuid,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_reference_id" uuid,
	"employee_id" uuid NOT NULL,
	"manager_user_id" uuid NOT NULL,
	"outcome" text,
	"body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_meeting_reference_id_meeting_references_id_fk" FOREIGN KEY ("meeting_reference_id") REFERENCES "public"."meeting_references"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_manager_user_id_users_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_items_employee_id_idx" ON "action_items" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "action_items_manager_id_idx" ON "action_items" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "action_items_status_idx" ON "action_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meeting_notes_employee_id_idx" ON "meeting_notes" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_manager_id_idx" ON "meeting_notes" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "meeting_notes_meeting_ref_idx" ON "meeting_notes" USING btree ("meeting_reference_id");