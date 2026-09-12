/**
 * Our characteristics table, against the game client's own name for the same
 * statistic.
 *
 * Written by hand, and it has to be: the two vocabularies are not derivable
 * from one another and are inverted in places. The client calls `reloadTime`
 * "Rate of Fire" and `reloadTimeSecs` "Gun Loading", which is the opposite of
 * how our two rows are keyed, so a mechanical match would print the wrong label
 * on both. Everything here was read off the client's 265 `tank_params/` keys and
 * matched to the quantity our row actually shows.
 *
 * **A row is mapped only when the client names the same quantity with something
 * that fits a table column.** Three kinds are deliberately left out:
 * - a row the client has no parameter for (`… vs modules`, `Track armor`,
 *   `Fire chance`, the shell and ammunition costs);
 * - a row whose client label is ambiguous alone where ours is not
 *   (`chassisRotationSpeed` is just "Traverse Speed", against our "Hull
 *   traverse", and the table shows both hull and turret);
 * - our indented `… front` / `… moving` sub-rows, which are continuations of the
 *   heading above them and have no equivalent shape in a client that writes
 *   "Moving Vehicle (%)" in full.
 *
 * What is left out is not left in English: it goes through the ordinary
 * translator with the game-vocabulary prompt, like any other `game/` string. The
 * mapping only decides which rows get Wargaming's own wording rather than a
 * translation of ours.
 */
export const TANK_PARAM_BY_ROW: Record<string, string> = {
  // Firepower
  damage: "avgDamage",
  penetration: "avgPiercingPower",
  reload: "reloadTimeSecs",
  rof: "reloadTime",
  aimTime: "aimingTime",
  accuracy: "shotDispersionAngle",
  shellVelocity: "shotSpeed",
  ammoCapacity: "maxAmmo",
  gunArc: "gunYawLimits",
  // Mobility
  speedForward: "forwardMaxSpeed",
  enginePower: "enginePower",
  powerWeight: "enginePowerPerTon",
  turretTraverse: "turretModuleRotationSpeed",
  // Survivability
  health: "maxHealth",
  trackRepairTime: "chassisRepairTime",
  weight: "vehicleWeight",
  // Spotting
  viewRange: "circularVisionRadius",
  radioRange: "radioDistance",
};

/**
 * The table's section headings and its two armour sub-headings, which the client
 * names too. "Spotting & other" is ours: it is a compound of the client's
 * "Spotting" and everything that fits nowhere else, so no single parameter names
 * it.
 */
export const TANK_PARAM_BY_HEADING: Record<string, string> = {
  Firepower: "relativePower",
  Mobility: "relativeMobility",
  Survivability: "relativeArmor",
  "Hull armor": "hullArmor",
  "Turret armor": "turretArmor",
};

/**
 * A section heading's key in `game/tank-params`.
 *
 * A heading is a label with no row key of its own, so it is keyed by its English
 * text slugged. Shared by the generator that writes the file and the table that
 * reads it, or the two would slug "Hull armor" differently the day one changes.
 */
export const tankHeadingKey = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
