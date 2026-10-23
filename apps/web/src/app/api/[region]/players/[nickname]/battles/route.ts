import { isRegion } from "@unicum.gg/wargaming";
import {
  MAX_RECENT_BATTLES,
  RECENT_BATTLES,
  recentBattlesOf,
} from "@unicum.gg/core/battles/read";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import { jsonResponse } from "@/services/openapi/json-response";
import { PlayerBattlesResponse } from "./schema.api";
import {
  devicePicture,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import { iconUrl } from "@unicum.gg/shared";
import {
  fieldModSlots,
  type FieldModSlot,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import { getTranslation } from "@/lib/translations.server";
import { contentLanguage, interfaceLanguage } from "@/services/openapi/locale";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { measured } from "@/services/perf";

/**
 * Player battles
 * @description A player's most recent battles: the map, the mode, the vehicle they brought and what it did, newest first. Wargaming publishes an account's running totals and nothing about a single battle, so every battle here exists only because somebody who was in it runs the unicum.gg mod and shares them. A player's history therefore begins the day someone in their battles started sharing, and an empty list means nobody has, not that they have not played. 404 when the nickname is unknown in this region.
 * @pathParams playerLiveParams
 * @queryParams playerBattlesQuery
 * @response PlayerBattlesResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/players/{nickname}/battles", () =>
    GET__perf(...args),
  );
}
async function GET__perf(
  req: Request,
  { params }: { params: Promise<{ region: string; nickname: string }> },
) {
  const { region, nickname } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  const decoded = decodeURIComponent(nickname);
  const asked = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(asked) && asked > 0 ? asked : RECENT_BATTLES;

  try {
    const account = await resolveAccountByNickname(region, decoded);
    if (!account) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const battles = await recentBattlesOf(
      region,
      account.accountId,
      Math.min(limit, MAX_RECENT_BATTLES),
    );
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
    const served = interfaceLanguage(req);
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

    // Short, because the next battle is minutes away and a stale list is the
    // one thing a player checking their own page will notice. Short rather
    // than none, because a page load asks for this alongside everything else
    // and a reader refreshing twice should not cost two index probes.
    return jsonResponse(
      PlayerBattlesResponse,
      {
        accountId: account.accountId,
        // The resolver answers null when it found the account without a name
        // to go with it, which a rename history lookup can. The asked-for name
        // is then the only one there is, and it is the one the reader typed.
        nickname: account.nickname ?? decoded,
        // `devices` is pulled OUT of the spread rather than written over it:
        // the database layer hands back catalogue KEYS under that name and
        // this answer carries PICTURES, so spreading first would put both
        // shapes in the type and neither reader would know which it had.
        battles: battles.map(
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
        ),
      },
      contentLanguage(served, {
        headers: { "cache-control": "public, max-age=60" },
      }),
    );
  } catch (err) {
    console.error(`[api/${region}/players/${decoded}/battles] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
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
