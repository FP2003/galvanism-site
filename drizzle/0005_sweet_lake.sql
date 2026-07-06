CREATE TABLE "xp_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"description" text NOT NULL,
	"delta" integer NOT NULL,
	"total_xp_after" integer NOT NULL,
	"currency_xp_after" integer NOT NULL,
	"ref_code" text,
	"upgrade_id" uuid,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_upgrades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_stat" text NOT NULL,
	"amount" integer NOT NULL,
	"xp_cost" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" RENAME COLUMN "xp" TO "total_xp";--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "currency_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "characters" SET "currency_xp" = "total_xp";--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_upgrade_id_xp_upgrades_id_fk" FOREIGN KEY ("upgrade_id") REFERENCES "public"."xp_upgrades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger" ADD CONSTRAINT "xp_ledger_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "xp_ledger_character_idx" ON "xp_ledger" USING btree ("character_id","created_at");--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "level";