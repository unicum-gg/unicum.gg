import { requestedLanguage } from "@/services/openapi/locale";
import { GameLanguage, WgLanguage } from "@unicum.gg/wargaming";
import { DEFAULT_LOCALE, isLocale, Locale } from "./translations";

/**
 * The words Wargaming owns, kept apart from the words we wrote.
 *
 * The distinction is not tidiness. A mode has a name in every language the game
 * is published in, and it is the game's name: a French player reads "Offensive",
 * never "Onslaught", so a site that says Onslaught to them is not translated, it
 * is half-translated. Our own prose has no such constraint, and the two are
 * translated under different rules (see `scripts/generate-translations.ts`).
 */

/**
 * The `game/` namespaces Wargaming's own API publishes, and which this project
 * therefore never writes by hand or by model: `scripts/generate-game-vocabulary`
 * fetches them per language and overwrites.
 *
 * Everything else under `game/` is vocabulary the game has but the API does not
 * expose (the mode names, the marks, the map's points of interest). Those are
 * translated like the rest of the site, with a prompt that asks for the game's
 * own wording rather than a literal rendering.
 */
export const WARGAMING_NAMESPACES: readonly string[] = [
  "game/vehicle-classes",
  "game/nations",
  "game/crew-roles",
  "game/mastery",
  "game/clan-roles",
];

/** Whether a namespace is Wargaming's to write. */
export function isWargamingNamespace(namespace: string): boolean {
  return WARGAMING_NAMESPACES.includes(namespace);
}

/**
 * The `game/` namespaces whose every value is the CLIENT's own, written by
 * `scripts/generate-game-locales` from the gettext catalogues.
 *
 * They are named here because the translator has to leave them alone, and
 * "missing or stale" is not enough to make it. A key is stale when its English
 * changed, and the English here is the client's too: adding the `{value}` hole
 * back to the upgrade-tree descriptions changed all 93 of them at once, so the
 * model was asked to rewrite what the client already says in twenty-eight
 * languages, and it did ("dégâts de bélier causés" over the client's own
 * "dégâts par collision infligés"). Only MISSING keys are filled here, which is
 * exactly the seven languages no client ships.
 *
 * `game/vocabulary` and `game/tank-params` are deliberately absent: both are
 * mixed, holding client words beside words the game has no name for, so their
 * model-written half must still refresh when our English changes.
 */
export const GAME_CLIENT_NAMESPACES: readonly string[] = [
  "game/maps",
  "game/map-descriptions",
  "game/equipment",
  "game/equipment-descriptions",
  "game/crew-perks",
  "game/crew-perk-descriptions",
  "game/skill-tree",
  "game/skill-tree-descriptions",
  "game/onslaught-seasons",
];

/**
 * Whether the game client is the author of every value in this namespace.
 *
 * Named for the GAME client, not the browser: `lib/translations` has its own
 * `isClientNamespace` asking whether a namespace crosses the wire, and the two
 * answer different questions about different clients.
 */
export function isGameClientNamespace(namespace: string): boolean {
  return GAME_CLIENT_NAMESPACES.includes(namespace);
}

/**
 * Which of our locales the game itself is published in, and under which code.
 *
 * Measured against the API rather than assumed: it answers `INVALID_LANGUAGE`
 * for the fifteen we publish in that it does not, which is the same list as the
 * languages the game has no words in at all. For those, our translation is not
 * a second-best, it is the only one that exists.
 */
export const WARGAMING_LANGUAGE: Partial<Record<Locale, WgLanguage>> = {
  [Locale.EN]: WgLanguage.English,
  [Locale.FR]: WgLanguage.French,
  [Locale.DE]: WgLanguage.German,
  [Locale.ES]: WgLanguage.Spanish,
  [Locale.PL]: WgLanguage.Polish,
  [Locale.CS]: WgLanguage.Czech,
  [Locale.TR]: WgLanguage.Turkish,
  [Locale.RU]: WgLanguage.Russian,
  [Locale.VI]: WgLanguage.Vietnamese,
  [Locale.TH]: WgLanguage.Thai,
  [Locale.KO]: WgLanguage.Korean,
  [Locale.ZH]: WgLanguage.ChineseSimplified,
};

/**
 * Which of our locales the game itself SHIPS in, and under which directory of
 * the mirror's `LOCALES` branch.
 *
 * A longer list than `WARGAMING_LANGUAGE` above, and that is the point: the
 * public API answers in thirteen languages, the client is played in
 * thirty-three, and the difference is ten of ours. Ukrainian, Italian, Dutch,
 * Hungarian, Romanian, Portuguese, Swedish, Croatian, Serbian and Japanese all
 * have official Wargaming wording that no endpoint will ever hand us.
 *
 * The seven of our locales missing here (Slovak, Bosnian, Belarusian, Arabic,
 * Hindi, Kazakh, Tagalog) are languages no World of Tanks client is published
 * in, so there is no official wording to copy and ours is the only one that
 * exists. Kazakh and Tagalog are here for the readers rather than for the game:
 * more players declare them than declare Swedish, which the game does ship.
 */
export const GAME_CLIENT_LANGUAGE: Partial<Record<Locale, GameLanguage>> = {
  [Locale.EN]: GameLanguage.English,
  [Locale.FR]: GameLanguage.French,
  [Locale.DE]: GameLanguage.German,
  [Locale.ES]: GameLanguage.Spanish,
  [Locale.IT]: GameLanguage.Italian,
  [Locale.PT]: GameLanguage.Portuguese,
  [Locale.NL]: GameLanguage.Dutch,
  [Locale.PL]: GameLanguage.Polish,
  [Locale.SV]: GameLanguage.Swedish,
  [Locale.CS]: GameLanguage.Czech,
  [Locale.HU]: GameLanguage.Hungarian,
  [Locale.RO]: GameLanguage.Romanian,
  [Locale.UK]: GameLanguage.Ukrainian,
  [Locale.RU]: GameLanguage.Russian,
  [Locale.SR]: GameLanguage.Serbian,
  [Locale.HR]: GameLanguage.Croatian,
  [Locale.TR]: GameLanguage.Turkish,
  [Locale.JA]: GameLanguage.Japanese,
  [Locale.KO]: GameLanguage.Korean,
  [Locale.TH]: GameLanguage.Thai,
  [Locale.VI]: GameLanguage.Vietnamese,
  // Mainland simplified rather than the Singapore build the Asia client ships:
  // the same characters, from the client the largest readership plays.
  [Locale.ZH]: GameLanguage.ChineseSimplified,
  [Locale.BG]: GameLanguage.Bulgarian,
  [Locale.EL]: GameLanguage.Greek,
  [Locale.FI]: GameLanguage.Finnish,
  [Locale.LT]: GameLanguage.Lithuanian,
  [Locale.LV]: GameLanguage.Latvian,
  [Locale.DA]: GameLanguage.Danish,
  [Locale.NO]: GameLanguage.Norwegian,
};

/**
 * The language Wargaming's own catalogue will answer in, and the locale that
 * amounts to.
 *
 * Two values because they are not the same thing: the first is what the WG API
 * is asked (their own code, or nothing), the second is what the body ends up in
 * and therefore what `Content-Language` must say. A locale they do not publish
 * the catalogue in maps to nothing and comes back English, so claiming the
 * asked-for one there would be a lie a cache then repeats.
 */
export function gameCatalogueLanguage(req: Request): {
  language: WgLanguage | undefined;
  served: string;
} {
  const asked = requestedLanguage(req);
  const language = asked && isLocale(asked) ? WARGAMING_LANGUAGE[asked] : undefined;
  return { language, served: language && asked ? asked : DEFAULT_LOCALE };
}
