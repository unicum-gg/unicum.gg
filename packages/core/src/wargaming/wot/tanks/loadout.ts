import {
  ProvisionType,
  Region,
  type EquipmentEffect,
  type EquipmentGrade,
  type EquipmentSlot,
} from "@unicum.gg/wargaming";
import {
  crewSkillAffectsSpec,
  directiveAffectsSpec,
  iconUrl,
} from "@unicum.gg/shared";
import { wg } from "../../client";
import { cachedInRedis } from "../../../redis";

// wot-src client data changes only on a game patch (refreshed daily by
// vehicles-cron); the parsed result is cached in Redis for a day (shared across
// instances, surviving deploys).
const WOTSRC_TTL_SECONDS = 24 * 60 * 60;

// Crew-skill icons live on the wot.assets mirror by skill key (WG's are dead),
// same source the crew section uses.
const SKILL_ICON_BASE = iconUrl("tankmen/skills/big");

/** A readable name for a crew skill key when WG's `crewskills` has none (e.g.
 * `fireFighting`, `radioman_lastEffort`): strip the role prefix and split the
 * camelCase (`radioman_lastEffort` -> "Last Effort"). */
function humanizeSkillKey(key: string): string {
  const base = key.includes("_") ? key.slice(key.indexOf("_") + 1) : key;
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A mountable equipment with its display identity (WG) and effects (wot-src). */
export interface LoadoutEquipment {
  key: string;
  name: string;
  /** The device's in-game description, from the client localization. */
  description: string;
  image: string | null;
  /** Acquisition grade: standard (credits), bond, or experimental. */
  grade: EquipmentGrade;
  /** wot-src family icon; a directive enhances every mounted device of its icon. */
  icon: string;
  categories: string[];
  effects: EquipmentEffect[];
}

/** A directive (battle booster). Two kinds (`crew` discriminates):
 * - Equipment directive: enhances a mounted device (`equipmentIcon` ties it to
 *   that device so the UI enables it once mounted); `attribute/type/value` scale
 *   one of the device's characteristics. Name/icon come from the device.
 * - Crew directive (`crew: true`): boosts a crew skill even when untrained. It is
 *   always mountable. `boostKind`/`boostValue` scale the skill's effective level
 *   (`level`, `perkLevelMultiplier`) or efficiency (`efficiency`,
 *   `efficiencyFactor`); `effects` are the boosted skill's spec effects (so the
 *   app applies them like a crew skill at the boost level). `camouflage` marks
 *   the Concealment directive, `commander` a commander-role skill (no commander
 *   self-bonus). Name/icon come from the boosted skill. */
export interface LoadoutDirective {
  key: string;
  equipmentIcon: string;
  name: string;
  /** The directive's in-game description, from the client localization. */
  description: string;
  image: string | null;
  attribute: string;
  type: "mul" | "add";
  value: number;
  crew: boolean;
  boostKind: "level" | "efficiency" | null;
  boostValue: number;
  effects: { attribute: string; value: number }[];
  camouflage: boolean;
  commander: boolean;
}

/** A mountable consumable with its display identity (WG) and passive effects
 * (wot-src); `attribute`/`value` pairs are multiplicative on a characteristic. */
export interface LoadoutConsumable {
  key: string;
  name: string;
  /** The consumable's in-game description, from the client localization. */
  description: string;
  image: string | null;
  effects: { attribute: string; value: number }[];
}

/** A tank's equipment loadout: its slots, every compatible device, the
 * directives that enhance those devices, and the mountable consumables. */
export interface TankLoadout {
  slots: EquipmentSlot[];
  equipment: LoadoutEquipment[];
  directives: LoadoutDirective[];
  consumables: LoadoutConsumable[];
}

// Stored WG images are legacy plain-http CDN links; upgrade so they aren't
// blocked as mixed content on our https pages. Some provisions (bounty/trophy
// variants whose wot-src icon is a full client path) come back with a doubled
// `artefact/artefact/` segment that 404s, so collapse it.
function httpsUrl(url: string | null | undefined): string | null {
  return url
    ? url
        .replace(/^http:\/\//, "https://")
        .replace(/\/artefact\/artefact\//, "/artefact/")
    : null;
}

/**
 * A tank's Equipment 2.0 loadout: the slots it exposes (with their categories)
 * and the standard equipment it can mount, each fully derived from the wot-src
 * client XML for its effects and bridged to WG `provisions` (by `tag`, which
 * equals the wot-src key) for the localized name and icon. Returns null when the
 * wot-src catalogue has nothing for the tank.
 */
export function getTankLoadout(
  region: Region,
  tankId: number,
): Promise<TankLoadout | null> {
  return cachedInRedis(`wotsrc:loadout:${region}:${tankId}`, WOTSRC_TTL_SECONDS, () =>
    computeTankLoadout(region, tankId),
  );
}

async function computeTankLoadout(
  region: Region,
  tankId: number,
): Promise<TankLoadout | null> {
  const r = wg.region(region);
  const src = await r.source.equipment.loadout(tankId);
  if (!src || src.equipment.length === 0) return null;

  // Crew directives boost a crew skill, so their name/icon/effects come from the
  // skill catalogue: the localized name from the client's own `crew_perks.po`
  // (covers non-trainable perks WG's API doesn't), the per-level spec effects
  // from wot-src `tankmen`. WG `crewskills` stays only as a name fallback.
  const [crewSkillsApi, crewSkillDefs, perkNames] = await Promise.all([
    r.api.wot.encyclopedia.crewskills({}),
    r.source.crew.skills(),
    r.source.crew.perkNames(),
  ]);
  const skillEffects = new Map<string, { attribute: string; value: number }[]>();
  const skillCamo = new Map<string, boolean>();
  // Innate commander defaults (Sixth Sense) are granted for free, so their
  // directive is pointless; skip it like the crew section skips the skill.
  const specialSkills = new Set(
    crewSkillDefs.filter((d) => d.special).map((d) => d.key),
  );
  for (const d of crewSkillDefs) {
    skillEffects.set(
      d.key,
      d.effects
        .filter((e) => !e.situational && crewSkillAffectsSpec(e.param))
        .map((e) => ({ attribute: e.param, value: e.value })),
    );
    skillCamo.set(d.key, d.effects.some((e) => e.param === "maskingFactor"));
  }

  // Optional devices (equipment) and consumables live under two provision types.
  const provisions = await r.api.wot.encyclopedia.provisions({
    type: [ProvisionType.OptionalDevice, ProvisionType.Equipment],
  });
  const byTag = new Map<string, { name?: string; image?: string }>();
  for (const p of Object.values(provisions)) byTag.set(p.tag, p);

  const equipment: LoadoutEquipment[] = src.equipment.map((e) => {
    const p = byTag.get(e.key);
    return {
      key: e.key,
      name: p?.name ?? e.key,
      description: e.description,
      image: httpsUrl(p?.image),
      grade: e.grade,
      icon: e.icon,
      categories: e.categories,
      effects: e.effects,
    };
  });

  // Derive each directive's display identity (name + image) from the standard
  // device of the family it enhances (matched by the shared `icon`), since WG
  // exposes no directive metadata. Prefer the standard grade for the label.
  const equipByIcon = new Map<string, LoadoutEquipment>();
  for (const eq of equipment) {
    if (!eq.icon) continue;
    const held = equipByIcon.get(eq.icon);
    if (!held || (held.grade !== "standard" && eq.grade === "standard"))
      equipByIcon.set(eq.icon, eq);
  }
  const directives: LoadoutDirective[] = [];
  for (const d of src.directives) {
    if (d.skillName) {
      // Crew directive: boosts a crew skill. Name from WG crewskills, icon from
      // the skill key, effects from the skill's per-level spec effects.
      if (specialSkills.has(d.skillName)) continue;
      const p = crewSkillsApi[d.skillName];
      directives.push({
        key: d.key,
        equipmentIcon: "",
        name: perkNames.get(d.skillName) ?? p?.name ?? humanizeSkillKey(d.skillName),
        description: d.description,
        image: `${SKILL_ICON_BASE}/${d.skillName}.png`,
        attribute: "",
        type: "mul",
        value: 0,
        crew: true,
        boostKind: d.boostKind ?? null,
        boostValue: d.boostValue ?? 0,
        effects: skillEffects.get(d.skillName) ?? [],
        camouflage: skillCamo.get(d.skillName) ?? false,
        commander: d.skillName.startsWith("commander_"),
      });
      continue;
    }
    const equip = equipByIcon.get(d.icon);
    // Keep only equipment directives whose device is mountable here and whose
    // effect moves a displayed characteristic (else toggling looks like a no-op).
    if (!equip || !d.effect || !directiveAffectsSpec(d.effect.attribute)) continue;
    directives.push({
      key: d.key,
      equipmentIcon: equip.icon,
      name: equip.name,
      description: d.description,
      image: equip.image,
      attribute: d.effect.attribute,
      type: d.effect.type,
      value: d.effect.value,
      crew: false,
      boostKind: null,
      boostValue: 0,
      effects: [],
      camouflage: false,
      commander: false,
    });
  }

  // Display order of the consumable categories (the game's own `<tags>`), mirroring
  // the in-game panel: repair kit, first aid kit, extinguisher, then provisions.
  const CONSUMABLE_ORDER: Record<string, number> = {
    repairkit: 0,
    medkit: 1,
    extinguisher: 2,
    fuel: 3,
    stimulator: 4,
  };
  const consumables: LoadoutConsumable[] = [...src.consumables]
    .sort(
      (a, b) =>
        (CONSUMABLE_ORDER[a.category] ?? 99) -
        (CONSUMABLE_ORDER[b.category] ?? 99),
    )
    .map((c) => {
      const p = byTag.get(c.key);
      return {
        key: c.key,
        name: p?.name ?? c.key,
        description: c.description,
        image: httpsUrl(p?.image),
        effects: c.effects,
      };
    });

  // Equipment directives first, then crew directives.
  directives.sort((a, b) => Number(a.crew) - Number(b.crew));

  return { slots: src.slots, equipment, directives, consumables };
}
