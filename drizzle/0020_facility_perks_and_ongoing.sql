CREATE TABLE "facility_ongoing_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"label" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_perk_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perk_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_perks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_credits" integer NOT NULL,
	"min_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_ongoing_entries" ADD CONSTRAINT "facility_ongoing_entries_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_ongoing_entries" ADD CONSTRAINT "facility_ongoing_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_perk_purchases" ADD CONSTRAINT "facility_perk_purchases_perk_id_facility_perks_id_fk" FOREIGN KEY ("perk_id") REFERENCES "public"."facility_perks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_perk_purchases" ADD CONSTRAINT "facility_perk_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_perks" ADD CONSTRAINT "facility_perks_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_ongoing_entries_facility_idx" ON "facility_ongoing_entries" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_perk_purchases_character_idx" ON "facility_perk_purchases" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_perk_purchases_unique" ON "facility_perk_purchases" USING btree ("perk_id","character_id");--> statement-breakpoint
CREATE INDEX "facility_perks_facility_idx" ON "facility_perks" USING btree ("facility_id");