-- What each battle mode pays at each tier, rebuilt hourly from *_battles by
-- the player-distribution cron (`@unicum.gg/core/battles/mode-economy`), read
-- by the servers page.
--
-- Additive only, written by hand (the schema factory pattern makes drizzle-kit
-- blind to per-region tables). The table fills on the cron's next pass.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %1$I_mode_economy (
        mode text NOT NULL,
        tier smallint NOT NULL,
        window_days integer NOT NULL,
        battles integer NOT NULL,
        records integer NOT NULL,
        players integer NOT NULL,
        wins integer NOT NULL,
        credits bigint NOT NULL,
        xp bigint NOT NULL,
        seconds bigint NOT NULL,
        net_records integer NOT NULL,
        net_players integer NOT NULL,
        net_gross bigint NOT NULL,
        net_costs bigint NOT NULL,
        computed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (mode, tier)
      )
    $sql$, r);
  END LOOP;
END $$;
