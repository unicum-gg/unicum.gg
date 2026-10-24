import { iconUrl } from "@unicum.gg/shared";
import { crewRoleBadgeUrl, type Region } from "@unicum.gg/wargaming";
import {
  crewSkillIcon,
  devicePicture,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import { getTankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import {
  getTankFieldMods,
  type FieldModItem,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { getTranslation } from "@/lib/translations.server";

/**
 * Turning the client's own keys into words a reader can read.
 *
 * Everything the mod reports is an identifier (`improvedVentilation_tier1`,
 * `commander_eagleEye`), which is right for storage and for counting and is not
 * something to put on a page. Resolving them has to happen on the server: the
 * catalogues that name equipment and crew perks in the reader's language are
 * stripped from the dictionaries before they cross the wire, so a client
 * component asking for one gets the key back.
 *
 * The same two sources a battle's own page reads, in the same order: the
 * client's dictionary for the name, since it is translated, and the vehicle's
 * catalogue for the picture and as the fallback name.
 */

/** WG's own shell-type pictures, keyed by the kind of round the client reports.
 * The same ones the tank page's ammo panel and the player's loadout draw. */
const AMMO_ICONS = iconUrl("ammopanel/ammo");

export interface LoadoutNaming {
  /** A device, consumable or directive: its name, picture and grade badge. */
  item(key: string): { name: string; image: string | null; overlay: string | null; categories?: string[] };
  /** One side of a field modification pair, by its catalogue key: the game's
   * name for that side and its picture. */
  fieldMod(key: string): { name: string; image: string | null };
  /** A crew perk. The picture is built from the key, which is the one family
   * that genuinely is one file per entry on the mirror with no catalogue. */
  crewSkill(key: string): { name: string; image: string };
  /** A seat, as the garage names it. */
  role(key: string): { label: string; image: string | null };
  /** AP, APCR, HEAT or HE, in the reader's language. */
  shellKind(type: string): { kind: string; image: string };
  /** The seats this vehicle has, in the catalogue's own order, so a role with
   * no skills trained is still a seat rather than an absence. */
  seats: string[];
  /** The region the names were read for, which links a player to their page. */
  region: Region;
}

export async function loadoutNaming(
  region: Region,
  tankId: number,
  locale: string,
): Promise<LoadoutNaming> {
  const [
    { t: tEquipment },
    { t: tPerks },
    { t: tRoles },
    { t: tGame },
    icons,
    tankCrew,
    tankFieldMods,
  ] = await Promise.all([
    getTranslation("game/equipment", locale),
    getTranslation("game/crew-perks", locale),
    getTranslation("game/crew-roles", locale),
    getTranslation("game/vocabulary", locale),
    loadoutIcons(region, tankId).catch(() => new Map<string, LoadoutIcon>()),
    getTankCrew(region, tankId).catch(() => null),
    getTankFieldMods(region, tankId).catch(() => null),
  ]);

  // Every side of every pair the vehicle's tree offers, by key. The battles
  // name the side taken by this key, and only the tree carries its picture.
  const modifications = new Map<string, FieldModItem>();
  for (const step of tankFieldMods?.steps ?? []) {
    if (!step.pair) continue;
    modifications.set(step.pair.first.key, step.pair.first);
    modifications.set(step.pair.second.key, step.pair.second);
  }

  return {
    item(key) {
      // The client's dictionary first, which is translated, then the
      // catalogue, which is Wargaming's English: a French reader asking what
      // was fitted is told in French, as on a battle's own page. A missing key
      // comes back AS the key from the dictionary, which is how it reports a
      // gap. The picture goes through `devicePicture` rather than the entry,
      // because a vehicle's equipment list holds only the grades the
      // encyclopedia lists for it, and a grade really fitted can be missing.
      const entry = icons.get(key);
      const translated = tEquipment(key);
      return {
        name: (translated !== key ? translated : "") || entry?.name || key,
        image: devicePicture(icons, key),
        overlay: gradeOverlay(entry),
        categories: entry?.categories,
      };
    },
    fieldMod(key) {
      // The client's dictionary first, which is translated, then the tree's
      // own name, which is Wargaming's English. A missing key comes back AS
      // the key from the dictionary, which is how it reports a gap.
      const entry = modifications.get(key);
      const translated = tEquipment(key);
      return {
        name: (translated !== key ? translated : "") || entry?.name || key,
        image: entry?.image ?? null,
      };
    },
    crewSkill(key) {
      return { name: tPerks(key), image: crewSkillIcon(key) };
    },
    role(key) {
      return {
        label: tRoles(key),
        image: crewRoleBadgeUrl(region, key),
      };
    },
    shellKind(type) {
      return {
        kind: tGame(`shells.${type}`) || type,
        image: `${AMMO_ICONS}/${type}.png`,
      };
    },
    seats: tankCrew?.members.map((member) => member.roles[0] ?? "crew") ?? [],
    region,
  };
}
