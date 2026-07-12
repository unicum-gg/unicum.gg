CREATE TABLE "streamers" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"account_id" bigint NOT NULL,
	"twitch_login" text NOT NULL,
	"twitch_user_id" text,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "streamers_twitch_login_idx" ON "streamers" USING btree ("twitch_login");
--> statement-breakpoint
-- Curated seed: known EU streamers (verified=false; ownership not proven).
INSERT INTO "streamers" ("id", "region", "account_id", "twitch_login", "verified") VALUES
	('eu-537793577', 'eu', 537793577, 'iyouxin', false),
	('eu-601419678', 'eu', 601419678, 'dakillzor', false),
	('eu-528062536', 'eu', 528062536, 'mishulika12', false),
	('eu-603797246', 'eu', 603797246, 'cyganzor', false)
ON CONFLICT ("id") DO NOTHING;
