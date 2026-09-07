-- Editing a suggestion after it was sent.
--
-- A submission used to be a one-way door: the row lands `pending`, a card goes
-- to the moderation channel, and the only thing that could ever write to it
-- again was the Approve / Reject press. So a battle filed under the wrong tank
-- was uncorrectable by the person who filed it, and the tank is the one field
-- the form never asks for (it is implied by the page the dialog was opened
-- from), which makes opening it from the wrong page unrecoverable by design.
-- That happened on 2026-09-07 and was fixed with an UPDATE by hand.
--
-- Two columns, both about the card rather than the battle.
--
-- DISCORD_MESSAGE_ID is what makes an edit visible to the moderator who is
-- about to act on it. Without it the channel would either hold a card
-- describing a battle that has since changed, or grow a second card for every
-- correction, and the queue is only useful while a card means one thing to do.
-- Null on every row posted before this, and on any row whose card failed to
-- post: the submission is queued either way, so the id is a convenience the
-- write path must never depend on.
--
-- EDITED_BY is the moderator who corrected someone else's submission, as a
-- Discord id, like `reviewed_by` beside it. Null when the author edited their
-- own, which is the ordinary case and already recorded by `submitted_by`: an
-- author rewriting their own row adds no name worth storing, a third party
-- rewriting it does.
ALTER TABLE "tank_videos"
  ADD COLUMN IF NOT EXISTS "discord_message_id" text,
  ADD COLUMN IF NOT EXISTS "edited_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "edited_by" text;
