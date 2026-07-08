CREATE TYPE "public"."mission_assignment_state" AS ENUM('interested', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."mission_risk" AS ENUM('low', 'moderate', 'high', 'severe');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('available', 'active', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "mission_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"state" "mission_assignment_state" DEFAULT 'interested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"sector" text,
	"briefing" text,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"payout_credits" integer DEFAULT 0 NOT NULL,
	"risk" "mission_risk" DEFAULT 'low' NOT NULL,
	"status" "mission_status" DEFAULT 'available' NOT NULL,
	"permanent" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"urgent" boolean DEFAULT false NOT NULL,
	"urgent_deadline" integer,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_assignments_mission_idx" ON "mission_assignments" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "mission_assignments_character_idx" ON "mission_assignments" USING btree ("character_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mission_assignments_unique" ON "mission_assignments" USING btree ("mission_id","character_id");--> statement-breakpoint
CREATE INDEX "missions_status_idx" ON "missions" USING btree ("status");