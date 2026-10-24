import type { Region } from "@unicum.gg/wargaming";
import { iconUrl } from "@unicum.gg/shared";
import type { PlayerBattle } from "@unicum.gg/core/battles/read";
import {
  devicePicture,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import {
  fieldModSlots,
  type FieldModSlot,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { getTranslation } from "@/lib/translations.server";

/**
 * Battle rows as the Battles list draws them: the loadout keys the database
 * hands back turned into named pictures, in one language.
 *
 * Shared by every endpoint that answers with battle rows (a player's Battles
 * tab, a vehicle's best battles) so a battle is drawn the same way wherever it
 * appears. Lifted out of the player endpoint, where it was written first.
 */
export async function pictureBattleRows(
  region: Region,
  battles: PlayerBattle[],
  served: string,
) {
  // One catalogue per DISTINCT vehicle, not per row. A page of twenty
  // battles is usually two or three tanks, and a cold catalogue read pulls
  // a vehicle's whole profile; asking once per row would have made the list
  // pay for the preview twenty times over to draw the same three pictures.
  // Nothing is read at all for a page whose battles carry no loadout.
  const tanks = [
    ...new Set(
      battles
        .filter((battle) => battle.devices?.length || battle.consumables?.length)
        .map((battle) => battle.own.tank),
    ),
  ];
  // The dictionaries that name equipment, so the preview boxes can carry a
  // tooltip. In the language the URL names, so the answer stays one per URL
  // and a shared cache cannot hand one reader another's.
  const [{ t: tEquipment }, { t: tGame }] = await Promise.all([
    getTranslation("game/equipment", served),
    getTranslation("game/vocabulary", served),
  ]);
  // The field modifications, resolved once per (vehicle, packed value).
  // Keyed on both because the same tank with a different tree position is a
  // different answer, and because a player's twenty battles on one tank with
  // one build collapse to a single resolution.
  const mods = new Map<string, FieldModSlot[]>();
  await Promise.all(
    [
      ...new Map(
        battles
          .filter((battle) => battle.fieldModsPacked?.length)
          .map((battle) => [
            `${battle.own.tank}:${battle.fieldModsPacked!.join(",")}`,
            battle,
          ]),
      ).entries(),
    ].map(async ([key, battle]) => {
      mods.set(
        key,
        await fieldModSlots(region, battle.own.tank, battle.fieldModsPacked ?? []),
      );
    }),
  );
  const pictures = new Map<number, Map<string, LoadoutIcon>>();
  await Promise.all(
    tanks.map(async (tank) => {
      pictures.set(tank, await loadoutIcons(region, tank));
    }),
  );

  return battles.map(
    ({ devices, boosters, consumables, shells, fieldModsPacked, ...battle }) => {
      const icons = pictures.get(battle.own.tank);
      const name = namer(tEquipment, icons);
      return {
        ...battle,
        startedAt: battle.startedAt.toISOString(),
        ...(devices?.length
          ? { devices: pictured(devices, icons, name) }
          : {}),
        ...(boosters?.length
          ? { boosters: pictured(boosters, icons, name) }
          : {}),
        ...(consumables?.length
          ? { consumables: pictured(consumables, icons, name) }
          : {}),
        // Shells need no catalogue: the round's KIND picks its icon, and
        // that is one folder on the assets mirror rather than something
        // the vehicle's own profile has to answer for. The kind names
        // itself through the same block the tank pages read, so a round
        // is called the same thing everywhere.
        ...(shells?.length
          ? {
              shells: shells.map((kind) => ({
                name: tGame(`shells.${kind}`) || kind,
                image: `${AMMO_ICONS}/${kind}.png`,
              })),
            }
          : {}),
        ...(fieldModsPacked?.length
          ? {
              fieldMods: (
                mods.get(`${battle.own.tank}:${fieldModsPacked.join(",")}`) ?? []
              ).map((mod) => {
                // Untaken pairs come back as empty slots, which is how a
                // row says three of seven rather than just three.
                if (!mod.key) {
                  return { filled: false, name: null, image: null, overlay: null };
                }
                // The dictionary first, as everywhere else here: the
                // catalogue's name is Wargaming's encyclopedia one,
                // which is English on this region.
                const translated = name(mod.key);
                return {
                  filled: true,
                  name: translated === mod.key ? mod.name : translated,
                  image: mod.image,
                  overlay: null,
                };
              }),
            }
          : {}),
      };
    },
  );
}

/**
 * An item's name in the reader's language, the dictionary first.
 *
 * The same order the battle panel uses, and for the same reason: the
 * catalogue carries Wargaming's encyclopedia name, which is English on this
 * region, while the dictionary is the game client's own and is translated. A
 * missing key comes back AS the key from these dictionaries, which is how they
 * report a gap, so that is what the comparison tests.
 */
function namer(
  tEquipment: (key: string) => string,
  icons: Map<string, LoadoutIcon> | undefined,
) {
  return (key: string): string => {
    const translated = tEquipment(key);
    if (translated !== key) return translated;
    return icons?.get(key)?.name || key;
  };
}

/** Where the round icons live, one file per kind. */
const AMMO_ICONS = iconUrl("ammopanel/ammo");

/**
 * The devices a row previews, as pictures.
 *
 * Every slot is an entry and `filled` says which are occupied, rather than a
 * null standing for a free one. A slot the player left free and a slot they
 * filled with something this deployment cannot picture are different things,
 * and both have to draw: collapsing them would quietly turn a loadout of three
 * into a loadout of two on the one surface meant to be read at a glance.
 *
 * No names. The row is a preview and names would have to be translated, which
 * would make this list vary by language and cost it the shared cache it is
 * served from; the battle's own panel names everything.
 */
function pictured(
  devices: (string | null)[],
  icons: Map<string, LoadoutIcon> | undefined,
  name: (key: string) => string,
): {
  filled: boolean;
  name: string | null;
  image: string | null;
  overlay: string | null;
  categories?: string[];
}[] {
  return devices.map((key) => {
    if (!key) return { filled: false, name: null, image: null, overlay: null };
    const entry = icons?.get(key);
    return {
      filled: true,
      name: name(key),
      image: icons ? devicePicture(icons, key) : null,
      // The grade badge and the category dots, so a row draws a device the
      // same way the tank page does. They were missing while this built its
      // own square instead of using the shared one, and a Bounty Rammer was
      // indistinguishable from an ordinary one.
      overlay: gradeOverlay(entry),
      ...(entry?.categories?.length ? { categories: entry.categories } : {}),
    };
  });
}

