-- Phase 6: Facilities absorbs Phase 4's Shops. Pure rename + additive columns,
-- no data loss — every existing shop/listing/restock-rule row survives with
-- the same id, just under the facilities/facility_listings/facility_restock_rules
-- names. Hand-written (not drizzle-kit generate output) because generate's
-- interactive rename-detection prompt requires a TTY and risks emitting
-- DROP+CREATE if answered wrong; every identifier below was verified against
-- the live DB's actual constraint/index names before writing this file.
CREATE TYPE "public"."facility_kind" AS ENUM('station', 'field');--> statement-breakpoint
ALTER TABLE "shops" RENAME TO "facilities";--> statement-breakpoint
ALTER TABLE "shop_listings" RENAME TO "facility_listings";--> statement-breakpoint
ALTER TABLE "shop_restock_rules" RENAME TO "facility_restock_rules";--> statement-breakpoint
ALTER TABLE "facility_listings" RENAME COLUMN "shop_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "facility_restock_rules" RENAME COLUMN "shop_id" TO "facility_id";--> statement-breakpoint
ALTER TABLE "facilities" RENAME CONSTRAINT "shops_created_by_user_id_users_id_fk" TO "facilities_created_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "facility_listings" RENAME CONSTRAINT "shop_listings_shop_id_shops_id_fk" TO "facility_listings_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facility_listings" RENAME CONSTRAINT "shop_listings_card_id_cards_id_fk" TO "facility_listings_card_id_cards_id_fk";--> statement-breakpoint
ALTER TABLE "facility_restock_rules" RENAME CONSTRAINT "shop_restock_rules_shop_id_shops_id_fk" TO "facility_restock_rules_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "facilities" RENAME CONSTRAINT "shops_pkey" TO "facilities_pkey";--> statement-breakpoint
ALTER TABLE "facility_listings" RENAME CONSTRAINT "shop_listings_pkey" TO "facility_listings_pkey";--> statement-breakpoint
ALTER TABLE "facility_restock_rules" RENAME CONSTRAINT "shop_restock_rules_pkey" TO "facility_restock_rules_pkey";--> statement-breakpoint
ALTER INDEX "shop_listings_shop_idx" RENAME TO "facility_listings_facility_idx";--> statement-breakpoint
ALTER INDEX "shop_listings_shop_card_unique" RENAME TO "facility_listings_facility_card_unique";--> statement-breakpoint
ALTER INDEX "shop_listings_shop_slot_unique" RENAME TO "facility_listings_facility_slot_unique";--> statement-breakpoint
ALTER INDEX "shop_restock_rules_shop_idx" RENAME TO "facility_restock_rules_facility_idx";--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "level" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "kind" "public"."facility_kind" NOT NULL DEFAULT 'station';
