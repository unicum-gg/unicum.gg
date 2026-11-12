-- A partial index for `carryForwardMarks`, the single heaviest query we run.
--
-- WHAT IT IS FOR
-- `carryForwardMarks` (`@unicum.gg/core/players`, called on the bulk path of
-- every snapshot write) asks for the newest non-null Marks of Excellence per
-- tank for one player. Measured over a clean 15-minute window on 2026-11-12,
-- it was 20.3% of the whole database: 6,347 calls at 78.3ms.
--
-- It is slow because no index carries `marks_on_gun`. The planner falls back to
-- the primary key `(player_id, tank_id, battles)`, which finds the player's rows
-- and then fetches EVERY ONE of them from the heap to test the column. Eight
-- accounts the pipeline had just processed examined 7,291 rows to keep 1,456, so
-- 80% of the heap fetches are thrown away, and five of the eight walked their
-- whole history to return nothing. That is the shape of the data rather than an
-- accident: 73.2% of the column is null and only about a fifth of accounts carry
-- a mark at all.
--
-- WHY THESE COLUMNS, IN THIS ORDER
-- They are exactly the query's own ordering, so `DISTINCT ON (tank_id)` is
-- answered by walking the index and taking the first entry per tank, with no
-- sort. `battles` is in the key rather than merely included because it is the
-- tie-break for rows sharing a `taken_at` (a bulk insert stamps one `now()`
-- across the whole chunk), and a tie-break the index cannot express would put
-- the sort back. `marks_on_gun` rides along as INCLUDE so the scan needs no
-- heap at all.
--
-- The predicate is the broader `IS NOT NULL` rather than the query's
-- `BETWEEN 0 AND 3`. A partial index is usable whenever its predicate is implied
-- by the query, so the broader one still matches, and it stays correct if that
-- legacy guard is ever dropped. It costs nothing: no value outside 0..3 was
-- found in a 480,000-row sample.
--
-- WHAT IT COST AND WHAT IT BOUGHT
-- Applied 2026-11-12 at EU evening peak, deliberately, after the owner chose
-- that over the quiet window. Far cheaper than feared: the host went from load
-- 16.7 at 46% disk to a peak of 21.5 at 62%, and came back to 16.5 at 46%.
--
--            build     size      mean before -> after
--   asia       42s    452 MB      81.0ms  ->  24.3ms
--   na         77s    836 MB     162.9ms  ->  35.1ms
--   eu     8min36s   5030 MB      62.7ms  ->  20.4ms
--
-- Each mean is a window of this evening's own traffic rather than a lifetime
-- average, so the two sides are the same hour and the same cold caches. The
-- plan is now an Index Only Scan with no sort: one account that examined 2,325
-- rows to keep 30 reads 30.
--
-- `Heap Fetches` is not yet zero, because the visibility map has not caught up
-- on pages this index now reads. Autovacuum settles that on its own and the
-- scan gets cheaper again, and nothing needs doing.
--
-- CONCURRENTLY CANNOT RUN INSIDE A TRANSACTION, so apply this file with plain
-- `psql -f`, never wrapped in BEGIN/COMMIT and never with `psql -1`. A build
-- that is interrupted leaves an INVALID index behind: drop it and run again
-- rather than leaving it, since an invalid index is maintained on every write
-- and used by nothing.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "asia_tank_snapshots_marks_idx"
  ON "asia_tank_snapshots" ("player_id", "tank_id", "taken_at" DESC, "battles" DESC)
  INCLUDE ("marks_on_gun")
  WHERE "marks_on_gun" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "na_tank_snapshots_marks_idx"
  ON "na_tank_snapshots" ("player_id", "tank_id", "taken_at" DESC, "battles" DESC)
  INCLUDE ("marks_on_gun")
  WHERE "marks_on_gun" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "eu_tank_snapshots_marks_idx"
  ON "eu_tank_snapshots" ("player_id", "tank_id", "taken_at" DESC, "battles" DESC)
  INCLUDE ("marks_on_gun")
  WHERE "marks_on_gun" IS NOT NULL;
