CREATE TYPE "public"."card_activation" AS ENUM('active', 'passive');--> statement-breakpoint
CREATE TYPE "public"."card_category" AS ENUM('combat', 'defense', 'mod', 'movement', 'resilience', 'tech', 'ability', 'item');--> statement-breakpoint
CREATE TYPE "public"."card_effect_kind" AS ENUM('mechanical', 'descriptive');--> statement-breakpoint
CREATE TYPE "public"."card_effect_type" AS ENUM('stat_modifier', 'resource_modifier');--> statement-breakpoint
CREATE TYPE "public"."card_trigger" AS ENUM('on_equip', 'on_use', 'passive');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "card_category" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"activation" "card_activation" DEFAULT 'passive' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"color_override" text,
	"effect_kind" "card_effect_kind" NOT NULL,
	"descriptive_text" text,
	"effect_type" "card_effect_type",
	"effect_target" text,
	"effect_amount" integer,
	"trigger" "card_trigger",
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"equipped" boolean DEFAULT false NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_cards" ADD CONSTRAINT "character_cards_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_cards" ADD CONSTRAINT "character_cards_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_cards_character_idx" ON "character_cards" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "character_cards_unique" ON "character_cards" USING btree ("character_id","card_id");