-- Per-tank server-average table columns. Hand-written (the makeXxxTable
-- factories are invisible to drizzle-kit, which would emit DROP TABLE for the
-- per-region tables). All additive + nullable, so safe to apply live.

-- tank_snapshots: raw fields for KDR / Hit% / Pen% / Blocked / Survival.
-- damage_blocked is a cumulative total (avg_damage_blocked * battles).
ALTER TABLE "eu_tank_snapshots"   ADD COLUMN IF NOT EXISTS "survived_battles" integer;
ALTER TABLE "eu_tank_snapshots"   ADD COLUMN IF NOT EXISTS "hits" integer;
ALTER TABLE "eu_tank_snapshots"   ADD COLUMN IF NOT EXISTS "shots" integer;
ALTER TABLE "eu_tank_snapshots"   ADD COLUMN IF NOT EXISTS "piercings" integer;
ALTER TABLE "eu_tank_snapshots"   ADD COLUMN IF NOT EXISTS "damage_blocked" bigint;
ALTER TABLE "na_tank_snapshots"   ADD COLUMN IF NOT EXISTS "survived_battles" integer;
ALTER TABLE "na_tank_snapshots"   ADD COLUMN IF NOT EXISTS "hits" integer;
ALTER TABLE "na_tank_snapshots"   ADD COLUMN IF NOT EXISTS "shots" integer;
ALTER TABLE "na_tank_snapshots"   ADD COLUMN IF NOT EXISTS "piercings" integer;
ALTER TABLE "na_tank_snapshots"   ADD COLUMN IF NOT EXISTS "damage_blocked" bigint;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "survived_battles" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "hits" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "shots" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "piercings" integer;
ALTER TABLE "asia_tank_snapshots" ADD COLUMN IF NOT EXISTS "damage_blocked" bigint;

-- players: lifetime account win rate (0-1), for the "Player WR" column.
ALTER TABLE "eu_players"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "na_players"   ADD COLUMN IF NOT EXISTS "winrate" real;
ALTER TABLE "asia_players" ADD COLUMN IF NOT EXISTS "winrate" real;

-- tank_stats: the extra server-average columns.
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "player_wr" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_spots" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_assist" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "kdr" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "hit_pct" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "pen_pct" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_blocked" real;
ALTER TABLE "eu_tank_stats"   ADD COLUMN IF NOT EXISTS "survival" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "player_wr" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_spots" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_assist" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "kdr" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "hit_pct" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "pen_pct" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "avg_blocked" real;
ALTER TABLE "na_tank_stats"   ADD COLUMN IF NOT EXISTS "survival" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "player_wr" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "avg_spots" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "avg_assist" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "kdr" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "hit_pct" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "pen_pct" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "avg_blocked" real;
ALTER TABLE "asia_tank_stats" ADD COLUMN IF NOT EXISTS "survival" real;
