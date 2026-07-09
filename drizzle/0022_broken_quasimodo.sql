ALTER TYPE "public"."card_category" ADD VALUE 'firearm_mod';--> statement-breakpoint
ALTER TYPE "public"."card_category" ADD VALUE 'melee_mod';--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "mod_slots" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "mod_damage_delta" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "mod_range_delta" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "mod_added_damage_type" "weapon_damage_type";--> statement-breakpoint
ALTER TABLE "character_cards" ADD COLUMN "installed_on_character_card_id" uuid;--> statement-breakpoint
ALTER TABLE "character_cards" ADD CONSTRAINT "character_cards_installed_on_character_card_id_character_cards_id_fk" FOREIGN KEY ("installed_on_character_card_id") REFERENCES "public"."character_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_cards_installed_on_idx" ON "character_cards" USING btree ("installed_on_character_card_id");