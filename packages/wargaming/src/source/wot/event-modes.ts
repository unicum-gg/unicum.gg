import { parsePo } from "./localization";

/**
 * The battle modes an event pack adds to the client, read off the pack itself.
 *
 * Every event mode ships as a pack under `res/<pack>/` (Halloween, Last Stand,
 * Black Signal's `fort_rush`…) that injects its own constants into the client's
 * enums at load: `ARENA_BONUS_TYPE`, the number a battle's results carry, and
 * `ARENA_GUI_TYPE`, the number the loading screen names it by. Both are
 * injected under the same member name, so the pairing needs no table:
 *
 *     class ARENA_GUI_TYPE(constants.ARENA_GUI_TYPE, ConstInjector):
 *         FORT_RUSH = 103
 *     class ARENA_BONUS_TYPE(constants.ARENA_BONUS_TYPE, ConstInjector):
 *         FORT_RUSH = 111
 *
 * and the pack's `menu.extend.po` names `loading/battleTypes/103` "Black
 * Signal". A difficulty is a second bonus type under the same screen
 * (`LAST_STAND_HARD` beside `LAST_STAND`), so a bonus name is paired with the
 * longest screen name it starts with and keeps the rest as its difficulty.
 */

/** One mode a pack declares. */
export type EventMode = {
  /** The `bonusType` its battles carry. */
  bonusType: number;
  /** The pack that declares it, `fort_rush`. */
  pack: string;
  /** What the game calls it, in English. */
  name: string;
};

/** The members of one injected enum class, by name. */
export function injectedConstants(
  source: string,
  enumName: string,
): Map<string, number> {
  const out = new Map<string, number>();
  const lines = source.split("\n");
  const header = new RegExp(`^class ${enumName}\\(.*ConstInjector`);
  for (let i = 0; i < lines.length; i += 1) {
    if (!header.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length && /^\s+\S|^\s*$/.test(lines[j]); j += 1) {
      const member = /^\s+([A-Z][A-Z0-9_]*)\s*=\s*(\d+)\s*$/.exec(lines[j]);
      if (member) out.set(member[1], Number(member[2]));
    }
  }
  return out;
}

/** `LAST_STAND` as "Last Stand", for a mode whose screen name is blank. */
function titled(snake: string): string {
  return snake
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The modes one pack declares, named.
 *
 * `constants` is the text of every constants module the pack ships, and `menu`
 * its `menu.extend.po` (empty when it has none). The loading screen's name is
 * the game's own and is preferred; some packs leave it blank (Halloween's is a
 * single space) or templated, and those fall back to the pack's member name,
 * which is how the client spells the mode in its own code.
 */
export function eventModesOf(
  pack: string,
  constants: string[],
  menu: string,
): EventMode[] {
  const screens = new Map<string, number>();
  const bonuses = new Map<string, number>();
  for (const source of constants) {
    for (const [name, value] of injectedConstants(source, "ARENA_GUI_TYPE")) {
      screens.set(name, value);
    }
    for (const [name, value] of injectedConstants(source, "ARENA_BONUS_TYPE")) {
      bonuses.set(name, value);
    }
  }
  const labels = parsePo(menu);
  const byLength = [...screens.keys()].sort((a, b) => b.length - a.length);
  const modes: EventMode[] = [];
  for (const [bonusName, bonusType] of bonuses) {
    const screen = byLength.find(
      (name) => bonusName === name || bonusName.startsWith(`${name}_`),
    );
    const base = screen ?? bonusName;
    const label = screen === undefined
      ? ""
      : (labels.get(`loading/battleTypes/${screens.get(screen)}`) ?? "").trim();
    const name = label && !label.includes("%(") ? label : titled(base);
    const difficulty = bonusName.slice(base.length + 1);
    modes.push({
      bonusType,
      pack,
      name: difficulty ? `${name} (${titled(difficulty)})` : name,
    });
  }
  return modes.sort((a, b) => a.bonusType - b.bonusType);
}
