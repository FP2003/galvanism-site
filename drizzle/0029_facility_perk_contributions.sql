CREATE TABLE "facility_perk_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perk_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "facility_level_contributions";--> statement-breakpoint
DROP TABLE "facility_perk_purchases";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "next_level_cost";--> statement-breakpoint
ALTER TABLE "facility_perks" ADD COLUMN "funded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facility_perk_contributions" ADD CONSTRAINT "facility_perk_contributions_perk_id_facility_perks_id_fk" FOREIGN KEY ("perk_id") REFERENCES "public"."facility_perks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_perk_contributions" ADD CONSTRAINT "facility_perk_contributions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_perk_contributions_perk_idx" ON "facility_perk_contributions" USING btree ("perk_id");
