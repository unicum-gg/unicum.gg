-- Why a suggestion was turned down, in the moderator's own words.
--
-- A rejection used to be a silent no: the row kept its status, the submitter
-- saw their video never appear, and the one thing that would let them fix it
-- (what was wrong with it) existed only in whichever moderator's head pressed
-- the button. Most rejections are a timestamp a few seconds off or a map named
-- wrong, which is a correction rather than a refusal.
--
-- Written by the Reject button, which now asks for it, and read in two places:
-- the correction form, where it sits above the fields it is about, and the
-- Discord notice the submitter gets if they have linked their account.
--
-- Nullable, and it stays that way: the rejections already recorded have no
-- reason and inventing one would be worse than admitting there is none.
ALTER TABLE "tank_videos"
  ADD COLUMN IF NOT EXISTS "review_note" text;
