-- The Tankopedia historical description in every language the WG encyclopedia
-- answers in, keyed by its `language` code. Additive: the English `description`
-- column stays as it is and remains the fallback.
--
-- Written by hand, not by drizzle-kit: its AST analyzer cannot see the tables
-- our `makeXxxTable(region)` factories build, so it asks to resolve them as
-- conflicts and would emit DROP TABLE for every per-region table (see AGENTS.md).
ALTER TABLE "tank_specs" ADD COLUMN IF NOT EXISTS "description_i18n" jsonb;
