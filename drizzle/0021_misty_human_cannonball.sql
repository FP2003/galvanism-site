CREATE TYPE "public"."ballot_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "ballot_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballot_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "ballot_status" DEFAULT 'open' NOT NULL,
	"ops_deadline" integer,
	"closed_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ballot_options" ADD CONSTRAINT "ballot_options_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_votes" ADD CONSTRAINT "ballot_votes_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_votes" ADD CONSTRAINT "ballot_votes_option_id_ballot_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."ballot_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballot_votes" ADD CONSTRAINT "ballot_votes_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ballot_options_ballot_idx" ON "ballot_options" USING btree ("ballot_id");--> statement-breakpoint
CREATE INDEX "ballot_votes_ballot_idx" ON "ballot_votes" USING btree ("ballot_id");--> statement-breakpoint
CREATE INDEX "ballot_votes_option_idx" ON "ballot_votes" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ballot_votes_unique" ON "ballot_votes" USING btree ("ballot_id","character_id");--> statement-breakpoint
CREATE INDEX "ballots_status_idx" ON "ballots" USING btree ("status");