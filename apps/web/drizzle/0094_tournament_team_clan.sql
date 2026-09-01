-- The clan behind each tournament team.
--
-- Hand-written, like every migration touching the per-region tables: they are
-- built by a `makeXxxTable(region)` factory that drizzle-kit's AST analyser
-- cannot see, so generating this would emit DROP TABLE for all of them.
--
-- Purely additive. `clan_id` is denormalised onto the team rather than derived
-- on read because the clan is not stored anywhere: it is recovered by matching
-- every roster account against its clan membership on the day the tournament was
-- played. Answering "which tournaments has this clan entered" from that join
-- would mean walking every roster in the archive on each page view.
--
-- Nullable by design and not a foreign key: a team is unattributed when its
-- roster is mixed, when it splits evenly between two clans, or when we do not
-- track its accounts, and the clan itself may be one we have never mirrored.
ALTER TABLE eu_tournament_teams ADD COLUMN IF NOT EXISTS clan_id bigint;
ALTER TABLE na_tournament_teams ADD COLUMN IF NOT EXISTS clan_id bigint;
ALTER TABLE asia_tournament_teams ADD COLUMN IF NOT EXISTS clan_id bigint;

-- How many of the roster were in that clan, kept so a reader can judge how firm
-- the attribution is without recomputing it.
ALTER TABLE eu_tournament_teams ADD COLUMN IF NOT EXISTS clan_members integer;
ALTER TABLE na_tournament_teams ADD COLUMN IF NOT EXISTS clan_members integer;
ALTER TABLE asia_tournament_teams ADD COLUMN IF NOT EXISTS clan_members integer;

-- Stamped when the attribution was last computed, so a backfill can claim only
-- what it has not done and resume after an interruption. Distinct from
-- `clan_id IS NULL`, which is a real answer ("no clan") rather than "not looked
-- at yet".
ALTER TABLE eu_tournament_teams ADD COLUMN IF NOT EXISTS clan_resolved_at timestamptz;
ALTER TABLE na_tournament_teams ADD COLUMN IF NOT EXISTS clan_resolved_at timestamptz;
ALTER TABLE asia_tournament_teams ADD COLUMN IF NOT EXISTS clan_resolved_at timestamptz;

-- CONCURRENTLY so the NA backfill writing into these tables is not blocked.
-- Partial: the rows worth indexing are the attributed ones, which is what
-- "every tournament this clan entered" reads.
CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_tournament_teams_clan_id_idx
  ON eu_tournament_teams (clan_id) WHERE clan_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_tournament_teams_clan_id_idx
  ON na_tournament_teams (clan_id) WHERE clan_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_tournament_teams_clan_id_idx
  ON asia_tournament_teams (clan_id) WHERE clan_id IS NOT NULL;

-- The backfill's own claim: unstamped rows, newest tournament first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS eu_tournament_teams_clan_pending_idx
  ON eu_tournament_teams (tournament_id) WHERE clan_resolved_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS na_tournament_teams_clan_pending_idx
  ON na_tournament_teams (tournament_id) WHERE clan_resolved_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS asia_tournament_teams_clan_pending_idx
  ON asia_tournament_teams (tournament_id) WHERE clan_resolved_at IS NULL;
