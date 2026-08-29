-- When a clan's Stronghold record is next due for a sample, and the index the
-- stronghold cron claims on. The column IS the queue (same shape as
-- `players.due_at`): a restart loses nothing, because the schedule is a table
-- column rather than in-process state.
--
-- Why a new column rather than reusing `last_refreshed_at`: that one means "the
-- full clan refresh ran", and `refreshClanEvents` stamps it on any page hit,
-- crawlers included, without ever calling the Stronghold host. So the clans
-- whose pages get read the most were the ones the backfill scan considered
-- freshest, and their Stronghold data was the most frozen.
--
-- Epoch as the default makes every existing row immediately due, so the first
-- sweep seeds the real per-clan cadence from `clans/stronghold-policy`.
ALTER TABLE "eu_clans"   ADD COLUMN IF NOT EXISTS "stronghold_due_at" timestamp with time zone NOT NULL DEFAULT 'epoch';
ALTER TABLE "na_clans"   ADD COLUMN IF NOT EXISTS "stronghold_due_at" timestamp with time zone NOT NULL DEFAULT 'epoch';
ALTER TABLE "asia_clans" ADD COLUMN IF NOT EXISTS "stronghold_due_at" timestamp with time zone NOT NULL DEFAULT 'epoch';

-- Partial on live clans: a disbanded clan has nothing left to sample, and the
-- claim always filters them out.
CREATE INDEX IF NOT EXISTS "eu_clans_stronghold_due_idx"   ON "eu_clans"   ("stronghold_due_at") WHERE "is_disbanded" = false;
CREATE INDEX IF NOT EXISTS "na_clans_stronghold_due_idx"   ON "na_clans"   ("stronghold_due_at") WHERE "is_disbanded" = false;
CREATE INDEX IF NOT EXISTS "asia_clans_stronghold_due_idx" ON "asia_clans" ("stronghold_due_at") WHERE "is_disbanded" = false;

-- Seed the cadence from what we already know, so the first sweep is not an
-- undifferentiated 126k-clan stampede: a clan we sampled recently and that has
-- no battle history at all can wait, everything else goes to the front.
-- Mirrors STRONGHOLD_CADENCE_MS; the first real fetch overwrites it.
UPDATE "eu_clans" c SET "stronghold_due_at" = s.taken_at + interval '14 days'
FROM (
  SELECT DISTINCT ON (clan_id) clan_id, taken_at,
    COALESCE(skirmish_battles_t6, 0) + COALESCE(skirmish_battles_t8, 0)
    + COALESCE(skirmish_battles_t10, 0) + COALESCE(advances_battles_t10, 0) AS battles
  FROM "eu_clan_snapshots" ORDER BY clan_id, taken_at DESC
) s
WHERE s.clan_id = c.id AND s.battles = 0;

UPDATE "na_clans" c SET "stronghold_due_at" = s.taken_at + interval '14 days'
FROM (
  SELECT DISTINCT ON (clan_id) clan_id, taken_at,
    COALESCE(skirmish_battles_t6, 0) + COALESCE(skirmish_battles_t8, 0)
    + COALESCE(skirmish_battles_t10, 0) + COALESCE(advances_battles_t10, 0) AS battles
  FROM "na_clan_snapshots" ORDER BY clan_id, taken_at DESC
) s
WHERE s.clan_id = c.id AND s.battles = 0;

UPDATE "asia_clans" c SET "stronghold_due_at" = s.taken_at + interval '14 days'
FROM (
  SELECT DISTINCT ON (clan_id) clan_id, taken_at,
    COALESCE(skirmish_battles_t6, 0) + COALESCE(skirmish_battles_t8, 0)
    + COALESCE(skirmish_battles_t10, 0) + COALESCE(advances_battles_t10, 0) AS battles
  FROM "asia_clan_snapshots" ORDER BY clan_id, taken_at DESC
) s
WHERE s.clan_id = c.id AND s.battles = 0;
