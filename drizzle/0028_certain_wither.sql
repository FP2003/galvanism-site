CREATE TABLE "facility_level_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"toward_level" integer NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "hp_temp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "next_level_cost" integer;--> statement-breakpoint
ALTER TABLE "facility_level_contributions" ADD CONSTRAINT "facility_level_contributions_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_level_contributions" ADD CONSTRAINT "facility_level_contributions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_level_contributions_facility_idx" ON "facility_level_contributions" USING btree ("facility_id","toward_level");