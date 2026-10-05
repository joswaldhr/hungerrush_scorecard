CREATE TABLE "roster_discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"new_candidates" integer DEFAULT 0 NOT NULL,
	"departed_candidates" integer DEFAULT 0 NOT NULL,
	"failure_code" text
);
--> statement-breakpoint
ALTER TABLE "roster_discovery_runs" ADD CONSTRAINT "roster_discovery_runs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_discovery_runs_source_started_idx" ON "roster_discovery_runs" USING btree ("data_source_id","started_at");