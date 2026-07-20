ALTER TYPE "public"."xp_offering_type" ADD VALUE 'slot_upgrade';--> statement-breakpoint
CREATE TABLE "character_slot_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"category" "card_category" NOT NULL,
	"bonus" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_slot_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"offering_id" uuid,
	"category" "card_category" NOT NULL,
	"slots_granted" integer NOT NULL,
	"cost_paid" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_xp_offerings" ADD COLUMN "cost_increment" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character_slot_overrides" ADD CONSTRAINT "character_slot_overrides_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_slot_purchases" ADD CONSTRAINT "character_slot_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_slot_purchases" ADD CONSTRAINT "character_slot_purchases_offering_id_facility_xp_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."facility_xp_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "character_slot_overrides_unique" ON "character_slot_overrides" USING btree ("character_id","category");--> statement-breakpoint
CREATE INDEX "character_slot_purchases_character_idx" ON "character_slot_purchases" USING btree ("character_id","created_at");--> statement-breakpoint
CREATE INDEX "character_slot_purchases_offering_idx" ON "character_slot_purchases" USING btree ("character_id","offering_id");