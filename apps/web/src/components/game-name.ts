import type { TranslateFunction } from "@onruntime/translations";
import { BattleType, resolveMapMode } from "@unicum.gg/shared";

/**
 * A battle type's name in the reader's language.
 *
 * A lookup with one value passed in, because one of the twelve names is built
 * from another: the night version of Onslaught is that mode after dark, so a
 * language that calls Onslaught something else has to call this one the same
 * thing plus its own word for night. English writes `{onslaught} Night`, French
 * moves it where French wants it, and a language that does not need the
 * reference simply never mentions the placeholder.
 *
 * Anything that renders a battle type goes through here rather than reading
 * `game/vocabulary` directly, so the two can never disagree.
 */
export function battleTypeName(
  type: string,
  tGame: TranslateFunction,
): string {
  return tGame(`battle-types.${type}`, {
    onslaught: tGame(`battle-types.${BattleType.Onslaught}`),
  });
}

/**
 * What the game calls a mode token, in the reader's language.
 *
 * A mode reaches the front under two spellings: the four the catalogue
 * surfaces (`standard`), and the client's own token the geometry keys carry
 * (`ctf`, `comp7`, `epic`). Only the first are map modes, the rest are battle
 * types, and asking `game/vocabulary` for a token it does not carry gets the
 * key back, which is how a French reader ended up reading "Enemy bases
 * (Standard)".
 *
 * `resolveMapMode` decides which of the two a token is, and it is the same
 * function the English label is built from in `@unicum.gg/shared`, so neither
 * end can drift from the other. Anything that renders a mode goes through here.
 */
export function mapModeName(token: string, tGame: TranslateFunction): string {
  const ref = resolveMapMode(token);
  if ("battleType" in ref) return battleTypeName(ref.battleType, tGame);
  if ("mode" in ref) return tGame(`map-modes.${ref.mode}`);
  return ref.raw;
}

/**
 * A map's name in the reader's language.
 *
 * Wargaming names every arena in every language the game ships in, and those
 * names are not translations of the English one: Monastery is "Abbaye" in
 * French and "Kloster" in German, Mines is "Копальні" in Ukrainian. They come
 * off the client's own catalogue (`scripts/generate-game-locales`), keyed by the
 * arena id rather than by the English name, so a map WG renames keeps its entry.
 *
 * `fallback` is the payload's own name, which is what a language no client
 * ships gets, and what an arena too new to be in the catalogue gets in every
 * language. Passing it means a missing entry reads as English rather than as a
 * raw arena id.
 */
export function mapName(
  arenaId: string,
  fallback: string,
  tMaps: TranslateFunction,
): string {
  const name = tMaps(arenaId);
  return name === arenaId ? fallback : name;
}

/**
 * A map's own blurb in the reader's language, from the same catalogue as its
 * name. Kept in a namespace of its own because it is twenty-five kilobytes of
 * prose against two of names: only the page that shows it pays for it.
 */
export function mapDescription(
  arenaId: string,
  fallback: string,
  tDescriptions: TranslateFunction,
): string {
  const description = tDescriptions(arenaId);
  return description === arenaId ? fallback : description;
}

/**
 * A vehicle statistic's name in the reader's language.
 *
 * Only the displayed text changes. The glossary anchors a row on its English
 * label, and so does the comparison grid's row matching, so both keep reading
 * `row.label` while this decides what a reader sees. `fallback` is that same
 * English label, which is what a row the client has no parameter for gets until
 * the translator writes it.
 */
export function tankParamName(
  key: string,
  fallback: string,
  tParams: TranslateFunction,
): string {
  const name = tParams(key);
  return name === key ? fallback : name;
}

/**
 * The crest a player wears for their best Onslaught season: the mode's name and
 * the rank they reached.
 *
 * A template rather than a concatenation, because the order is the language's:
 * "Offensive Légende" reads wrong in French where "Légende Offensive" does, and
 * the mode itself is already Wargaming's own word.
 */
export function onslaughtCrestName(
  tier: "legend" | "champion",
  tGame: TranslateFunction,
): string {
  return tGame("onslaught-tiers.crest", {
    mode: battleTypeName(BattleType.Onslaught, tGame),
    tier: tGame(`onslaught-tiers.${tier}`),
  });
}

/**
 * An Onslaught season's name in the reader's language.
 *
 * The client keys its seasons by the ordinal it releases them in, and ships the
 * whole year at once. Wargaming's event board serves a season's dates and never
 * its name, so this is the only place "Season of the Azure Phoenix" exists.
 * `fallback` is the English codename core resolved when it stamped the season,
 * which is what a season released after this catalogue was mirrored gets.
 */
export function seasonName(
  ordinal: string | null,
  fallback: string | null,
  tSeasons: TranslateFunction,
): string | null {
  if (!ordinal) return fallback;
  const name = tSeasons(ordinal);
  return name === ordinal ? fallback : name;
}

/**
 * A clan rank in the reader's language.
 *
 * A membership carries both the stable `role` key and the `role_i18n`
 * Wargaming answered with, and only the first is usable: the second is whatever
 * language the clan was last READ in, which is ours, so it renders English on a
 * French page and on a Korean one alike. `game/clan-roles` holds Wargaming's own
 * word per language (`wgn/clans/glossary`, keyed by that same role), so a French
 * player reads "Officier du personnel" exactly as their own client says it.
 *
 * Falls back to the key made readable rather than to `role_i18n`: a rank
 * Wargaming adds before we next regenerate reads as "Combat officer", which is
 * the same English the payload would have given and costs no second source of
 * truth.
 */
export function clanRoleName(role: string, tRoles: TranslateFunction): string {
  if (!role) return "\u2014";
  const name = tRoles(role);
  if (name !== role) return name;
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}
