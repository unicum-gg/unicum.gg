CREATE TABLE IF NOT EXISTS eu_clan_snapshots (
  id serial PRIMARY KEY,
  clan_id bigint NOT NULL REFERENCES eu_clans(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  elo_t6 integer,
  skirmish_battles_t6 integer,
  skirmish_wins_t6 integer,
  elo_t8 integer,
  skirmish_battles_t8 integer,
  skirmish_wins_t8 integer,
  elo_t10 integer,
  skirmish_battles_t10 integer,
  skirmish_wins_t10 integer,
  advances_battles_t10 integer,
  advances_wins_t10 integer
);

CREATE INDEX IF NOT EXISTS eu_clan_snapshots_clan_id_taken_at_idx
  ON eu_clan_snapshots (clan_id, taken_at);

CREATE TABLE IF NOT EXISTS na_clan_snapshots (
  id serial PRIMARY KEY,
  clan_id bigint NOT NULL REFERENCES na_clans(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  elo_t6 integer,
  skirmish_battles_t6 integer,
  skirmish_wins_t6 integer,
  elo_t8 integer,
  skirmish_battles_t8 integer,
  skirmish_wins_t8 integer,
  elo_t10 integer,
  skirmish_battles_t10 integer,
  skirmish_wins_t10 integer,
  advances_battles_t10 integer,
  advances_wins_t10 integer
);

CREATE INDEX IF NOT EXISTS na_clan_snapshots_clan_id_taken_at_idx
  ON na_clan_snapshots (clan_id, taken_at);

CREATE TABLE IF NOT EXISTS asia_clan_snapshots (
  id serial PRIMARY KEY,
  clan_id bigint NOT NULL REFERENCES asia_clans(id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  elo_t6 integer,
  skirmish_battles_t6 integer,
  skirmish_wins_t6 integer,
  elo_t8 integer,
  skirmish_battles_t8 integer,
  skirmish_wins_t8 integer,
  elo_t10 integer,
  skirmish_battles_t10 integer,
  skirmish_wins_t10 integer,
  advances_battles_t10 integer,
  advances_wins_t10 integer
);

CREATE INDEX IF NOT EXISTS asia_clan_snapshots_clan_id_taken_at_idx
  ON asia_clan_snapshots (clan_id, taken_at);

