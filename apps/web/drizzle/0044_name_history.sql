-- Player + clan name history. WG exposes no rename history, so these only fill
-- going forward: a BEFORE UPDATE trigger on each per-region players/clans table
-- appends the OLD name whenever a refresh writes a different one. Hand-written
-- (db:generate can't see the makeXxxTable factory tables, and triggers aren't
-- modelled by drizzle at all).

-- Players --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "eu_player_name_history" (
  "id" serial PRIMARY KEY,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eu_player_name_history_account_id_idx" ON "eu_player_name_history" ("account_id");

CREATE TABLE IF NOT EXISTS "na_player_name_history" (
  "id" serial PRIMARY KEY,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "na_player_name_history_account_id_idx" ON "na_player_name_history" ("account_id");

CREATE TABLE IF NOT EXISTS "asia_player_name_history" (
  "id" serial PRIMARY KEY,
  "account_id" bigint NOT NULL,
  "nickname" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "asia_player_name_history_account_id_idx" ON "asia_player_name_history" ("account_id");

-- One shared function; the target history table is passed as a trigger argument
-- so a single definition serves all three regions.
CREATE OR REPLACE FUNCTION record_player_name_change() RETURNS trigger AS $$
BEGIN
  EXECUTE format(
    'INSERT INTO %I (account_id, nickname, recorded_at) VALUES ($1, $2, now())',
    TG_ARGV[0]
  ) USING OLD.account_id, OLD.nickname;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "eu_player_name_change" ON "eu_players";
CREATE TRIGGER "eu_player_name_change" BEFORE UPDATE ON "eu_players"
  FOR EACH ROW WHEN (OLD.nickname IS DISTINCT FROM NEW.nickname)
  EXECUTE FUNCTION record_player_name_change('eu_player_name_history');

DROP TRIGGER IF EXISTS "na_player_name_change" ON "na_players";
CREATE TRIGGER "na_player_name_change" BEFORE UPDATE ON "na_players"
  FOR EACH ROW WHEN (OLD.nickname IS DISTINCT FROM NEW.nickname)
  EXECUTE FUNCTION record_player_name_change('na_player_name_history');

DROP TRIGGER IF EXISTS "asia_player_name_change" ON "asia_players";
CREATE TRIGGER "asia_player_name_change" BEFORE UPDATE ON "asia_players"
  FOR EACH ROW WHEN (OLD.nickname IS DISTINCT FROM NEW.nickname)
  EXECUTE FUNCTION record_player_name_change('asia_player_name_history');

-- Clans ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "eu_clan_name_history" (
  "id" serial PRIMARY KEY,
  "clan_id" bigint NOT NULL,
  "tag" text NOT NULL,
  "name" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "eu_clan_name_history_clan_id_idx" ON "eu_clan_name_history" ("clan_id");

CREATE TABLE IF NOT EXISTS "na_clan_name_history" (
  "id" serial PRIMARY KEY,
  "clan_id" bigint NOT NULL,
  "tag" text NOT NULL,
  "name" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "na_clan_name_history_clan_id_idx" ON "na_clan_name_history" ("clan_id");

CREATE TABLE IF NOT EXISTS "asia_clan_name_history" (
  "id" serial PRIMARY KEY,
  "clan_id" bigint NOT NULL,
  "tag" text NOT NULL,
  "name" text NOT NULL,
  "recorded_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "asia_clan_name_history_clan_id_idx" ON "asia_clan_name_history" ("clan_id");

CREATE OR REPLACE FUNCTION record_clan_name_change() RETURNS trigger AS $$
BEGIN
  EXECUTE format(
    'INSERT INTO %I (clan_id, tag, name, recorded_at) VALUES ($1, $2, $3, now())',
    TG_ARGV[0]
  ) USING OLD.id, OLD.tag, OLD.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "eu_clan_name_change" ON "eu_clans";
CREATE TRIGGER "eu_clan_name_change" BEFORE UPDATE ON "eu_clans"
  FOR EACH ROW WHEN (OLD.tag IS DISTINCT FROM NEW.tag OR OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION record_clan_name_change('eu_clan_name_history');

DROP TRIGGER IF EXISTS "na_clan_name_change" ON "na_clans";
CREATE TRIGGER "na_clan_name_change" BEFORE UPDATE ON "na_clans"
  FOR EACH ROW WHEN (OLD.tag IS DISTINCT FROM NEW.tag OR OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION record_clan_name_change('na_clan_name_history');

DROP TRIGGER IF EXISTS "asia_clan_name_change" ON "asia_clans";
CREATE TRIGGER "asia_clan_name_change" BEFORE UPDATE ON "asia_clans"
  FOR EACH ROW WHEN (OLD.tag IS DISTINCT FROM NEW.tag OR OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION record_clan_name_change('asia_clan_name_history');
