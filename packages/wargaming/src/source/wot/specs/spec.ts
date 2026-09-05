import type { CalibratedShell } from "./calibration";

// What one module combination of a vehicle is, and what it is worth.
//
// The shape published for every configuration a tank can be built in: the
// combination's own keys, and the full characteristics derived from it. It is
// the `tank_specs` row shape minus the tag, which is what lets a page render a
// picked build and a stock row through the same component.
//
// Its own file because it is read far more often than it changes, and it is
// what a consumer of the catalogue actually imports: the resource that fills it
// in is an implementation detail beside it.


/**
 * A fully-derived, top-configuration stat block for one vehicle, computed from
 * the raw WoT client XML (IzeBerg/wot-src mirror). Every field is the stock
 * value with the top module of each slot equipped (last module in document
 * order), no crew/equipment bonuses applied. `null` marks a value that does not
 * exist for that vehicle class (e.g. `intraClipReload` on a single-shot gun, or
 * `turretArmorFront` on a casemate TD).
 */
/**
 * One derived stat block for a specific module combination, tagged by the
 * wot-src module keys that produced it. The keys are opaque wot-src identifiers
 * (e.g. `_AMX_50_120`); the consumer bridges them to WG moduleIds by matching a
 * few raw stats (`spec.reload`, `enginePower`, `turretTraverse`, `hullTraverse`,
 * `radioRange`) against WG's `vehicleprofiles`, since both sources derive from
 * the same game data and those numbers are identical.
 */
export interface WotSrcConfig {
  keys: {
    chassis: string;
    turret: string;
    gun: string;
    engine: string;
    radio: string;
  };
  spec: WotSrcSpec;
}

/** Every valid module combination for one tank, each fully derived. */
export interface TankConfigs {
  tankId: number;
  tag: string;
  configs: WotSrcConfig[];
}

export type WotSrcSpec = {
  tankId: number;
  tag: string;
  // Tier-XI special-ability parameters from the top gun's `<mechanics>` block,
  // keyed by path (`propellantAfterburnerGun/chargingPerSec`). Empty for the vast
  // majority of vehicles, which have no mechanic.
  mechanics: Record<string, number>;
  /**
   * Which mechanic this vehicle's second state is, or null where it has none.
   *
   * The client tags every one of them `siegeMode` and maps seven different
   * mechanics onto that tag, so the tag alone cannot name the button a reader
   * presses: the Panhard EBR was being offered a siege mode for what is its
   * road mode.
   */
  mechanic: string | null;
  // firepower
  damage: number | null;
  moduleDamage: number | null;
  splashRadius: number | null;
  reload: number | null;
  rof: number | null;
  intraClipReload: number | null;
  clipSize: number | null;
  dpm: number | null;
  penetration: number | null;
  penetration500: number | null;
  caliber: number | null;
  shellVelocity: number | null;
  maxRange: number | null;
  ammoCapacity: number | null;
  // gun handling
  accuracy: number | null;
  aimTime: number | null;
  dispMoving: number | null;
  dispTankTraverse: number | null;
  dispTurretTraverse: number | null;
  dispAfterShot: number | null;
  dispWhileDamaged: number | null;
  gunArc: number | null;
  depression: number | null;
  elevation: number | null;
  // mobility
  speedForward: number | null;
  speedBackward: number | null;
  hullTraverse: number | null;
  turretTraverse: number | null;
  enginePower: number | null;
  powerWeight: number | null;
  terrainHard: number | null;
  terrainMedium: number | null;
  terrainSoft: number | null;
  // survivability
  health: number | null;
  engineHealth: number | null;
  engineFireChance: number | null;
  hullArmorFront: number | null;
  hullArmorSide: number | null;
  hullArmorRear: number | null;
  turretArmorFront: number | null;
  turretArmorSide: number | null;
  turretArmorRear: number | null;
  trackArmor: number | null;
  trackHealth: number | null;
  trackRepaired: number | null;
  trackRepairTime: number | null;
  ammoRackHealth: number | null;
  ammoRackRepaired: number | null;
  engineRepaired: number | null;
  fuelTankHealth: number | null;
  fuelTankRepaired: number | null;
  turretRingHealth: number | null;
  turretRingRepaired: number | null;
  viewportHealth: number | null;
  viewportRepaired: number | null;
  // other
  weight: number | null;
  viewRange: number | null;
  radioRange: number | null;
  camoStill: number | null;
  camoMoving: number | null;
  camoStillFiring: number | null;
  camoMovingFiring: number | null;
  // economics (from list.xml price + default shell price)
  buyCredits: number | null;
  buyGold: number | null;
  shellCost: number | null;
  ammoCost: number | null;
  // Per-shell velocity, splash radius and 500m penetration by shell kind (WG's
  // ammo lacks them); used by the ammo panel. Not a DB column — dropped before
  // the upsert.
  shellStats: {
    type: string;
    velocity: number;
    splash: number | null;
    pen500: number | null;
    icon: string | null;
    /** Per-shell price in credits (premium ammo included; all credit-priced). */
    cost: number | null;
    /** Armor damage and near penetration, to disambiguate two shells of the same
     * kind when matching against the WG shell (kind alone is not unique). */
    damage: number | null;
    pen: number | null;
    /** Degrees the shell straightens by on impact, before the angle is counted. */
    normalization: number;
    /** Past this impact angle the shell glances off; 90 means it never does. */
    ricochet: number;
    /** This shell's own calibre, which drives the two- and three-calibre rules. */
    caliber: number | null;
    /** How far the shell carries, in metres. */
    maxDistance: number | null;
    /** The shell's own localization ref (`#<file>:<key>`), resolved into `name`. */
    userString: string | null;
    /** Display names from WoT's localization, resolved by `configs()` for the
     * ammo panel (null in the batch catalog, or when localization has no entry):
     * `shortName` = the kind's short code (AP/HEAT/…), `kindName` = the kind's
     * full name (High-Explosive/…), `name` = this specific shell's own name
     * (e.g. `122 mm UOF-471`). */
    shortName: string | null;
    kindName: string | null;
    name: string | null;
    /**
     * What this shell becomes once the gun is calibrated, where it can be.
     *
     * Only the two or three shells a `shellParamsSwitcher` gun lists have this,
     * and only the fields the deployed definition actually restates: the rest
     * of the shell is unchanged and is read from the entry it sits on.
     */
    calibrated?: CalibratedShell;
  }[];
};
