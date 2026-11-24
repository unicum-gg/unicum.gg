-- How a supporter's nickname is drawn. Written by hand for the reason 0152
-- gives (see AGENTS.md, Database migrations). Run with a lock timeout: an
-- ALTER waiting behind a long backup queues every read of the table after it.
SET lock_timeout = '2s';
ALTER TABLE "support_profile"
  ADD COLUMN IF NOT EXISTS "name_font" text,
  ADD COLUMN IF NOT EXISTS "name_effect" text,
  ADD COLUMN IF NOT EXISTS "name_color" text,
  ADD COLUMN IF NOT EXISTS "name_color2" text;
