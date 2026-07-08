ALTER TABLE "missions" ADD COLUMN "expiry_deadline" integer;--> statement-breakpoint
ALTER TABLE "missions" DROP COLUMN "expires_at";