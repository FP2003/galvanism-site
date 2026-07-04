CREATE TABLE "gold_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"description" text NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"ref_code" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gold_ledger" ADD CONSTRAINT "gold_ledger_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gold_ledger" ADD CONSTRAINT "gold_ledger_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gold_ledger_player_idx" ON "gold_ledger" USING btree ("player_id","created_at");