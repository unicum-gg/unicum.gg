-- The submitter's own rows, which nothing indexed.
--
-- Every video page now asks "which of these are mine" for a signed-in reader,
-- so `submitted_by` is read on a page view rather than on a submission. The
-- table's four indexes are all about how a page finds videos (by tank, by
-- arena, by status) and none about who sent them, so that read was a sequential
-- scan of the whole table, twice: once here and once for the pending queue that
-- filters on the same column.
--
-- Cheap now (a hundred rows) and the point is that it stays cheap: this grows
-- with every suggestion ever made, while the answer stays a handful of ids.
CREATE INDEX IF NOT EXISTS "tank_videos_submitter_idx"
  ON "tank_videos" ("submitted_by");
