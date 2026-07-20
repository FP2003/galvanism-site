CREATE TABLE "facility_listing_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_listings" ADD COLUMN "quantity_total" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_listings" ADD COLUMN "quantity_sold" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "facility_listing_purchases" ADD CONSTRAINT "facility_listing_purchases_listing_id_facility_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."facility_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_listing_purchases" ADD CONSTRAINT "facility_listing_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_listing_purchases_listing_idx" ON "facility_listing_purchases" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "facility_listing_purchases_character_idx" ON "facility_listing_purchases" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_listing_purchases_unique" ON "facility_listing_purchases" USING btree ("listing_id","character_id");--> statement-breakpoint
-- Backfill: every existing single-buyer claim becomes a 1-unit purchase row,
-- and quantity_sold reflects that same claim, before the old claim columns
-- are dropped in the next migration.
INSERT INTO "facility_listing_purchases" ("listing_id", "character_id", "purchased_at")
SELECT "id", "purchased_by_character_id", COALESCE("purchased_at", now())
FROM "facility_listings"
WHERE "purchased_by_character_id" IS NOT NULL;--> statement-breakpoint
UPDATE "facility_listings"
SET "quantity_sold" = 1
WHERE "purchased_by_character_id" IS NOT NULL;