CREATE TYPE "public"."registry_entry_type" AS ENUM('npc', 'location', 'faction', 'item', 'event');--> statement-breakpoint
CREATE TYPE "public"."registry_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TABLE "registry_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "registry_entry_type" NOT NULL,
	"visibility" "registry_visibility" DEFAULT 'public' NOT NULL,
	"description" text,
	"gm_notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registry_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "registry_entries" ADD CONSTRAINT "registry_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registry_entries_type_idx" ON "registry_entries" USING btree ("type");--> statement-breakpoint
CREATE INDEX "registry_entries_visibility_idx" ON "registry_entries" USING btree ("visibility");