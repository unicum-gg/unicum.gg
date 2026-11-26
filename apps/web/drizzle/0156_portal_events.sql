-- Every entry the portal's events widget has ever shown, one table per region.
--
-- The widget is the home page's "This week's highlights" on worldoftanks.<tld>
-- and holds the current week only: an entry leaves the page a day or so after it
-- ends and nothing upstream keeps it. So the calendar's past exists only because
-- this table recorded it, and it cannot be backfilled.
--
-- Keyed on the article path (the link without its language segment, which ties
-- one entry together across the widget's languages) and the start (which tells
-- apart two entries under one article). A start Wargaming moves later marks the
-- old row superseded_at instead of leaving both.
--
-- Additive CREATE TABLE only, written by hand (the schema factory pattern makes
-- drizzle-kit blind to these tables, see AGENTS.md).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_portal_events (
        path text NOT NULL,
        start_at timestamptz NOT NULL,
        end_at timestamptz NOT NULL,
        title text NOT NULL,
        titles jsonb NOT NULL,
        category text NOT NULL,
        color text NOT NULL,
        icon text NOT NULL,
        link text NOT NULL,
        thumbnail text,
        banner text,
        edited_at timestamptz,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        superseded_at timestamptz,
        discord_event_id text,
        discord_message_id text,
        discord_synced_hash text,
        CONSTRAINT %I_portal_events_pkey PRIMARY KEY (path, start_at)
      )
    $f$, r, r);
    -- The calendar reads a time window, on the end as much as the start: an
    -- entry running for three months belongs to every month it spans.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_portal_events_window_idx
        ON %I_portal_events (start_at, end_at)
    $f$, r, r);
  END LOOP;
END $$;
