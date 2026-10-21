-- One account's record in a battle mode nobody can play any more.
--
-- `account/info` answers a block per mode and five of them had no home: the
-- pre-Stronghold Clan Battles, Tank Company, the Team Battles ladder and its
-- unranked sibling, and Historical Battles. All five come back on every call we
-- already make, without being asked for as an `extra`, and all five carry the
-- same shape as the eight modes the profile already shows. They were simply
-- never read.
--
-- A ROW PER PLAYER, not a column set on every snapshot, which is where the
-- eight live modes live. The reason is the one thing these five have in common:
-- their totals are finished. `eu_player_snapshots` is 111 columns, 23 million
-- rows and 14 GB, and it exists to be DIFFED, which is what gives the live
-- modes their 24h/7d/30d columns. Fifty-five more columns there would add
-- around 7 GB to repeat a number that never moves again, so that the periods
-- computed from them could come out zero every time. Here it is a couple of
-- million narrow rows, and only for the accounts that actually played these.
--
-- The consequence is deliberate and visible: a mode here has a total and no
-- periods. That is not a gap waiting to be filled, it is what a finished record
-- looks like.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables, so this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I_player_archived_modes (
        player_id integer NOT NULL REFERENCES %1$I_players(id) ON DELETE CASCADE,
        -- Wargaming's own name for the block ('clan', 'company', 'team',
        -- 'regular_team', 'historical'). See `PlayerArchivedMode`.
        mode text NOT NULL,
        -- When the call these came from landed. They should never move again,
        -- so a stamp that does is worth noticing.
        updated_at timestamptz NOT NULL DEFAULT now(),

        -- The counters every mode panel on the profile already renders
        -- (`StrongholdStats`), so the same table draws these with no second
        -- component.
        battles integer NOT NULL,
        wins integer NOT NULL,
        losses integer NOT NULL,
        draws integer NOT NULL,
        survived_battles integer NOT NULL,
        frags integer NOT NULL,
        damage_dealt bigint NOT NULL,
        spotted integer NOT NULL,
        capture_points integer NOT NULL,
        dropped_capture_points integer NOT NULL,
        battle_avg_xp integer NOT NULL,

        PRIMARY KEY (player_id, mode)
      )
    $f$, r);
  END LOOP;
END $$;
