CREATE TYPE "public"."xp_offering_type" AS ENUM('stat_bump', 'resource_refill');--> statement-breakpoint
CREATE TABLE "facility_xp_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"offering_type" "xp_offering_type" NOT NULL,
	"target_key" text NOT NULL,
	"amount" integer NOT NULL,
	"xp_cost" integer NOT NULL,
	"min_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facility_xp_offerings" ADD CONSTRAINT "facility_xp_offerings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_xp_offerings_facility_idx" ON "facility_xp_offerings" USING btree ("facility_id");