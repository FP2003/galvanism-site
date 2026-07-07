CREATE TYPE "public"."listing_source" AS ENUM('manual', 'rotation');--> statement-breakpoint
CREATE TABLE "shop_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"source" "listing_source" DEFAULT 'manual' NOT NULL,
	"slot_index" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_restock_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"category" "card_category" NOT NULL,
	"level" integer NOT NULL,
	"weight" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_open" boolean DEFAULT true NOT NULL,
	"rotating_slot_count" integer DEFAULT 4 NOT NULL,
	"restock_interval_ops" integer,
	"ops_since_restock" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "price_credits" integer;--> statement-breakpoint
ALTER TABLE "shop_listings" ADD CONSTRAINT "shop_listings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_listings" ADD CONSTRAINT "shop_listings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_restock_rules" ADD CONSTRAINT "shop_restock_rules_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_listings_shop_idx" ON "shop_listings" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_listings_shop_card_unique" ON "shop_listings" USING btree ("shop_id","card_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_listings_shop_slot_unique" ON "shop_listings" USING btree ("shop_id","slot_index") WHERE "shop_listings"."slot_index" is not null;--> statement-breakpoint
CREATE INDEX "shop_restock_rules_shop_idx" ON "shop_restock_rules" USING btree ("shop_id");