-- Every entry of the "WoT Monthly" articles' calendars, one table per region.
--
-- The calendar page's second source beside *_portal_events: richer (tournaments,
-- livestreams, national days) but dated by the day, and kept online by
-- Wargaming after its month, so it is backfilled to March 2025.
--
-- Keyed on the month, the first day and the English title: Wargaming adds
-- entries through the month, which shifts positions, and one month can carry
-- the same title twice. An entry missing from a later read of its own month is
-- marked removed_at rather than deleted.
--
-- Additive CREATE TABLE only, written by hand (see AGENTS.md).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_portal_monthly_events (
        period text NOT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        title text NOT NULL,
        titles jsonb NOT NULL,
        descriptions jsonb NOT NULL,
        position integer NOT NULL,
        category text NOT NULL,
        color text NOT NULL,
        icon text NOT NULL,
        image text,
        link text,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        removed_at timestamptz,
        CONSTRAINT %I_portal_monthly_events_pkey PRIMARY KEY (period, start_date, title)
      )
    $f$, r, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_portal_monthly_events_window_idx
        ON %I_portal_monthly_events (start_date, end_date)
    $f$, r, r);
  END LOOP;
END $$;
