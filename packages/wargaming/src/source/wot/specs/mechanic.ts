import { isObject, type XmlNode } from "./xml";

/**
 * Which mechanic a vehicle's second state actually is.
 *
 * **`siegeMode` is a switch, not a stance.** The client tags every vehicle that
 * has any second state with it, and seven different mechanics ride that one tag.
 * Calling all of them "siege" is right only for the vehicles that kneel, which
 * is why the Panhard EBR was being offered a siege button for what is its road
 * mode, and the Pz.Kpfw. Neu one for what is its gun.
 *
 * Read from the three things the client itself reads: the vehicle's tags, the
 * `<mechanics>` blocks its components declare, and what its `<siege_mode>` says
 * the switch operates. Across every vehicle in the client that carries the tag,
 * those three fall into exactly seven combinations, one per mechanic.
 */
export enum VehicleMechanic {
  /** The hull kneels on its suspension: the Strv, the UDES, the Kunze Panzer. */
  Siege = "siege",
  /** A wheeled chassis locks its wheels for the road: the Panhard EBR. */
  Wheeled = "wheeled",
  /** Two guns fired as one: the IS-3-II and the rest of the double barrels. */
  DualGun = "dualGun",
  /** The gun opens extra chambers and recalibrates its shells. */
  ShellSwitcher = "shellParamsSwitcher",
  /** A shot the gun can take mid-reload, on a partial charge. */
  LowCharge = "lowChargeShot",
  /** A gas turbine that spins up rather than a stance the vehicle stands in. */
  Turboshaft = "turboshaftEngine",
  /** Two barrels on one mount, fired together. */
  TwinGun = "twinGun",
}

/**
 * What the vehicle is in, before and after the switch, in the game's own words.
 *
 * Every one of these is a string the client already ships, so a reader meets on
 * the site the words the battle interface uses rather than a paraphrase:
 *
 * - `siegeMode/hint/forMode/0` and `/2`, the generic Siege and Travel pair
 * - `shells_kinds/params/header/shellParamsSwitcher`, "Standard / Calibrated"
 * - `shells_kinds/params/header/lowChargeShot`, "Full / Single-Charge"
 * - `detailsHelp/dualGun/volley_fire/title` and the twin gun's own help page,
 *   both of which call the second state salvo fire
 * - the turbine help page, "the charged turbine mode increases engine power"
 *
 * The wheeled pair is the one the client states only as a sentence
 * (`siegeMode/hint/wheeled`, "to switch the movement mode"); its two modes are
 * named in the battle interface, where the second one reads Rapid.
 */
export const MECHANIC_STATES: Record<
  VehicleMechanic,
  { travel: string; engaged: string }
> = {
  [VehicleMechanic.Siege]: { travel: "Travel", engaged: "Siege" },
  [VehicleMechanic.Wheeled]: { travel: "Travel", engaged: "Rapid" },
  [VehicleMechanic.DualGun]: { travel: "Single", engaged: "Salvo" },
  [VehicleMechanic.ShellSwitcher]: {
    travel: "Standard",
    engaged: "Calibrated",
  },
  [VehicleMechanic.LowCharge]: { travel: "Full", engaged: "Single-Charge" },
  [VehicleMechanic.Turboshaft]: { travel: "Travel", engaged: "Turbine" },
  [VehicleMechanic.TwinGun]: { travel: "Single", engaged: "Salvo" },
};

/** The tag on the vehicle that names its mechanic, as the client spells it. */
const BY_TAG: [string, VehicleMechanic][] = [
  ["wheeledVehicle", VehicleMechanic.Wheeled],
  ["turboshaftEngine", VehicleMechanic.Turboshaft],
  // Lowercase, deliberately: `dualgun` is the vehicle type, where `dualGun` is
  // a tag the client derives onto the gun itself.
  ["dualgun", VehicleMechanic.DualGun],
];

/**
 * The `<mechanics>` block that names a mechanic, where one does.
 *
 * Only these two, out of the thirty-one blocks the client defines: the rest are
 * abilities a vehicle carries alongside its second state rather than the state
 * itself. `pillboxSiegeMode` is a *third* stance the Strv 107-12 can take past
 * its siege, and `bustleFeed` an ammunition feed the BV 111 switches on while
 * kneeling, so both of those vehicles are still, for this button, sieges.
 */
const BY_BLOCK: [string, VehicleMechanic][] = [
  ["shellParamsSwitcher", VehicleMechanic.ShellSwitcher],
  ["lowChargeShot", VehicleMechanic.LowCharge],
];

/** Every value under `key` anywhere in a vehicle definition. */
function find(node: unknown, key: string, into: unknown[], depth = 0): void {
  if (!isObject(node) || depth > 7) return;
  for (const [k, v] of Object.entries(node)) {
    if (k === key) into.push(v);
    else find(v, key, into, depth + 1);
  }
}

/** Every `<mechanics>` block name the vehicle's components declare. */
function blocksOf(root: XmlNode): Set<string> {
  const found: unknown[] = [];
  find(root, "mechanics", found);
  const out = new Set<string>();
  for (const block of found) {
    if (isObject(block)) for (const name of Object.keys(block)) out.add(name);
  }
  return out;
}

/**
 * What the switch operates, which the client calls the siege device.
 *
 * `gun` on every vehicle whose second state transforms the gun rather than the
 * hull, and absent on every vehicle where the hull is what moves. It is what
 * keeps an unrelated ability from being read as the mode: a vehicle can declare
 * a gun block and still be a plain siege, and this says which it is.
 */
function deviceOf(root: XmlNode): string {
  const found: unknown[] = [];
  find(root, "siege_mode", found);
  for (const siege of found) {
    if (!isObject(siege)) continue;
    const device = siege.device;
    if (typeof device === "string" && device.trim()) return device.trim();
  }
  return "";
}

/**
 * This vehicle's second state, or null where it has none.
 *
 * Given the tags already split, because the value they come from is not always
 * a string: a leaf that also carries child elements arrives as an object
 * wrapping its `#text`, and turning that into a string reads `[object Object]`,
 * finds no `siegeMode`, and quietly calls every one of these vehicles ordinary.
 */
export function mechanicOf(
  root: XmlNode,
  tags: string[],
): VehicleMechanic | null {
  const words = new Set(tags);
  if (!words.has("siegeMode")) return null;
  if (deviceOf(root) === "gun") {
    const blocks = blocksOf(root);
    for (const [name, mechanic] of BY_BLOCK) {
      if (blocks.has(name)) return mechanic;
    }
    if (words.has("twinGun")) return VehicleMechanic.TwinGun;
  }
  for (const [tag, mechanic] of BY_TAG) if (words.has(tag)) return mechanic;
  // Anything tagged for a second state and naming nothing more is a hull that
  // kneels, which is the mechanic the tag was originally for.
  return VehicleMechanic.Siege;
}
