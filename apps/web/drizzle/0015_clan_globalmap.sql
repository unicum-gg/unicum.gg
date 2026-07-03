ALTER TABLE eu_clan_snapshots
  ADD COLUMN IF NOT EXISTS gm_elo_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_provinces integer;

ALTER TABLE na_clan_snapshots
  ADD COLUMN IF NOT EXISTS gm_elo_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_provinces integer;

ALTER TABLE asia_clan_snapshots
  ADD COLUMN IF NOT EXISTS gm_elo_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t10 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t8 integer,
  ADD COLUMN IF NOT EXISTS gm_elo_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_battles_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_wins_t6 integer,
  ADD COLUMN IF NOT EXISTS gm_provinces integer;

