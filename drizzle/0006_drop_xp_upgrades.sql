ALTER TABLE "xp_upgrades" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "xp_upgrades" CASCADE;--> statement-breakpoint
ALTER TABLE "xp_ledger" DROP CONSTRAINT "xp_ledger_upgrade_id_xp_upgrades_id_fk";
--> statement-breakpoint
ALTER TABLE "xp_ledger" DROP COLUMN "upgrade_id";