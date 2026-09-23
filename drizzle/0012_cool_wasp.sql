CREATE TABLE "sync_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_revisions" ADD CONSTRAINT "sync_revisions_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_revisions_run_idx" ON "sync_revisions" USING btree ("sync_run_id");--> statement-breakpoint
CREATE INDEX "sync_revisions_entity_idx" ON "sync_revisions" USING btree ("entity_type","entity_id");