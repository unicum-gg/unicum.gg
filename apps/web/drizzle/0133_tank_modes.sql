-- One player's record on one vehicle in one battle mode.
--
-- `wot/tanks/stats/` has always answered a block per mode beside the `all` one
-- and we stored only `all`, so the site could say what a player did on a tank
-- and never where. This is that breakdown: Skirmishes, Advances, Global Map,
-- Grand Battles, the retired Clan, Company, Team and Ranked 10x10 ladders, and
-- the 2016 Fallout event.
--
-- CURRENT STATE, not a time series, which is what separates it from every other
-- per-tank table here. Those are keyed on a counter so a changed value inserts a
-- new row, which is what makes the profile's 24h/7d/30d columns possible. This
-- one upserts in place, and the reason is the size of what it sits beside:
-- `eu_tank_snapshots` is 411 million rows and 101 GB over roughly 290 million
-- distinct (player, vehicle) pairs, and a quarter of those pairs carry at least
-- one non-random mode (measured: 0.256 mode rows per played vehicle, over a
-- random sample of 59 tracked accounts and 9,393 vehicle rows). Keyed for
-- history this would be the second largest object in the database, to answer a
-- question nobody asked: the request was a breakdown, not a trend.
--
-- There is no `random` row, and that is also a sizing decision. `all` is
-- `random` + `clan` + `company` EXACTLY (verified across 797 vehicle rows and 18
-- counters with zero mismatches, and again against the account-level totals,
-- where the per-vehicle sums reconcile to the battle), so Random is derived from
-- the vehicle snapshot and these two. Storing it would be one row per
-- (player, vehicle) pair, ~290 million on EU against the ~74 million the ten
-- stored modes come to between them, and deriving it means the parts can never
-- add up to something other than the overall figure the rest of the site shows.
--
-- The four nullable columns are nullable because the MODE does not report them,
-- not because of an organic backfill: Wargaming answers the armour figures for
-- `fallout`, `globalmap` and the two Stronghold blocks only, and the record
-- scores for every mode except `company` and `globalmap`.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables, so this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I_tank_modes (
        player_id integer NOT NULL REFERENCES %1$I_players(id) ON DELETE CASCADE,
        tank_id integer NOT NULL,
        -- Wargaming's own key for the block ('stronghold_skirmish', 'epic',
        -- 'globalmap', ...), so the column, the query parameter and the API
        -- payload all speak the word the upstream does. See `TankBattleMode`.
        mode text NOT NULL,
        -- When the fetch these counters came from landed. Per row rather than
        -- per player: a mode a player stopped touching keeps the stamp of the
        -- last call that still saw it move.
        updated_at timestamptz NOT NULL DEFAULT now(),

        -- The eighteen counters every block Wargaming answers reports, zeroed
        -- rather than absent on a vehicle the mode was never played in.
        battles integer NOT NULL,
        wins integer NOT NULL,
        losses integer NOT NULL,
        draws integer NOT NULL,
        survived_battles integer NOT NULL,
        frags integer NOT NULL,
        damage_dealt bigint NOT NULL,
        damage_received bigint NOT NULL,
        spotted integer NOT NULL,
        capture_points integer NOT NULL,
        dropped_capture_points integer NOT NULL,
        xp bigint NOT NULL,
        hits integer NOT NULL,
        shots integer NOT NULL,
        radio_assisted_damage bigint NOT NULL,
        track_assisted_damage bigint NOT NULL,
        stun_number integer NOT NULL,
        stun_assisted_damage bigint NOT NULL,

        -- Only `fallout`, `globalmap` and the two Stronghold blocks report
        -- these three. `damage_blocked` is cumulative: Wargaming reports the
        -- per-battle average, and a total is what sums and diffs.
        piercings integer,
        damage_blocked bigint,
        -- A ratio rather than a counter, so it neither sums across vehicles nor
        -- diffs between reads. Kept as reported so the number on the page is
        -- the number in the client.
        tanking_factor real,

        -- The game's Record Score, per mode. `max_damage` is the line the top
        -- level has no equivalent for: 0 on `random` and `clan` on every row
        -- measured, absent from `company` and `globalmap`, and real everywhere
        -- else (2,142 of 2,212 rows), so the game's third record line has a
        -- source per mode and none overall. Maxima, so they survive an
        -- aggregate as a max of maxima and must never be diffed.
        max_damage integer,
        max_xp integer,
        max_frags integer,

        PRIMARY KEY (player_id, tank_id, mode)
      )
    $f$, r);
    -- The garage table asks for one player's every vehicle in one mode, which
    -- this takes straight to. The vehicle record asks for one (player, tank)
    -- across every mode, which the primary key's own prefix already serves.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %1$I_tank_modes_player_mode_idx ON %1$I_tank_modes (player_id, mode)',
      r
    );
  END LOOP;
END $$;
