-- A player's Skirmish totals at one tier, each time they moved.
--
-- `*_tank_modes` is current state on purpose (see 0133), so the profile's
-- Skirmish split by tier had a lifetime figure and nothing to diff for its
-- 24h/7d/30d columns. This is the one history that split needs, kept at the
-- grain it is read at: per (player, tier) rather than per vehicle, and a row
-- only when that tier's battle count changed. A player who never plays a
-- skirmish adds nothing; one who does adds at most a row per refresh that saw
-- them play it.
--
-- `tier` 0 holds the battles on vehicles of any tier but 6, 8, 10 and 11 (the
-- formats Skirmishes had before they were fought at one tier), since a primary
-- key column cannot be null.
--
-- The history starts here and cannot be backfilled: there is no earlier state
-- of `*_tank_modes` to read. `pnpm --filter @unicum.gg/worker
-- seed-skirmish-tier-history` writes the first row of every player from the
-- current breakdown right after the deploy, so the windows start filling then
-- rather than on each player's next skirmish.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables, so this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %1$I_player_skirmish_tiers (
        player_id integer NOT NULL REFERENCES %1$I_players(id) ON DELETE CASCADE,
        tier smallint NOT NULL,
        taken_at timestamptz NOT NULL DEFAULT now(),
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
        xp bigint NOT NULL,
        -- The read asks for one player's newest row per tier at or before an
        -- instant, which this order answers directly.
        PRIMARY KEY (player_id, tier, taken_at)
      )
    $f$, r);
  END LOOP;
END $$;
