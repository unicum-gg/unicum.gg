-- Wins over the three recent windows, beside the battles already counted there.
--
-- The snapshot pipeline already sums them: `periodRating` reduces the diffed
-- tank rows into an aggregate whose `wins` feeds WN7, and then drops it. So
-- these columns cost the pipeline nothing beyond three more values in a write
-- it was making anyway.
--
-- They exist because a window's win rate is `wins / battles` over ONE diff of
-- the snapshots, and there was no way to ask for one. Recovering the wins
-- separately means walking the snapshots again, at a later instant, over a
-- window that has since slid: measured on `_Winnie`, the stored 30-day battle
-- count was 315 while the same diff recomputed a day later gave 265, because
-- the games played thirty days before the earlier instant had left the window.
-- Both are right about their own instant, which is exactly why a win rate taken
-- from one and a rating taken from the other must never be printed side by side.
--
-- Purely additive and nullable, so it is safe to apply while the app is
-- serving, and each row fills on its account's next snapshot rather than by a
-- backfill: the value only exists as a diff against history we do not re-walk.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu', 'na', 'asia'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "wins_30d" integer', r || '_players');
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "wins_24h" integer', r || '_players');
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "wins_7d" integer', r || '_players');
  END LOOP;
END $$;
