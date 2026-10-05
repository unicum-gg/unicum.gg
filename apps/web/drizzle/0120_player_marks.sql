-- How many Marks of Excellence a player holds, by level and by tier: one row
-- per account, written the moment we read their marks from the WoT portal.
--
-- It is denormalised because the marks themselves live in `*_tank_snapshots`
-- and a count per player needs the LATEST snapshot of every vehicle they own,
-- which is a walk of the largest table we have (411M rows, 85 GB on EU). The
-- one job licensed to make that walk, `top-players-by-tank`, cannot be the
-- source either: it filters `battles >= 100`, while a mark is earned on a
-- rolling window of recent battles rather than on a career, so that floor drops
-- about a fifth of the three-mark guns on a garage and drops them UNEVENLY by
-- tier. Measured on EU: 10.2% lost at tier X, 35.3% at tier XI, 53.3% at tier
-- V. The board this feeds exists to publish the per-tier split, so it cannot be
-- built on a per-tier bias, and widening the walk is not the answer either
-- (only 35.6% of snapshot rows pass the floor, so dropping it triples the heap
-- fetches of the heaviest nightly job we run).
--
-- So the writer is the portal refresh. `fetchPlayerMarksOnGun` already returns
-- every vehicle the player has fought a battle in, with no floor of any kind,
-- and it is the only moment a mark can move in our data, so counting there is
-- both free and exact: this table and the profile page cannot disagree.
--
-- The cost is coverage, and it belongs to the data rather than to this table.
-- The portal is capped at ~1 request/second/region, so marks are only read on
-- an on-demand (page-view) refresh: about 19% of EU accounts over a thousand
-- battles carry any, and 3.1% carry at least one three-mark gun. An account
-- nobody has looked up is ABSENT here rather than present with a zero, and
-- every surface says so rather than implying a complete ranking.
--
-- Additive CREATE TABLE only, no per-region DROP (the schema factory pattern
-- makes drizzle-kit blind to these tables, so this is written by hand).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_player_marks (
        account_id bigint PRIMARY KEY,
        -- Vehicles at each mark level, by tier, index 1 holding tier 1.
        -- Arrays rather than a column per tier because the tiers are
        -- Wargaming's to extend, as tier XI already showed, and 33 columns
        -- would make that a migration instead of a longer array. Trailing
        -- zeroes are trimmed by the writer.
        marks_1_by_tier integer[] NOT NULL DEFAULT '{}',
        marks_2_by_tier integer[] NOT NULL DEFAULT '{}',
        marks_3_by_tier integer[] NOT NULL DEFAULT '{}',
        -- The same tallies summed. Stored rather than derived because the
        -- board's whole ordering is `ORDER BY marks_3_total DESC`, and summing
        -- an array per row to sort forty thousand of them is the read this
        -- table exists to avoid.
        marks_1_total integer NOT NULL DEFAULT 0,
        marks_2_total integer NOT NULL DEFAULT 0,
        marks_3_total integer NOT NULL DEFAULT 0,
        -- Vehicles a mark level was known for, this row's own denominator. It
        -- separates "no marks" from "a garage we have only partly read", the
        -- role `observed` plays for the activity series.
        known integer NOT NULL DEFAULT 0,
        -- Inferred from the account's clan history, exactly as the by-language
        -- player board infers it, so one account cannot be French on one board
        -- and German on another. Filled by the hourly pass rather than at write
        -- time: a clan stint moves on a schedule of its own, with nothing to do
        -- with whether a mark was earned.
        languages text[] NOT NULL DEFAULT '{}',
        -- When the PORTAL answered, not when the row was written. A mark cannot
        -- change in our data without a portal read, so this is exactly how
        -- fresh the counts are, and it is what the page prints beside them.
        measured_at timestamptz NOT NULL DEFAULT now()
      )
    $f$, r);

    -- The board's ordering. Partial, because an account with no three-mark gun
    -- is never on the board and most of the table is exactly that.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_player_marks_3_total_idx
        ON %I_player_marks (marks_3_total DESC)
        WHERE marks_3_total > 0
    $f$, r, r);

    -- The language filter's predicate, as on `*_player_ratings`: GIN serves the
    -- `$lang = ANY(languages)` containment.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_player_marks_languages_idx
        ON %I_player_marks USING gin (languages)
    $f$, r, r);
  END LOOP;
END $$;
