-- Per-clan Discord destination for boost activation notifications. Our bot posts
-- there directly (no webhook). Additive CREATE TABLE only (hand-written; factory
-- pattern hides these from drizzle-kit).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_clan_boost_discord (
        clan_id bigint PRIMARY KEY,
        guild_id text NOT NULL,
        channel_id text NOT NULL,
        guild_name text NOT NULL DEFAULT '',
        channel_name text NOT NULL DEFAULT '',
        set_by_user_id text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);
  END LOOP;
END $$;
