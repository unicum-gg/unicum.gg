-- When YouTube says the video went up. Read off the watch page at submission
-- (the Data API would mean a key and a quota for one field) and stored, since
-- it never changes and a page listing twenty videos should not ask twenty
-- times. Nullable: the page not answering costs a column, not a submission.
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "published_at" timestamptz;
