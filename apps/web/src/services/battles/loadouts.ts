import { crewRoleBadgeUrl, type Region } from "@unicum.gg/wargaming";
import { iconUrl } from "@unicum.gg/shared";
import type { BattleDetail, BattleLoadout } from "@unicum.gg/core/battles/read";
import { fieldModSlots } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import {
  crewSkillIcon,
  devicePicture,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import { traced } from "@unicum.gg/core/lib/perf-trace";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { getTranslation } from "@/lib/translations.server";

/** Where the round icons live, which is one folder for every kind. */
const AMMO_ICONS = iconUrl("ammopanel/ammo");

type NamedSlot = { name: string | null; image: string | null; overlay: string | null };

/** One vehicle's loadout for one life, named and pictured. */
export type NamedBattleLoadout = {
  life: number;
  optDevices: NamedSlot[];
  boosters: NamedSlot[];
  consumables: NamedSlot[];
  shells: { kind: string; count: number; premium: boolean; image: string }[];
  fieldMods: NamedSlot[];
  crew: {
    role: string;
    roleImage: string | null;
    skills: { name: string; image: string }[];
  }[];
};

type Participant = BattleDetail["participants"][number];

/**
 * A battle's participants with what they had fitted named and pictured, in one
 * language.
 *
 * Unusual for this API, which otherwise serves data and leaves presentation to
 * the page, and the reason is that the page cannot do it: `game/equipment` and
 * `game/crew-perks` are twenty-one kilobytes that would ride on every page of
 * the site to name a loadout, so they are stripped before the dictionaries
 * cross the wire, and a client component that reads one gets its key back. So
 * the resolution happens here, where the locale and the catalogues both exist.
 *
 * It used to be an endpoint of its own beside the battle, because the language
 * was a cookie and the battle sits in a shared cache. With the language in the
 * URL the battle can carry it, which saves the page a second request it had to
 * wait for.
 */
export async function nameBattleLoadouts(
  region: Region,
  locale: string,
  participants: Participant[],
): Promise<(Omit<Participant, "loadouts"> & { loadouts?: NamedBattleLoadout[] })[]> {
  const fitted = participants.filter((p) => p.loadouts?.length);
  // Nothing to name, which is most battles: no dictionary, no catalogue.
  if (fitted.length === 0) {
    return participants.map((participant) => {
      const { loadouts, ...rest } = participant;
      return loadouts ? rest : participant;
    });
  }

  // The vehicle a life was played in, the participant's own when the
  // recording left it unnamed (a respawn).
  const tankOf = (participant: Participant, loadout: BattleLoadout) =>
    loadout.tankId ?? participant.tank?.id ?? null;

  const [{ t: tEquipment }, { t: tPerks }, { t: tRoles }, { t: tGame }] =
    await Promise.all([
      getTranslation("game/equipment", locale),
      getTranslation("game/crew-perks", locale),
      getTranslation("game/crew-roles", locale),
      getTranslation("game/vocabulary", locale),
    ]);

  // One catalogue per tank, fetched once however many lives that tank had.
  // The pictures are a fact about the vehicle, not about the battle.
  const tanks = new Set<number>();
  for (const participant of fitted) {
    for (const loadout of participant.loadouts ?? []) {
      const tank = tankOf(participant, loadout);
      if (tank !== null) tanks.add(tank);
    }
  }
  const catalogues = new Map<number, Map<string, LoadoutIcon>>();
  await traced("loadoutIcons", () =>
    Promise.all(
      [...tanks].map(async (tank) => {
        catalogues.set(tank, await loadoutIcons(region, tank));
      }),
    ),
  );

  // Resolved once per (vehicle, packed value): a respawn mode repeats the same
  // build across lives, and so do two team mates on one tank.
  const modKey = (tank: number | null, packed: number[]) =>
    `${tank}:${packed.join(",")}`;
  const mods = new Map<string, Awaited<ReturnType<typeof fieldModSlots>>>();
  const wanted = new Map<string, { tank: number; packed: number[] }>();
  for (const participant of fitted) {
    for (const loadout of participant.loadouts ?? []) {
      const tank = tankOf(participant, loadout);
      if (tank === null || !loadout.fieldModsPacked.length) continue;
      wanted.set(modKey(tank, loadout.fieldModsPacked), {
        tank,
        packed: loadout.fieldModsPacked,
      });
    }
  }
  await traced("fieldModSlots", () =>
    Promise.all(
      [...wanted].map(async ([key, { tank, packed }]) => {
        mods.set(key, await fieldModSlots(region, tank, packed));
      }),
    ),
  );

  /**
   * One slot, named and pictured.
   *
   * The DICTIONARY first, then the catalogue. The garage's own panel does the
   * opposite, on the stated belief that the two agree -- and for an English
   * reader they do. They do not otherwise: the catalogue carries Wargaming's
   * encyclopedia name, which is English on this region, while the dictionary
   * is the game client's own and is translated, so `chocolate` is "Chocolate"
   * from one and "Chocolat" from the other. A French reader asking what was
   * fitted should be told in French, so the translated name wins here and the
   * catalogue answers for the keys it does not hold.
   *
   * A missing key comes back AS the key from the dictionary rather than as
   * nothing, which is how these dictionaries report a gap, so that is what the
   * comparison below tests. Without it the catalogue would never be reached
   * and an untranslated device would be drawn as its raw key.
   *
   * A key under the `unknown:` prefix is an item this deployment's catalogues
   * do not hold at all, which the decoder keeps rather than turning into a null
   * so that a filled slot is never drawn as an empty one. Neither source can
   * name it, so it is shown as itself.
   */
  const slot = (
    key: string | null,
    icons: Map<string, LoadoutIcon> | undefined,
  ): NamedSlot => {
    if (!key) return { name: null, image: null, overlay: null };
    const entry = icons?.get(key);
    const translated = tEquipment(key);
    return {
      name: (translated !== key ? translated : "") || entry?.name || key,
      // Through `devicePicture` and not `entry.image`: a vehicle's equipment
      // list carries only the grades the encyclopedia lists for it, and it is
      // not complete, so a grade the player really fitted can be missing from
      // it. The picture is the family's in any case.
      image: devicePicture(icons ?? new Map(), key),
      overlay: gradeOverlay(entry),
    };
  };

  const named = (participant: Participant, loadout: BattleLoadout): NamedBattleLoadout => {
    const tank = tankOf(participant, loadout);
    const icons = tank === null ? undefined : catalogues.get(tank);
    return {
      life: loadout.life,
      optDevices: loadout.optDevices.map((key) => slot(key, icons)),
      boosters: loadout.boosters.map((key) => slot(key, icons)),
      consumables: loadout.consumables.map((key) => slot(key, icons)),
      shells: loadout.shells.map((shell) => ({
        // AP, APCR, HEAT, HE, in the reader's language. The same block the
        // tank pages read, so the two call a round by the same name.
        kind: tGame(`shells.${shell.type}`) || shell.type,
        count: shell.count,
        premium: shell.premium,
        image: `${AMMO_ICONS}/${shell.type}.png`,
      })),
      fieldMods: (mods.get(modKey(tank, loadout.fieldModsPacked)) ?? []).map(
        (mod) => {
          if (!mod.key) return { name: null, image: null, overlay: null };
          const translated = tEquipment(mod.key);
          return {
            name: (translated !== mod.key ? translated : "") || mod.name,
            image: mod.image,
            overlay: null,
          };
        },
      ),
      // One line per seat, which is simpler AND truer than the garage's
      // panel: there, the skills arrive as one list per crew and the seat that
      // learned each has to be inferred from a catalogue. A recording says
      // outright which member carries what.
      crew: loadout.crew.map((member) => ({
        role: tRoles(member.role) || member.role,
        roleImage: crewRoleBadgeUrl(region, member.role),
        skills: member.skills.map((name) => ({
          name: tPerks(name) || name,
          image: crewSkillIcon(name),
        })),
      })),
    };
  };

  return participants.map(({ loadouts, ...participant }) =>
    loadouts?.length
      ? {
          ...participant,
          loadouts: loadouts.map((loadout) =>
            named({ ...participant, loadouts }, loadout),
          ),
        }
      : participant,
  );
}
