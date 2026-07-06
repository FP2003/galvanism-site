ALTER TABLE "gold_ledger" RENAME TO "credit_ledger";--> statement-breakpoint
ALTER TABLE "players" RENAME COLUMN "gold" TO "credits";--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT "gold_ledger_player_id_players_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_ledger" DROP CONSTRAINT "gold_ledger_created_by_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "gold_ledger_player_idx";--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_ledger_player_idx" ON "credit_ledger" USING btree ("player_id","created_at");