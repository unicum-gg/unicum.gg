-- Where players set up on a map and where they deal their damage from, read
-- out of the archived replays, for the map page's minimap.
--
-- Two tables per region:
--   *_battle_spots  one row per vehicle of the recording player's team: the
--                   first place it held after the opening rush, and how its
--                   battle went (damage, kills, survived, won);
--   *_battle_hits   one row per shot that team landed, placed where it was
--                   fired from, with the damage it did.
-- The recording player's team only, since an enemy is known only while
-- spotted. Positions are minimap percentages in the layout's own box.
--
-- Additive only, no per-region DROP (the schema factory pattern makes
-- drizzle-kit blind to these tables, so this is written by hand). The tables
-- fill from the next uploaded replay; what the archive already holds is read
-- by `POST /api/cron/backfill-battle-positions`.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I_battle_spots (
        arena_unique_id text NOT NULL,
        started_at timestamptz NOT NULL,
        map_name text NOT NULL,
        battle_type smallint NOT NULL,
        gameplay_id text NOT NULL,
        vehicle_id bigint NOT NULL,
        team smallint NOT NULL,
        tank_id integer NOT NULL,
        vehicle_class text NOT NULL,
        settled_at real NOT NULL,
        "left" real NOT NULL,
        top real NOT NULL,
        damage integer NOT NULL,
        kills smallint NOT NULL,
        survived boolean NOT NULL,
        won boolean NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (arena_unique_id, vehicle_id)
      )$sql$, r);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %1$I_battle_spots_map_idx ON %1$I_battle_spots (map_name, battle_type, started_at)', r);
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I_battle_hits (
        arena_unique_id text NOT NULL,
        started_at timestamptz NOT NULL,
        map_name text NOT NULL,
        battle_type smallint NOT NULL,
        gameplay_id text NOT NULL,
        at real NOT NULL,
        victim_id bigint NOT NULL,
        attacker_id bigint NOT NULL,
        team smallint NOT NULL,
        tank_id integer NOT NULL,
        vehicle_class text NOT NULL,
        "left" real NOT NULL,
        top real NOT NULL,
        damage integer NOT NULL,
        fatal boolean NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (arena_unique_id, victim_id, attacker_id, at)
      )$sql$, r);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %1$I_battle_hits_map_idx ON %1$I_battle_hits (map_name, battle_type, started_at)', r);
  END LOOP;
END $$;
