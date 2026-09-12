import { numberFormat } from "@/lib/format";
// Column catalogue for the /tanks Specifications table. Drives both the table
// (headers + cells + sorting) and the grouped column selector. Mirrors the
// groups a player reads them in. Each column reads from a `TankSpecRow` (the flattened
// tank_specs row); some columns combine two fields (Speed, Depression/Elevation).

export type TankSpecRow = {
  damage: number | null;
  moduleDamage: number | null;
  splashRadius: number | null;
  reload: number | null;
  rof: number | null;
  intraClipReload: number | null;
  dpm: number | null;
  penetration: number | null;
  caliber: number | null;
  shellVelocity: number | null;
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
  speedForward: number | null;
  speedBackward: number | null;
  hullTraverse: number | null;
  turretTraverse: number | null;
  enginePower: number | null;
  powerWeight: number | null;
  terrainHard: number | null;
  terrainMedium: number | null;
  terrainSoft: number | null;
  health: number | null;
  engineHealth: number | null;
  engineFireChance: number | null;
  hullArmorFront: number | null;
  turretArmorFront: number | null;
  trackArmor: number | null;
  trackHealth: number | null;
  trackRepairTime: number | null;
  ammoRackHealth: number | null;
  weight: number | null;
  viewRange: number | null;
  radioRange: number | null;
  camoStill: number | null;
  camoMoving: number | null;
  camoStillFiring: number | null;
  camoMovingFiring: number | null;
  // economics
  buyCredits: number | null;
  buyGold: number | null;
  researchXp: number | null;
  totalFreeXp: number | null;
  // Cumulative XP per ancestor tier (`freeXpFromTier` prices "from tier N").
  freeXpByTier?: Record<string, number> | null;
  shellCost: number | null;
  ammoCost: number | null;
};

/** Ids, not headings: the wording lives in `components/tanks/list/spec-columns`
 * under `groups`, so the selector reads the same group in 27 languages. */
export enum SpecGroup {
  Firepower = "firepower",
  GunHandling = "gun-handling",
  Mobility = "mobility",
  Survivability = "survivability",
  Other = "other",
}

export const SPEC_GROUP_ORDER: SpecGroup[] = [
  SpecGroup.Firepower,
  SpecGroup.GunHandling,
  SpecGroup.Mobility,
  SpecGroup.Survivability,
  SpecGroup.Other,
];

export type SpecColumn = {
  /** Also the key of its wording in `components/tanks/list/spec-columns`. */
  key: string;
  group: SpecGroup;
  // Cell text; "—" for null.
  /** Takes the reader's locale: a column definition is data at module scope,
   * so the number formatting has to arrive from whoever renders it. */
  render: (s: TankSpecRow, locale: string) => string;
  // Numeric value used for sorting (null sinks to the bottom).
  sortValue: (s: TankSpecRow) => number | null;
  /** Whether this column explains itself on hover. The sentence is in the
   * locale file under `columns.<key>.tip`; this only says there is one, so a
   * caller does not render a tooltip holding a raw key. */
  tipped?: boolean;
  defaultVisible?: boolean;
};

const INT_FORMAT = { maximumFractionDigits: 0 } as const;
const D1_FORMAT = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
} as const;
const D2_FORMAT = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;
const DASH = "—";
const fInt = (v: number | null, locale: string) => (v != null ? numberFormat(locale, INT_FORMAT).format(v) : DASH);
const fD2 = (v: number | null, locale: string) => (v != null ? numberFormat(locale, D2_FORMAT).format(v) : DASH);
const fSec = (v: number | null, locale: string) => (v != null ? `${numberFormat(locale, D1_FORMAT).format(v)}s` : DASH);
const fPct = (v: number | null, locale: string) => (v != null ? `${numberFormat(locale, D1_FORMAT).format(v * 100)}%` : DASH);
const fDeg = (v: number | null, locale: string) => (v != null ? `${numberFormat(locale, INT_FORMAT).format(v)}°` : DASH);

export const SPEC_COLUMNS: SpecColumn[] = [
  // Firepower
  { key: "dpm", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.dpm, locale), sortValue: (s) => s.dpm, tipped: true, defaultVisible: true },
  { key: "damage", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.damage, locale), sortValue: (s) => s.damage, tipped: true, defaultVisible: true },
  { key: "moduleDamage", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.moduleDamage, locale), sortValue: (s) => s.moduleDamage },
  { key: "splashRadius", group: SpecGroup.Firepower, render: (s, locale) => (s.splashRadius != null ? `${numberFormat(locale, D1_FORMAT).format(s.splashRadius)}m` : DASH), sortValue: (s) => s.splashRadius },
  { key: "reload", group: SpecGroup.Firepower, render: (s, locale) => fSec(s.reload, locale), sortValue: (s) => s.reload, tipped: true, defaultVisible: true },
  { key: "rof", group: SpecGroup.Firepower, render: (s, locale) => fD2(s.rof, locale), sortValue: (s) => s.rof, tipped: true },
  { key: "intraClipReload", group: SpecGroup.Firepower, render: (s, locale) => fSec(s.intraClipReload, locale), sortValue: (s) => s.intraClipReload, tipped: true },
  { key: "penetration", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.penetration, locale), sortValue: (s) => s.penetration, tipped: true, defaultVisible: true },
  { key: "caliber", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.caliber, locale), sortValue: (s) => s.caliber, tipped: true },
  { key: "shellVelocity", group: SpecGroup.Firepower, render: (s, locale) => fInt(s.shellVelocity, locale), sortValue: (s) => s.shellVelocity, tipped: true, defaultVisible: true },

  // Gun handling
  { key: "accuracy", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.accuracy, locale), sortValue: (s) => s.accuracy, tipped: true, defaultVisible: true },
  { key: "aimTime", group: SpecGroup.GunHandling, render: (s, locale) => fSec(s.aimTime, locale), sortValue: (s) => s.aimTime, defaultVisible: true },
  { key: "dispMoving", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.dispMoving, locale), sortValue: (s) => s.dispMoving, tipped: true },
  { key: "dispTankTraverse", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.dispTankTraverse, locale), sortValue: (s) => s.dispTankTraverse },
  { key: "dispTurretTraverse", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.dispTurretTraverse, locale), sortValue: (s) => s.dispTurretTraverse },
  { key: "dispAfterShot", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.dispAfterShot, locale), sortValue: (s) => s.dispAfterShot },
  { key: "dispWhileDamaged", group: SpecGroup.GunHandling, render: (s, locale) => fD2(s.dispWhileDamaged, locale), sortValue: (s) => s.dispWhileDamaged },
  { key: "gunArc", group: SpecGroup.GunHandling, render: (s, locale) => fDeg(s.gunArc, locale), sortValue: (s) => s.gunArc, tipped: true },
  {
    key: "depression",
    group: SpecGroup.GunHandling,
    render: (s, locale) =>
      s.depression != null || s.elevation != null
        ? `${s.depression != null ? `-${numberFormat(locale, INT_FORMAT).format(s.depression)}` : "—"}° / ${s.elevation != null ? `+${numberFormat(locale, INT_FORMAT).format(s.elevation)}` : "—"}°`
        : DASH,
    sortValue: (s) => s.depression,
    tipped: true,
    defaultVisible: true,
  },

  // Mobility
  {
    key: "speed",
    group: SpecGroup.Mobility,
    render: (s, locale) => (s.speedForward != null ? `${numberFormat(locale, INT_FORMAT).format(s.speedForward)} / ${s.speedBackward != null ? numberFormat(locale, INT_FORMAT).format(s.speedBackward) : "—"}` : DASH),
    sortValue: (s) => s.speedForward,
    tipped: true,
    defaultVisible: true,
  },
  { key: "hullTraverse", group: SpecGroup.Mobility, render: (s, locale) => (s.hullTraverse != null ? `${numberFormat(locale, INT_FORMAT).format(s.hullTraverse)}°/s` : DASH), sortValue: (s) => s.hullTraverse, defaultVisible: true },
  { key: "turretTraverse", group: SpecGroup.Mobility, render: (s, locale) => (s.turretTraverse != null ? `${numberFormat(locale, INT_FORMAT).format(s.turretTraverse)}°/s` : DASH), sortValue: (s) => s.turretTraverse },
  { key: "enginePower", group: SpecGroup.Mobility, render: (s, locale) => fInt(s.enginePower, locale), sortValue: (s) => s.enginePower, tipped: true, defaultVisible: true },
  { key: "powerWeight", group: SpecGroup.Mobility, render: (s, locale) => fD2(s.powerWeight, locale), sortValue: (s) => s.powerWeight, tipped: true, defaultVisible: true },
  { key: "terrainHard", group: SpecGroup.Mobility, render: (s, locale) => fD2(s.terrainHard, locale), sortValue: (s) => (s.terrainHard != null ? -s.terrainHard : null), tipped: true },
  { key: "terrainMedium", group: SpecGroup.Mobility, render: (s, locale) => fD2(s.terrainMedium, locale), sortValue: (s) => (s.terrainMedium != null ? -s.terrainMedium : null) },
  { key: "terrainSoft", group: SpecGroup.Mobility, render: (s, locale) => fD2(s.terrainSoft, locale), sortValue: (s) => (s.terrainSoft != null ? -s.terrainSoft : null) },

  // Survivability
  { key: "health", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.health, locale), sortValue: (s) => s.health, tipped: true, defaultVisible: true },
  { key: "engineHealth", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.engineHealth, locale), sortValue: (s) => s.engineHealth },
  { key: "engineFireChance", group: SpecGroup.Survivability, render: (s, locale) => fPct(s.engineFireChance, locale), sortValue: (s) => (s.engineFireChance != null ? -s.engineFireChance : null) },
  { key: "hullArmorFront", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.hullArmorFront, locale), sortValue: (s) => s.hullArmorFront, tipped: true, defaultVisible: true },
  { key: "turretArmorFront", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.turretArmorFront, locale), sortValue: (s) => s.turretArmorFront, tipped: true, defaultVisible: true },
  { key: "trackArmor", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.trackArmor, locale), sortValue: (s) => s.trackArmor },
  { key: "trackHealth", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.trackHealth, locale), sortValue: (s) => s.trackHealth },
  { key: "trackRepairTime", group: SpecGroup.Survivability, render: (s, locale) => fSec(s.trackRepairTime, locale), sortValue: (s) => s.trackRepairTime },
  { key: "ammoRackHealth", group: SpecGroup.Survivability, render: (s, locale) => fInt(s.ammoRackHealth, locale), sortValue: (s) => s.ammoRackHealth },

  // Other
  { key: "weight", group: SpecGroup.Other, render: (s, locale) => (s.weight != null ? `${numberFormat(locale, D1_FORMAT).format(s.weight / 1000)}t` : DASH), sortValue: (s) => s.weight, defaultVisible: true },
  { key: "viewRange", group: SpecGroup.Other, render: (s, locale) => fInt(s.viewRange, locale), sortValue: (s) => s.viewRange, tipped: true, defaultVisible: true },
  { key: "radioRange", group: SpecGroup.Other, render: (s, locale) => fInt(s.radioRange, locale), sortValue: (s) => s.radioRange, tipped: true },
  { key: "camoStill", group: SpecGroup.Other, render: (s, locale) => fPct(s.camoStill, locale), sortValue: (s) => s.camoStill },
  { key: "camoMoving", group: SpecGroup.Other, render: (s, locale) => fPct(s.camoMoving, locale), sortValue: (s) => s.camoMoving },
  { key: "camoStillFiring", group: SpecGroup.Other, render: (s, locale) => fPct(s.camoStillFiring, locale), sortValue: (s) => s.camoStillFiring },
  { key: "camoMovingFiring", group: SpecGroup.Other, render: (s, locale) => fPct(s.camoMovingFiring, locale), sortValue: (s) => s.camoMovingFiring },
];

export const SPEC_COLUMN_BY_KEY: Record<string, SpecColumn> = Object.fromEntries(
  SPEC_COLUMNS.map((c) => [c.key, c]),
);

export const DEFAULT_SPEC_COLUMN_KEYS: string[] = SPEC_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.key);
