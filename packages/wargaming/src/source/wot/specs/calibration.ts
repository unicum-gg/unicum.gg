import { isObject, type XmlNode } from "./xml";

/**
 * What a vehicle's deployed state does to the shells it fires.
 *
 * **A whole mechanic that lives in one block.** The Pz.Kpfw. Neu opens three
 * extra chambers in its gun, which the client calls `shellParamsSwitcher` and
 * hangs off the siege mode: `<device>gun</device>` in its `<siege_mode>` says it
 * is the gun that transforms rather than the hull, and the client's own
 * `ShellSwitcherParams.isActiveMechanics` is simply `hasSiegeMode`. Everything
 * it changes is a `<shots>` block in the deployed definition, restating only the
 * shells the gun lists as modifiable. Nothing else in that file differs, which
 * is why the vehicle's gun travel and hull attitude are identical deployed.
 *
 * Read rather than computed: the client states the new figures outright, and the
 * trade it describes (armour damage given up for penetrating power) is not
 * something to infer from a name.
 */
export type CalibratedShell = {
  /** Degrees it straightens by on impact, where the deployed state changes it. */
  normalization?: number;
  /** Impact angle past which it glances off, where that changes. */
  ricochet?: number;
  /** Armour damage while calibrated, which is where the cost of it shows. */
  damage?: number;
  /**
   * How much penetration it sheds with distance, where the deployed state sets
   * one, which on a HEAT shell that normally has none is the price of the mode.
   *
   * **Carried and not applied, deliberately.** Every other figure here replaces
   * one the client also states plainly, so swapping it in says exactly what the
   * game says. This one does not: the client keeps penetration as a pair of
   * values at 100 and 500 metres and this factor is neither of them. It reads
   * the number, multiplies it by ten and hands it to the engine, which owns the
   * curve. Turning it into a penetration at range here would mean inventing
   * that curve and printing the result as though the game had said it.
   *
   * Published so a reader of the mirror can see the mode does something to
   * penetration at all, and so this stays one lookup away from whoever works
   * the falloff out.
   */
  penetrationLoss?: number;
};

/** The name of the mechanic, as the client's own components call it. */
const SWITCHER = "shellParamsSwitcher";

const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || isObject(v)) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Every gun a vehicle definition carries, by its own element name.
 *
 * They hang three deep, `turrets0 > <turret> > guns > <gun>`, and a vehicle with
 * two turrets lists each one's guns under it.
 */
function gunsOf(root: XmlNode): XmlNode[] {
  const turrets = root.turrets0;
  if (!isObject(turrets)) return [];
  const out: XmlNode[] = [];
  for (const turret of Object.values(turrets)) {
    if (!isObject(turret)) continue;
    const guns = turret.guns;
    if (!isObject(guns)) continue;
    for (const gun of Object.values(guns)) if (isObject(gun)) out.push(gun);
  }
  return out;
}

/**
 * Whether any of this vehicle's guns recalibrates its shells.
 *
 * Asked before the deployed file is fetched at all: every vehicle has a
 * definition to read and almost none of them has this, so the extra request is
 * made only where there is something in it.
 */
export function switchesShells(root: XmlNode): boolean {
  return gunsOf(root).some((gun) => {
    const mechanics = gun.mechanics;
    return isObject(mechanics) && isObject(mechanics[SWITCHER]);
  });
}

/**
 * The figures each shell takes on once the gun is calibrated, by shell name.
 *
 * Only what the deployed file actually restates is returned: a shell it leaves
 * alone is absent, and so is a field it does not mention, rather than being
 * repeated from the travelling state.
 *
 * Keyed by the shell's own element name, which is what a shell's `userString`
 * ends with, so the two are matched without going through the gun: no vehicle
 * calibrates one shell two ways, and the gun a shell belongs to is already
 * settled by the time these are read.
 */
export function calibratedShells(
  deployed: XmlNode,
): Map<string, CalibratedShell> {
  const out = new Map<string, CalibratedShell>();
  for (const gun of gunsOf(deployed)) {
    const shots = gun.shots;
    if (!isObject(shots)) continue;
    for (const [shell, spec] of Object.entries(shots)) {
      if (!isObject(spec) || out.has(shell)) continue;
      const changed: CalibratedShell = {
        normalization: num(spec.normalizationAngle),
        ricochet: num(spec.ricochetAngle),
        damage: isObject(spec.damage) ? num(spec.damage.armor) : undefined,
        penetrationLoss: num(spec.piercingPowerLossFactorByDistance),
      };
      // A `<shots>` entry that restates nothing is not worth carrying.
      if (Object.values(changed).some((v) => v !== undefined)) {
        out.set(shell, changed);
      }
    }
  }
  return out;
}
