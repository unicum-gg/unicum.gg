-- How players have set their vehicles up: modules, crew skills, field
-- modifications, and what the tank carries into battle. See
-- packages/shared/src/db/schema/tank-loadouts.ts.
--
-- Written by hand rather than by `drizzle-kit generate`, as AGENTS.md
-- prescribes for this schema: the per-region tables come out of a
-- `makeXxxTable(region)` factory that drizzle-kit's AST analyser cannot see
-- into. Asked to generate this one it stopped on an interactive
-- create-or-rename prompt, which is the same blindness that has already
-- answered with `DROP TABLE ... CASCADE` on every per-region table once.
--
-- Purely additive: two new tables and nothing touched, so it is safe to apply
-- while the app is serving.
--
-- Every row is sent by the unicum.gg mod from a player's own client. Wargaming
-- publishes none of this, so there is no backfill and nothing to reconcile
-- against.

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['eu','na','asia'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I_tank_loadouts (
        account_id bigint NOT NULL,
        tank_id bigint NOT NULL,

        -- The active setup, flattened so a question about the population is an
        -- indexed read. Slot order is kept and a free slot is a NULL element,
        -- so "what goes in the third slot" survives.
        opt_devices text[],
        consumables text[],
        boosters text[],
        crew_skills text[],
        field_mods text[],
        field_mod_level smallint,

        -- Derived on write rather than at read time: it is what every
        -- aggregate over this table will ask for, and unpacking the shell
        -- layout per row per query would make that expensive.
        premium_shell_share real,
        shells_loaded smallint,

        -- The whole truth, secondary setups and per-shell counts included, for
        -- the page that draws one player's tank.
        modules jsonb,
        crew jsonb,
        progression jsonb,
        setups jsonb,

        updated_at timestamp with time zone DEFAULT now() NOT NULL,

        -- A player changes their setup, they do not accumulate them.
        CONSTRAINT %I_tank_loadouts_account_id_tank_id_pk
          PRIMARY KEY (account_id, tank_id)
      )
    $f$, r, r);

    -- Every question about the population is asked of one tank at a time.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_tank_loadouts_tank_idx
        ON %I_tank_loadouts (tank_id)
    $f$, r, r);

    -- Containment, which is what "who runs this equipment" and "who trained
    -- this perk" both reduce to.
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_tank_loadouts_opt_devices_idx
        ON %I_tank_loadouts USING gin (opt_devices)
    $f$, r, r);
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I_tank_loadouts_crew_skills_idx
        ON %I_tank_loadouts USING gin (crew_skills)
    $f$, r, r);
  END LOOP;
END $$;

-- Players who asked not to be shown. Global and one row for the account rather
-- than one flag per vehicle: this is a decision about a person, and somebody
-- who does not want their setups read does not want half of them read. The
-- loadout rows stay either way, so the choice is reversible and the aggregates
-- keep their sample; what this governs is attribution.
CREATE TABLE IF NOT EXISTS "loadout_privacy" (
  -- `<region>-<account id>`, the key the Wargaming sign-in stores.
  "wargaming_account" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "hidden" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
