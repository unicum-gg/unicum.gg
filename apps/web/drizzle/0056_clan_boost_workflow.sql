-- Stronghold-reserve boost workflows. A clan can have several (own `id` PK,
-- clan_id is just an indexed column), so an officer can run different rules at
-- different times. The worker's clan-boosts-<region> job reads the live online
-- roster (clans/info extra private.online_members) with the owner officer's
-- stored WG token and activates the configured reserves inside the window.
-- Additive CREATE TABLE only, no per-region DROP of OTHER tables (the schema
-- factory pattern makes drizzle-kit blind to these; hand-written like 0054).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_clan_boost_workflow (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clan_id bigint NOT NULL,
        owner_user_id text NOT NULL,
        owner_account_id bigint NOT NULL,
        name text NOT NULL DEFAULT '',
        enabled boolean NOT NULL DEFAULT true,
        timezone text NOT NULL DEFAULT 'Europe/Paris',
        days smallint NOT NULL DEFAULT 127,
        window_start integer NOT NULL,
        window_end integer NOT NULL,
        min_online integer NOT NULL DEFAULT 10,
        reserves jsonb NOT NULL DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'ok',
        last_error text,
        last_online_count integer,
        last_checked_at timestamptz,
        last_activated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_clan_boost_workflow_clan_idx
        ON %I_clan_boost_workflow (clan_id)
    $f$, r, r);
  END LOOP;
END $$;
