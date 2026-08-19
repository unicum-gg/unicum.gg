-- Per-tank lifecycle from the wot-src mirror history: when a tank first appeared
-- as a dev stub (placeholder stats, before balancing) and when it was released
-- (its first real, playable stats). Global (WG balances vehicles the same
-- everywhere), keyed by tank_id. Populated by the spec-history backfill and kept
-- up to date by the forward cron. Either pair is null when the event predates
-- our version tracking (the mirror only goes back to ~2021-07). Hand-written for
-- the same reason as 0083 (the factory-table reconcile guard).
CREATE TABLE IF NOT EXISTS "tank_introductions" (
  "tank_id" bigint PRIMARY KEY NOT NULL,
  "dev_version" text,
  "dev_at" timestamp with time zone,
  "released_version" text,
  "released_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
