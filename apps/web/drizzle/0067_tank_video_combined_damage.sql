-- Combined damage (dealt + assisted) declared with a suggested battle.
-- Nullable: rows queued before this, and submitters who do not remember the
-- number, both keep working.
ALTER TABLE "tank_videos" ADD COLUMN IF NOT EXISTS "combined_damage" integer;
