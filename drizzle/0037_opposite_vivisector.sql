CREATE TYPE "public"."offering_currency" AS ENUM('xp', 'credits');--> statement-breakpoint
CREATE TABLE "character_offering_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"offering_id" uuid,
	"cost_paid" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_xp_offerings" ADD COLUMN "cost_currency" "offering_currency" DEFAULT 'xp' NOT NULL;--> statement-breakpoint
ALTER TABLE "character_offering_purchases" ADD CONSTRAINT "character_offering_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_offering_purchases" ADD CONSTRAINT "character_offering_purchases_offering_id_facility_xp_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."facility_xp_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_offering_purchases_character_idx" ON "character_offering_purchases" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE INDEX "character_offering_purchases_offering_idx" ON "character_offering_purchases" USING btree ("character_id","offering_id");--> statement-breakpoint
-- cost_currency defaults to 'xp', which is already correct for every existing
-- offering type except resource_refill (always Credits, per offeringCostCurrency
-- in lib/facilities.ts) — backfill those rows so the new column matches the
-- currency they were already actually charged in.
UPDATE "facility_xp_offerings" SET "cost_currency" = 'credits' WHERE "offering_type" = 'resource_refill';