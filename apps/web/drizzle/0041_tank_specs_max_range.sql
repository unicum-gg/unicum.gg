-- Max shot range (the default shell's `maxDistance`: 720m for most direct-fire
-- guns, less for some, more for artillery). Nullable; backfilled by the vehicles
-- cron. Hand-written (db:generate can't see the makeXxxTable factory tables).
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "max_range" real;
