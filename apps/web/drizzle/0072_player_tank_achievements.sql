-- The game's per-vehicle "Awards" tab, stored instead of fetched on every view.
--
-- One row per player holding every vehicle they earned something on, because
-- `tanks/achievements` answers for a whole account in one call: splitting that
-- into a row per (player, vehicle) would turn one response into a couple of
-- hundred rows and the table into ~400M of them, to serve a panel that reads
-- exactly one vehicle. The nested `jsonb` is sparse on both levels.
--
-- Written by hand for the same reason as 0070/0071: `drizzle-kit` cannot see
-- tables built by a `makeXxxTable(region)` factory (see AGENTS.md).
CREATE TABLE IF NOT EXISTS "eu_player_tank_achievements" (
	"player_id" integer PRIMARY KEY NOT NULL REFERENCES "eu_players"("id") ON DELETE CASCADE,
	"counts" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "eu_player_tank_achievements_updated_idx" ON "eu_player_tank_achievements" ("updated_at");

CREATE TABLE IF NOT EXISTS "na_player_tank_achievements" (
	"player_id" integer PRIMARY KEY NOT NULL REFERENCES "na_players"("id") ON DELETE CASCADE,
	"counts" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "na_player_tank_achievements_updated_idx" ON "na_player_tank_achievements" ("updated_at");

CREATE TABLE IF NOT EXISTS "asia_player_tank_achievements" (
	"player_id" integer PRIMARY KEY NOT NULL REFERENCES "asia_players"("id") ON DELETE CASCADE,
	"counts" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "asia_player_tank_achievements_updated_idx" ON "asia_player_tank_achievements" ("updated_at");
