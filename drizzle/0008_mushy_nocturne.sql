CREATE TYPE "public"."item_subcategory" AS ENUM('medical', 'grenade', 'rifle', 'pistol', 'melee', 'other');--> statement-breakpoint
CREATE TYPE "public"."weapon_handedness" AS ENUM('one_handed', 'two_handed');--> statement-breakpoint
CREATE TYPE "public"."weapon_slot" AS ENUM('primary', 'secondary', 'tertiary');--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "subcategory" "item_subcategory";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "handedness" "weapon_handedness";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "damage" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "range" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "ammo_count" integer;--> statement-breakpoint
ALTER TABLE "character_cards" ADD COLUMN "weapon_slot" "weapon_slot";--> statement-breakpoint
CREATE UNIQUE INDEX "character_cards_weapon_slot_unique" ON "character_cards" USING btree ("character_id","weapon_slot") WHERE "character_cards"."weapon_slot" is not null;