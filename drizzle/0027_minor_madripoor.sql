ALTER TABLE "facility_listings" ADD COLUMN "purchased_by_character_id" uuid;--> statement-breakpoint
ALTER TABLE "facility_listings" ADD COLUMN "purchased_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facility_listings" ADD CONSTRAINT "facility_listings_purchased_by_character_id_characters_id_fk" FOREIGN KEY ("purchased_by_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_listings_purchased_by_idx" ON "facility_listings" USING btree ("purchased_by_character_id");