-- Tier XI Skirmish totals on the clan snapshots. Nullable with no default, so
-- each ALTER is a catalog change and rewrites nothing.
ALTER TABLE "eu_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_battles_t11" integer;
ALTER TABLE "eu_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_wins_t11" integer;
--> statement-breakpoint
ALTER TABLE "na_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_battles_t11" integer;
ALTER TABLE "na_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_wins_t11" integer;
--> statement-breakpoint
ALTER TABLE "asia_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_battles_t11" integer;
ALTER TABLE "asia_clan_snapshots" ADD COLUMN IF NOT EXISTS "skirmish_wins_t11" integer;
