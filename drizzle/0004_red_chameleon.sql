CREATE TABLE "card_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"activation" "card_activation" DEFAULT 'passive' NOT NULL,
	"effect_type" "card_effect_type" NOT NULL,
	"effect_target" text NOT NULL,
	"effect_amount" integer NOT NULL,
	"trigger" "card_trigger" DEFAULT 'passive' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_effects" ADD CONSTRAINT "card_effects_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_effects_card_idx" ON "card_effects" USING btree ("card_id");--> statement-breakpoint
INSERT INTO "card_effects" ("id", "card_id", "activation", "effect_type", "effect_target", "effect_amount", "trigger", "sort_order")
SELECT gen_random_uuid(), "id", "activation", "effect_type", "effect_target", "effect_amount", "trigger", 0
FROM "cards" WHERE "effect_kind" = 'mechanical';--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "activation";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "effect_kind";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "effect_type";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "effect_target";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "effect_amount";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "trigger";--> statement-breakpoint
DROP TYPE "public"."card_effect_kind";