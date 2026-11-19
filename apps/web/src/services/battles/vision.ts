import type { Region } from "@unicum.gg/wargaming";
import {
  applyConsumables,
  applyCrewLevel,
  applyCrewSkills,
  applyDirectives,
  applyEquipment,
  applyFieldMods,
  type AppliedCrewSkill,
  type AppliedEquipment,
  type AppliedFieldMod,
  type TankSpec,
} from "@unicum.gg/shared";
import type { BattleLoadout } from "@unicum.gg/core/battles/read";
import { getTankLoadout } from "@unicum.gg/core/wargaming/wot/tanks/loadout";
import { getTankCrew } from "@unicum.gg/core/wargaming/wot/tanks/crew";
import {
  getTankFieldMods,
  getTankPostProgression,
  unpackFieldMods,
} from "@unicum.gg/core/wargaming/wot/tanks/field-mods";

/** The attribute the Binocular Telescope scales view range with, and only once
 * the vehicle has stood still: the one device whose effect is not constant. */
const BINOCULARS = "circularVisionRadius";

/** A vehicle's view range with what it had fitted, moving and stationary. */
export type BattleVision = { moving: number; still: number };

/**
 * The view range a vehicle actually had in a battle, from what it had fitted.
 *
 * The game sends this figure to the player alone, so it is rebuilt here from
 * the recorded loadout, in the order the vehicle configurator composes a build
 * (`hooks/tank-build-specs`): equipment, directives, consumables, field
 * modifications, crew skills, then the crew level that Brothers in Arms, food
 * and Improved Ventilation raise. A crew at full major qualification, which
 * the recording does not state and which nearly every crew that fights has.
 *
 * Only ever for a vehicle whose loadout we hold in full, which is the
 * recorder's: the server strips every other vehicle's devices before they reach
 * a client. Null otherwise, so the page can say it is showing a base figure.
 */
export async function battleVision(
  region: Region,
  tankId: number,
  spec: TankSpec,
  loadout: BattleLoadout,
): Promise<BattleVision | null> {
  if (spec.viewRange === null || !loadout.crew?.length) return null;
  const [catalogue, crew, tree, resolved] = await Promise.all([
    getTankLoadout(region, tankId),
    getTankCrew(region, tankId),
    loadout.fieldModsPacked?.length ? getTankPostProgression(region, tankId) : null,
    loadout.fieldModsPacked?.length ? getTankFieldMods(region, tankId) : null,
  ]);
  if (!catalogue || !crew) return null;

  // Equipment by slot. A slot of the vehicle's role takes whichever category
  // its owner picked, which the recording does not say; the device is given
  // its bonus when it fits one of the slot's options, since that is the choice
  // anybody makes.
  const devices = new Map(catalogue.equipment.map((one) => [one.key, one]));
  const mounted: AppliedEquipment[] = [];
  (loadout.optDevices ?? []).forEach((key, at) => {
    const device = key ? devices.get(key) : undefined;
    const slot = catalogue.slots[at];
    if (!device || !slot) return;
    const options = slot.role ? (slot.roleOptions ?? []) : slot.category ? [slot.category] : [];
    mounted.push({
      effects: device.effects,
      bonus: options.some((category) => device.categories.includes(category)),
    });
  });
  const icons = new Set(
    (loadout.optDevices ?? []).flatMap((key) => (key ? [devices.get(key)?.icon ?? ""] : [])),
  );

  // Directives: a device's only while that device is fitted, a crew one always.
  const fitted = new Set((loadout.boosters ?? []).filter((key): key is string => !!key));
  const directives = catalogue.directives.filter((one) => fitted.has(one.key));
  const deviceDirectives = directives
    .filter((one) => !one.crew && icons.has(one.equipmentIcon))
    .map((one) => ({ attribute: one.attribute, type: one.type, value: one.value }));
  const crewDirectives: AppliedCrewSkill[] = directives
    .filter((one) => one.crew && one.boostKind === "level" && one.effects.length > 0)
    .map((one) => ({
      effects: one.effects.map((e) => ({ param: e.attribute, value: e.value })),
      scale: one.boostValue * (one.commander ? 1 : 1.1),
    }));

  const supplies = new Map(catalogue.consumables.map((one) => [one.key, one]));
  const consumed = (loadout.consumables ?? []).flatMap((key) =>
    key ? (supplies.get(key)?.effects ?? []) : [],
  );

  // Field modifications: every base step up to the rank reached, and the side
  // taken of each pair.
  const progression: AppliedFieldMod[] = [];
  if (tree && resolved) {
    const { level, pairs } = unpackFieldMods(loadout.fieldModsPacked, tree.steps);
    const sides = new Map(pairs.map((pair) => [pair.name, pair.side]));
    for (const step of resolved.steps) {
      if (step.modification && step.level <= level) {
        progression.push(...step.modification.effects);
      }
      const side = step.pair ? sides.get(step.pair.key) : undefined;
      if (step.pair && side) {
        progression.push(...(side === "first" ? step.pair.first : step.pair.second).effects);
      }
    }
  }

  // Crew skills seat by seat, in the catalogue's seat order, which is the
  // client's and the recording's. The commander lifts every other seat by a
  // tenth of his own level; the skills every seat can learn are crew-averaged
  // and applied once, as the configurator does.
  const skills = new Map(crew.skills.map((one) => [one.key, one]));
  const seats = crew.members.length || loadout.crew.length;
  const trained: AppliedCrewSkill[] = [];
  let levelPoints = 0;
  loadout.crew.forEach((member) => {
    for (const key of member.skills) {
      const skill = skills.get(key);
      if (!skill) continue;
      if (skill.crewLevel > 0) levelPoints += skill.crewLevel;
      if (skill.role === "common" || skill.effects.length === 0) continue;
      trained.push({
        effects: skill.effects.map((e) => ({ param: e.attribute, value: e.value })),
        scale: member.role === "commander" ? 1 : 1.1,
      });
    }
  });
  const sumOf = (effects: { attribute: string; value: number }[], attribute: string) =>
    effects.filter((e) => e.attribute === attribute).reduce((sum, e) => sum + e.value, 0);
  const deviceLevel = mounted
    .flatMap((one) =>
      one.effects
        .filter((e) => e.attribute === "miscAttrs/crewLevelIncrease")
        .map((e) => (one.bonus ? e.bonus : e.base)),
    )
    .reduce((sum, value) => sum + value, 0);
  const crewLevel =
    levelPoints / seats + deviceLevel + sumOf(consumed, "crewLevelIncrease");

  const compose = (equipment: AppliedEquipment[]): number | null => {
    let out = equipment.length ? applyEquipment(spec, equipment) : spec;
    if (deviceDirectives.length) out = applyDirectives(out, deviceDirectives);
    if (consumed.length) out = applyConsumables(out, consumed);
    if (progression.length) out = applyFieldMods(out, progression, 0);
    if (trained.length) out = applyCrewSkills(out, trained, 1);
    if (crewDirectives.length) out = applyCrewSkills(out, crewDirectives, 1);
    if (crewLevel > 0) out = applyCrewLevel(out, crewLevel);
    return out.viewRange;
  };
  // Without the binoculars' effect while moving, with it once still.
  const moving = compose(
    mounted.map((one) => ({
      ...one,
      effects: one.effects.filter((e) => e.attribute !== BINOCULARS),
    })),
  );
  const still = compose(mounted);
  if (moving === null || still === null) return null;
  return { moving: Math.round(moving), still: Math.round(still) };
}
