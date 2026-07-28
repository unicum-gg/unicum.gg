-- Append-only log of activated Stronghold reserves (WG has no reserve-activation
-- history, so the worker records its own). One row per activated reserve, read
-- by the officer console's "recent activations" panel. Additive CREATE TABLE
-- only (hand-written; the factory pattern hides these from drizzle-kit).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_clan_boost_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clan_id bigint NOT NULL,
        workflow_id uuid,
        workflow_name text NOT NULL DEFAULT '',
        reserve_type text NOT NULL,
        reserve_name text NOT NULL,
        reserve_level integer NOT NULL,
        percent integer,
        online_count integer NOT NULL,
        activated_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_clan_boost_log_clan_idx
        ON %I_clan_boost_log (clan_id, activated_at)
    $f$, r, r);
  END LOOP;
END $$;
