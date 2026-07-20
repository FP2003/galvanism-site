ALTER TABLE "facility_listings" DROP CONSTRAINT "facility_listings_purchased_by_character_id_characters_id_fk";
--> statement-breakpoint
DROP INDEX "facility_listings_purchased_by_idx";--> statement-breakpoint
ALTER TABLE "facility_listings" DROP COLUMN "purchased_by_character_id";--> statement-breakpoint
ALTER TABLE "facility_listings" DROP COLUMN "purchased_at";