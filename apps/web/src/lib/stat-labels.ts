import type { TranslateFunction } from "@onruntime/translations";
import { GAME_NAME_KEYS } from "@/locales/generated/game-names";

/**
 * The stat-label translator, with the game's own catalogue in front of it.
 *
 * A heading that IS a name Wargaming gives something has one right answer per
 * language and it is already written down in `game/vocabulary`, so asking a
 * model for it a second time under a prose prompt is asking for a second
 * answer. It got one: a bare "3 marks" with nothing around it reads as a score
 * rather than as the marks on a gun, and came back as "3 points" in French, "3
 * Punkte" in German, "3 puan" in Turkish and "3 分" in Chinese, beside a panel
 * its own catalogue heads "Marques d'excellence". Measured over the seventeen
 * stat labels that are catalogued names, the two files disagreed on 127 strings
 * across the thirty-five translated languages, "Grand Battles" and "Ranked
 * Battles" included, and nothing in the suite could see it: the key exists, the
 * placeholders survive, and only a player who opens their own game knows the
 * site is using a word it does not have.
 *
 * So the catalogue answers first and the prose file answers for everything
 * else. The seventeen keys are gone from `components/stat-labels`, which is
 * what makes this one source rather than a preference between two.
 */
export function composeStatLabels(
  tStats: TranslateFunction,
  tGame: TranslateFunction,
): TranslateFunction {
  return ((key: string, ...rest: unknown[]) => {
    // `Object.hasOwn` rather than truthiness: the map is an object literal, so
    // a key named `constructor` (legal under the suite's kebab-case rule) would
    // otherwise resolve to `Object` and be handed to `tGame` as a key.
    const catalogued = Object.hasOwn(GAME_NAME_KEYS, key)
      ? GAME_NAME_KEYS[key]
      : undefined;
    if (catalogued) {
      const own = tGame(catalogued);
      if (own !== catalogued) return own;
    }
    return (tStats as (key: string, ...rest: unknown[]) => string)(key, ...rest);
  }) as TranslateFunction;
}
