ALTER TABLE "characters" ADD COLUMN "approved" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "energy_regen" integer DEFAULT 3 NOT NULL;