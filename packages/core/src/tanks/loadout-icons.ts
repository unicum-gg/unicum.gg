import type { Region } from "@unicum.gg/wargaming";
import { assetsRefFor, DEVICE_FAMILY, iconUrl } from "@unicum.gg/shared";
import {
  getTankLoadout,
  type LoadoutEquipment,
} from "@unicum.gg/core/wargaming/wot/tanks/loadout";

/**
 * The picture and the proper name behind each key a loadout carries.
 *
 * The mod sends keys, because a key is what survives a patch and what an
 * aggregate groups by. A page needs a picture and a name, and both already
 * exist: the vehicle's own catalogue knows every device, directive and
 * consumable it can mount, with the image Wargaming publishes for each.
 *
 * Looked up rather than derived, and that is the whole point of this file. The
 * keys mostly resolve straight against the icon mirror, so it is tempting to
 * build a URL from the key and be done. They do not all resolve: a graded
 * variant (`grousers_tier1`) and a directive (`turbochargerBattleBooster`)
 * both point at the base device's picture, and guessing that rule means
 * stripping a suffix here and lowercasing a letter there until the 404s stop.
 * The catalogue holds the answer Wargaming gave, so it is read instead.
 *
 * Crew skills are the exception and are built from the key, because they
 * genuinely are one file per skill on the mirror and no catalogue maps them.
 */

/** What a key resolves to, for drawing. */
export interface LoadoutIcon {
  /** The catalogue key, which an experimental device's level is read from. */
  key: string;
  /**
   * The game's own name for it, in the language the catalogue was read in.
   *
   * Empty on an entry recovered from a device family (see below): that route
   * finds the picture but not the name, and the device's own name is not the
   * directive's. The caller falls back to the client's dictionary, which has
   * the right one.
   */
  name: string;
  /** The picture, or null when Wargaming publishes none. */
  image: string | null;
  /**
   * Equipment only: how it was acquired, `bond`, `bounty`, `bountyUpgraded`
   * or `experimental`.
   *
   * Carried because the picture alone does not say it. Wargaming's own API
   * returns the plain artefact image for a Bounty Rammer and for the ordinary
   * one alike, and the game marks the difference with a corner overlay
   * composited on top. Without this, two very different devices draw
   * identically.
   */
  grade?: string;
  /** Equipment only: its Equipment 2.0 categories, which the game dots. */
  categories?: string[];
}

/** Every key this vehicle can mount, pointing at its picture and its name. */
export async function loadoutIcons(
  region: Region,
  tankId: number,
): Promise<Map<string, LoadoutIcon>> {
  const icons = new Map<string, LoadoutIcon>();
  const catalogue = await getTankLoadout(region, tankId).catch(() => null);
  if (!catalogue) return icons;
  for (const item of catalogue.equipment) {
    if (!item.key) continue;
    icons.set(item.key, {
      key: item.key,
      name: item.name,
      image: item.image,
      grade: item.grade,
      categories: item.categories,
    });
  }
  for (const group of [catalogue.directives, catalogue.consumables]) {
    for (const item of group) {
      if (!item.key) continue;
      icons.set(item.key, {
        key: item.key,
        name: item.name,
        image: item.image,
      });
    }
  }
  addMissingDirectives(catalogue.equipment, icons);
  addFamilies(catalogue.equipment, icons);
  return icons;
}

/** The marker a family entry carries, so a real key is never mistaken for one. */
const FAMILY = "family:";

/**
 * One entry per device FAMILY, so a grade this vehicle's list omits still draws.
 *
 * Wargaming's own picture is the family's, not the grade's: a Bounty Rammer
 * and an ordinary one are both `tankRammer.png`, and the difference is the
 * corner overlay the game composites on top. But the vehicle's equipment list
 * only carries the grades the encyclopedia happens to list for it, and it is
 * not complete -- on one real vehicle it held `trophyUpgradedExtraHealthReserve`
 * and `trophyUpgradedTurbocharger` and simply did not hold
 * `trophyUpgradedTankRammer`, which the player was nonetheless carrying. The
 * key resolved to nothing and the slot drew blank, in the middle of two that
 * drew fine.
 *
 * So the families are registered beside the keys, under a prefix no catalogue
 * key uses, and `devicePicture` falls back to them. The picture only: the
 * family cannot name a grade, and a Bounty Rammer called "Gun Rammer" would be
 * worse than one left unnamed.
 */
function addFamilies(
  equipment: LoadoutEquipment[],
  icons: Map<string, LoadoutIcon>,
): void {
  for (const device of equipment) {
    if (!device.icon || !device.image) continue;
    const key = `${FAMILY}${device.icon}`;
    // The standard grade wins where there is one, for the same reason the
    // directives take it: it is the family's own picture rather than a
    // variant's.
    if (icons.has(key) && device.grade !== "standard") continue;
    icons.set(key, { key, name: "", image: device.image });
  }
}

/**
 * The picture for a device key, by exact match and then by family.
 *
 * Used wherever a loadout READ back from a battle is drawn, which is where
 * keys the vehicle's own list does not carry turn up: the list is what the
 * tank page offers a reader to fit, and what somebody actually fitted is not
 * bounded by it.
 *
 * The family is matched as a substring rather than a prefix because the grade
 * sits in front of it (`trophyUpgradedTankRammer`) on some variants and behind
 * it (`tankRammer_tier1`) on others. The longest family wins, so `tankRammer`
 * is preferred over a shorter name that happens to be contained in it.
 */
export function devicePicture(
  icons: Map<string, LoadoutIcon>,
  key: string,
): string | null {
  const exact = icons.get(key);
  if (exact?.image) return exact.image;
  const wanted = key.toLowerCase();
  let best: string | null = null;
  let longest = 0;
  for (const [name, entry] of icons) {
    if (!name.startsWith(FAMILY) || !entry.image) continue;
    const family = name.slice(FAMILY.length).toLowerCase();
    if (family.length > longest && wanted.includes(family)) {
      best = entry.image;
      longest = family.length;
    }
  }
  if (best) return best;

  // Last, the family's own picture, built from the shape of a URL this
  // catalogue really returned rather than from a pattern written here. A
  // vehicle's list can omit a grade entirely -- one listed two of a player's
  // three devices and not the third -- and then there is no entry and no
  // family registered from it to fall back on. Wargaming names the file after
  // the family, so swapping the last segment of a working URL for the family
  // this key belongs to is the same URL that catalogue would have given, had
  // it carried the grade.
  //
  // `DEVICE_FAMILY` answers which family that is, out of the client's own
  // definitions; where it has nothing the name IS the family, which is the
  // commoner case and the reason the table only holds the exceptions.
  const family = DEVICE_FAMILY[key] ?? key;
  for (const entry of icons.values()) {
    if (!entry.image) continue;
    const at = entry.image.lastIndexOf("/");
    if (at < 0) continue;
    return `${entry.image.slice(0, at + 1)}${family}.png`;
  }
  return null;
}

/**
 * The directives the catalogue left out, recovered from the device they boost.
 *
 * The vehicle's directive list is built for the tank page's configurator,
 * which drops any directive whose effect moves no characteristic the table
 * shows: toggling one there would look like a no-op. Ventilation Purge is the
 * clearest case, since Improved Ventilation raises the crew's level rather
 * than a listed statistic, so it is filtered out on every vehicle.
 *
 * That filter is right for a control and wrong for a record. This page is not
 * offering the player a switch, it is reporting what they mounted, and a
 * directive they are carrying has to draw whatever it does to the spec sheet.
 * A text box with the directive's name in it was the visible symptom.
 *
 * A directive is named after the device family it enhances plus the suffix
 * Wargaming uses for it, which is how the catalogue joins the two itself, so
 * the key gives the family and the family gives the picture. The picture only:
 * the name comes from the client's own dictionary, because the device is not
 * the directive and the two are not called the same thing.
 */
function addMissingDirectives(
  equipment: LoadoutEquipment[],
  icons: Map<string, LoadoutIcon>,
): void {
  const SUFFIX = "BattleBooster";
  for (const device of equipment) {
    if (!device.icon) continue;
    const key = `${device.icon}${SUFFIX}`;
    const held = icons.get(key);
    // The standard grade wins: a family's picture should not come from its
    // bond variant when the ordinary device is right there.
    if (held?.image && held.name) continue;
    if (held && device.grade !== "standard") continue;
    icons.set(key, { key, name: "", image: device.image });
  }
}

/**
 * A crew skill's picture, from its key.
 *
 * One file per skill on the assets mirror, which is where the tank page's own
 * crew section reads them: Wargaming's own icon URLs for these are dead.
 */
export function crewSkillIcon(key: string): string {
  return `${iconUrl("tankmen/skills/big", assetsRefFor())}/${key}.png`;
}
