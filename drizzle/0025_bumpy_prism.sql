ALTER TABLE "characters" ADD COLUMN "movement_base" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "movement_ep_spent" integer DEFAULT 0 NOT NULL;