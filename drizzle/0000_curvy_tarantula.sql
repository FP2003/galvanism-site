CREATE TYPE "public"."character_status" AS ENUM('active', 'standby', 'injured', 'kia');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'player');--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"callsign" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"rank" text,
	"role" text,
	"status" character_status DEFAULT 'standby' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"hp_current" integer DEFAULT 0 NOT NULL,
	"hp_max" integer DEFAULT 0 NOT NULL,
	"energy_current" integer DEFAULT 0 NOT NULL,
	"energy_max" integer DEFAULT 0 NOT NULL,
	"ammo_current" integer DEFAULT 0 NOT NULL,
	"ammo_max" integer DEFAULT 0 NOT NULL,
	"stat_tech" integer DEFAULT 0 NOT NULL,
	"stat_precision" integer DEFAULT 0 NOT NULL,
	"stat_strength" integer DEFAULT 0 NOT NULL,
	"stat_immunity" integer DEFAULT 0 NOT NULL,
	"stat_resilience" integer DEFAULT 0 NOT NULL,
	"stat_agility" integer DEFAULT 0 NOT NULL,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_player_id_unique" UNIQUE("player_id"),
	CONSTRAINT "characters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"gold" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_status_idx" ON "characters" USING btree ("status");