-- Rename clan_discovery_queue → clan_refresh_queue + add first_seen flag.
-- Existing rows are first-time discoveries, so they keep first_seen=true.
-- Future inserts default to false; the enqueue helpers set true explicitly
-- when they're a brand-new discovery (vs. a periodic refresh).
ALTER TABLE "clan_discovery_queue" RENAME TO "clan_refresh_queue";
--> statement-breakpoint
ALTER TABLE "clan_refresh_queue" RENAME CONSTRAINT "clan_discovery_queue_region_clan_id_pk" TO "clan_refresh_queue_region_clan_id_pk";
--> statement-breakpoint
ALTER INDEX "clan_discovery_queue_queued_at_idx" RENAME TO "clan_refresh_queue_queued_at_idx";
--> statement-breakpoint
ALTER TABLE "clan_refresh_queue" ADD COLUMN "first_seen" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "clan_refresh_queue" SET "first_seen" = true;
--> statement-breakpoint

-- Brand-new queue for player refreshes. User visits push high-priority
-- entries; cron-driven backfills sit at priority 0. Snapshot cron drains
-- this first, then falls back to its existing oldest-snapshot scan.
CREATE TABLE "player_refresh_queue" (
	"region" text NOT NULL,
	"account_id" bigint NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "player_refresh_queue_region_account_id_pk" PRIMARY KEY("region","account_id")
);
--> statement-breakpoint
CREATE INDEX "player_refresh_queue_priority_queued_at_idx" ON "player_refresh_queue" USING btree ("priority","queued_at");
