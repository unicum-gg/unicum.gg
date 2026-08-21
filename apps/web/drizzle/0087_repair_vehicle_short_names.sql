-- Repair the vehicle short names that were overwritten with the .po header.
--
-- `parsePo` stored the gettext header (`msgid ""`, whose msgstr is the file's
-- own `Project-Id-Version: ...` metadata block) under the empty key. The 216
-- vehicles that carry no `shortUserString` look their short name up under
-- exactly that empty key, so they were written with the metadata block instead,
-- and `slugifyTank` then turned it into their slug. Fixed in the source, but the
-- catalogue keeps the bad values until the daily vehicles cron rewrites them.
--
-- `short_name = name` is not a guess. Those 216 rows have no `shortUserString`
-- precisely BECAUSE their short name equals their full name, which is what the
-- fallback the header suppressed would have produced. Replaying the fixed
-- pipeline over the mirror (11 nations, 1229 vehicles) gives `short_name` ==
-- `name` for all 216, with no counter-example.
--
-- Idempotent, and a no-op once the cron has run with the fixed source.

UPDATE eu_vehicles   SET short_name = name WHERE short_name LIKE 'Project-Id-Version:%';
UPDATE na_vehicles   SET short_name = name WHERE short_name LIKE 'Project-Id-Version:%';
UPDATE asia_vehicles SET short_name = name WHERE short_name LIKE 'Project-Id-Version:%';
