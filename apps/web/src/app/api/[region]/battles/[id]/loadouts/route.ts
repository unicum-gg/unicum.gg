import * as z from "zod";
import type { NextRequest } from "next/server";
import { isRegion, crewRoleBadgeUrl, type Region } from "@unicum.gg/wargaming";
import { iconUrl } from "@unicum.gg/shared";
import { readBattleLoadouts } from "@unicum.gg/core/battles/loadouts";
import { fieldModSlots } from "@unicum.gg/core/wargaming/wot/tanks/field-mods";
import {
  crewSkillIcon,
  devicePicture,
  loadoutIcons,
  type LoadoutIcon,
} from "@unicum.gg/core/tanks/loadout-icons";
import { normaliseBattleId } from "@unicum.gg/core/battles/ingest";
import { gradeOverlay } from "@/components/players/detail/tanks/loadout-marks";
import { getTranslation } from "@/lib/translations.server";
import { getPreferredLocale } from "@/lib/translations";
import { jsonResponse } from "@/services/openapi/json-response";
import { measured } from "@/services/perf";
import { BattleLoadoutsResponse } from "./schema.api";

/** Where the round icons live, which is one folder for every kind. */
const AMMO_ICONS = iconUrl("ammopanel/ammo");

/**
 * Battle loadouts
 * @description What the vehicles of one battle had fitted, already named in the reader's language and pictured. One panel per vehicle per life, and only for the vehicles a recording could speak for: the player whose client recorded the battle, and any team mate they followed after dying. Empty for a battle with no recording, which is most of them. Nothing is ever known this way about the other team.
 * @pathParams battleParams
 * @response BattleLoadoutsResponse
 * @tag Players
 * @openapi
 */
export async function GET(...args: Parameters<typeof GET__perf>) {
  return measured("GET /{region}/battles/{id}/loadouts", () => GET__perf(...args));
}

async function GET__perf(
  // `NextRequest` rather than `Request`: the locale is decided by a cookie,
  // and only Next's request exposes them as an object. `proxy.ts` reads it the
  // same way for the same reason.
  req: NextRequest,
  { params }: { params: Promise<{ region: string; id: string }> },
) {
  const { region, id } = await params;
  if (!isRegion(region)) {
    return Response.json({ error: "invalid_region" }, { status: 400 });
  }
  if (!/^[0-9]{1,20}$/.test(id)) {
    return Response.json({ error: "invalid_battle" }, { status: 400 });
  }

  try {
    const stored = await readBattleLoadouts(region, normaliseBattleId(id));
    if (stored.length === 0) {
      return answer({ panels: [] });
    }

    const locale = getPreferredLocale(req);
    const [{ t: tEquipment }, { t: tPerks }, { t: tRoles }, { t: tGame }] =
      await Promise.all([
        getTranslation("game/equipment", locale),
        getTranslation("game/crew-perks", locale),
        getTranslation("game/crew-roles", locale),
        getTranslation("game/vocabulary", locale),
      ]);

    // One catalogue per tank, fetched once however many lives that tank had.
    // The pictures are a fact about the vehicle, not about the battle.
    const tanks = [
      ...new Set(
        stored
          .map((row) => row.tankId)
          .filter((tank): tank is number => tank !== null),
      ),
    ];
    const catalogues = new Map<number, Map<string, LoadoutIcon>>();
    await Promise.all(
      tanks.map(async (tank) => {
        catalogues.set(tank, await loadoutIcons(region as Region, tank));
      }),
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
     * nothing, which is how these dictionaries report a gap, so that is what
     * the comparison below tests. Without it the catalogue would never be
     * reached and an untranslated device would be drawn as its raw key.
     *
     * A key under the `unknown:` prefix is an item this deployment's catalogues
     * do not hold at all, which the decoder keeps rather than turning into a
     * null so that a filled slot is never drawn as an empty one. Neither source
     * can name it, so it is shown as itself.
     */
    const slot = (key: string | null, icons: Map<string, LoadoutIcon> | undefined) => {
      if (!key) return { name: null, image: null, overlay: null };
      const entry = icons?.get(key);
      const translated = tEquipment(key);
      return {
        name: (translated !== key ? translated : "") || entry?.name || key,
        // Through `devicePicture` and not `entry.image`: a vehicle's equipment
        // list carries only the grades the encyclopedia lists for it, and it
        // is not complete, so a grade the player really fitted can be missing
        // from it. The picture is the family's in any case.
        image: devicePicture(icons ?? new Map(), key),
        overlay: gradeOverlay(entry),
      };
    };

    // Resolved once per (vehicle, packed value): a respawn mode repeats the
    // same build across lives, and so do two team mates on one tank.
    const mods = new Map<string, Awaited<ReturnType<typeof fieldModSlots>>>();
    await Promise.all(
      [
        ...new Set(
          stored
            .filter((row) => row.tankId !== null && row.fieldModsPacked.length)
            .map((row) => `${row.tankId}:${row.fieldModsPacked.join(",")}`),
        ),
      ].map(async (key) => {
        const [tank, packed] = key.split(":");
        mods.set(
          key,
          await fieldModSlots(region, Number(tank), packed.split(",").map(Number)),
        );
      }),
    );

    const panels = stored.map((row) => {
      const icons = row.tankId === null ? undefined : catalogues.get(row.tankId);
      return {
        vehicle: row.vehicleId,
        life: row.life,
        optDevices: row.optDevices.map((key) => slot(key, icons)),
        boosters: row.boosters.map((key) => slot(key, icons)),
        consumables: row.consumables.map((key) => slot(key, icons)),
        shells: row.shells.map((shell) => ({
          // AP, APCR, HEAT, HE, in the reader's language. The same block the
          // tank pages read, so the two call a round by the same name.
          kind: tGame(`shells.${shell.type}`) || shell.type,
          count: shell.count,
          premium: shell.premium,
          image: `${AMMO_ICONS}/${shell.type}.png`,
        })),
        // One line per seat, which is simpler AND truer than the garage's
        // panel: there, the skills arrive as one list per crew and the seat
        // that learned each has to be inferred from a catalogue. A recording
        // says outright which member carries what.
        fieldMods: (
          mods.get(`${row.tankId}:${row.fieldModsPacked.join(",")}`) ?? []
        ).map((mod) => {
          if (!mod.key) return { name: null, image: null, overlay: null };
          const translated = tEquipment(mod.key);
          return {
            name: (translated !== mod.key ? translated : "") || mod.name,
            image: mod.image,
            overlay: null,
          };
        }),
        crew: row.crew.map((member) => ({
          role: tRoles(member.role) || member.role,
          roleImage: crewRoleBadgeUrl(region as Region, member.role),
          skills: member.skills.map((name) => ({
            name: tPerks(name) || name,
            image: crewSkillIcon(name),
          })),
        })),
      };
    });

    return answer({ panels });
  } catch (err) {
    console.error(`[api/${region}/battles/${id}/loadouts] failed:`, err);
    return Response.json({ error: "upstream_failure" }, { status: 502 });
  }
}

/**
 * The answer, cached in the reader's own browser and nowhere else.
 *
 * `private` and not `s-maxage`, unlike the battle it belongs to. A battle never
 * changes and is the same for everybody, so a shared cache can hold it for an
 * hour; this carries words in ONE language, and the language is decided by a
 * cookie. Varying a shared cache on the cookie would give every session its own
 * entry, which is not a cache at all, and leaving it shared would hand the next
 * reader the previous reader's language. So the reader's own browser keeps it,
 * where there is exactly one language to be wrong about.
 */
function answer(body: z.infer<typeof BattleLoadoutsResponse>) {
  return jsonResponse(BattleLoadoutsResponse, body, {
    headers: { "cache-control": "private, max-age=3600" },
  });
}
