CREATE TABLE "roster_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_reference" text,
	"mapping_key" text NOT NULL,
	"members" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD COLUMN "observation_id" uuid;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD COLUMN "previous_employee_state" jsonb;--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "roster_observations" ADD CONSTRAINT "roster_observations_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roster_observations_source_time_idx" ON "roster_observations" USING btree ("data_source_id","observed_at");--> statement-breakpoint
ALTER TABLE "roster_candidates" ADD CONSTRAINT "roster_candidates_observation_id_roster_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."roster_observations"("id") ON DELETE no action ON UPDATE no action;