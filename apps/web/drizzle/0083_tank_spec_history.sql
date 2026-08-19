-- Tank characteristics change history, patch by patch. Global (WG balances
-- vehicles identically across servers), keyed by tank_id + game version, built
-- forward by the spec-history diff at every game-version bump. Hand-written: the
-- two tables are plain pgTable calls so db:generate could emit them, but it also
-- tries to reconcile the invisible makeXxxTable(region) factory tables and would
-- emit DROPs for them, so every schema change goes through a reviewed hand SQL.

-- Immutable per-version baseline the next version is diffed against. `data` holds
-- the tracked numeric spec fields at their raw stored scale.
CREATE TABLE IF NOT EXISTS "tank_spec_snapshots" (
  "tank_id" bigint NOT NULL,
  "game_version" text NOT NULL,
  "data" jsonb NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tank_spec_snapshots_pk" PRIMARY KEY ("tank_id", "game_version")
);
CREATE INDEX IF NOT EXISTS "tank_spec_snapshots_tank_idx"
  ON "tank_spec_snapshots" ("tank_id", "captured_at");

-- One recorded field change at a version bump. previous/next are raw stored
-- values (the UI scales/formats); either is null when a field appeared/disappeared.
CREATE TABLE IF NOT EXISTS "tank_changes" (
  "id" serial PRIMARY KEY NOT NULL,
  "tank_id" bigint NOT NULL,
  "game_version" text NOT NULL,
  "field" text NOT NULL,
  "previous" real,
  "next" real,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tank_changes_tank_idx"
  ON "tank_changes" ("tank_id", "captured_at");
CREATE INDEX IF NOT EXISTS "tank_changes_captured_idx"
  ON "tank_changes" ("captured_at");
