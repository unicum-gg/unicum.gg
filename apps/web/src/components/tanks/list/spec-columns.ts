// Column catalogue for the /tanks Specifications table. Drives both the table
// (headers + cells + sorting) and the grouped column selector. Mirrors the
// groups tomato.gg uses. Each column reads from a `TankSpecRow` (the flattened
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

export enum SpecGroup {
  Firepower = "Firepower",
  GunHandling = "Gun Handling",
  Mobility = "Mobility",
  Survivability = "Survivability",
  Other = "Other",
}

export const SPEC_GROUP_ORDER: SpecGroup[] = [
  SpecGroup.Firepower,
  SpecGroup.GunHandling,
  SpecGroup.Mobility,
  SpecGroup.Survivability,
  SpecGroup.Other,
];

export type SpecColumn = {
  key: string;
  label: string;
  group: SpecGroup;
  // Cell text; "—" for null.
  render: (s: TankSpecRow) => string;
  // Numeric value used for sorting (null sinks to the bottom).
  sortValue: (s: TankSpecRow) => number | null;
  tip?: string;
  defaultVisible?: boolean;
};

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const d1 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const d2 = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const DASH = "—";
const fInt = (v: number | null) => (v != null ? int.format(v) : DASH);
const fD2 = (v: number | null) => (v != null ? d2.format(v) : DASH);
const fSec = (v: number | null) => (v != null ? `${d1.format(v)}s` : DASH);
const fPct = (v: number | null) => (v != null ? `${d1.format(v * 100)}%` : DASH);
const fDeg = (v: number | null) => (v != null ? `${int.format(v)}°` : DASH);

export const SPEC_COLUMNS: SpecColumn[] = [
  // Firepower
  { key: "dpm", label: "DPM", group: SpecGroup.Firepower, render: (s) => fInt(s.dpm), sortValue: (s) => s.dpm, tip: "Damage per minute", defaultVisible: true },
  { key: "damage", label: "Damage", group: SpecGroup.Firepower, render: (s) => fInt(s.damage), sortValue: (s) => s.damage, tip: "Alpha damage", defaultVisible: true },
  { key: "moduleDamage", label: "Module Damage", group: SpecGroup.Firepower, render: (s) => fInt(s.moduleDamage), sortValue: (s) => s.moduleDamage },
  { key: "splashRadius", label: "Splash Radius", group: SpecGroup.Firepower, render: (s) => (s.splashRadius != null ? `${d1.format(s.splashRadius)}m` : DASH), sortValue: (s) => s.splashRadius },
  { key: "reload", label: "Reload", group: SpecGroup.Firepower, render: (s) => fSec(s.reload), sortValue: (s) => s.reload, tip: "Reload (full magazine for autoloaders)", defaultVisible: true },
  { key: "rof", label: "Rate of Fire", group: SpecGroup.Firepower, render: (s) => fD2(s.rof), sortValue: (s) => s.rof, tip: "Rounds per minute" },
  { key: "intraClipReload", label: "Intra-Clip Reload", group: SpecGroup.Firepower, render: (s) => fSec(s.intraClipReload), sortValue: (s) => s.intraClipReload, tip: "Time between shots in a magazine (autoloaders)" },
  { key: "penetration", label: "Penetration", group: SpecGroup.Firepower, render: (s) => fInt(s.penetration), sortValue: (s) => s.penetration, tip: "Penetration (mm), default shell", defaultVisible: true },
  { key: "caliber", label: "Caliber", group: SpecGroup.Firepower, render: (s) => fInt(s.caliber), sortValue: (s) => s.caliber, tip: "Shell caliber (mm)" },
  { key: "shellVelocity", label: "Shell Velocity", group: SpecGroup.Firepower, render: (s) => fInt(s.shellVelocity), sortValue: (s) => s.shellVelocity, tip: "Shell velocity (m/s)", defaultVisible: true },

  // Gun handling
  { key: "accuracy", label: "Accuracy", group: SpecGroup.GunHandling, render: (s) => fD2(s.accuracy), sortValue: (s) => s.accuracy, tip: "Dispersion at 100 m (lower is better)", defaultVisible: true },
  { key: "aimTime", label: "Aim Time", group: SpecGroup.GunHandling, render: (s) => fSec(s.aimTime), sortValue: (s) => s.aimTime, defaultVisible: true },
  { key: "dispMoving", label: "Dispersion Moving", group: SpecGroup.GunHandling, render: (s) => fD2(s.dispMoving), sortValue: (s) => s.dispMoving, tip: "Dispersion factor while moving" },
  { key: "dispTankTraverse", label: "Dispersion Tank Traverse", group: SpecGroup.GunHandling, render: (s) => fD2(s.dispTankTraverse), sortValue: (s) => s.dispTankTraverse },
  { key: "dispTurretTraverse", label: "Dispersion Turret Traverse", group: SpecGroup.GunHandling, render: (s) => fD2(s.dispTurretTraverse), sortValue: (s) => s.dispTurretTraverse },
  { key: "dispAfterShot", label: "Dispersion After Firing", group: SpecGroup.GunHandling, render: (s) => fD2(s.dispAfterShot), sortValue: (s) => s.dispAfterShot },
  { key: "dispWhileDamaged", label: "Dispersion While Damaged", group: SpecGroup.GunHandling, render: (s) => fD2(s.dispWhileDamaged), sortValue: (s) => s.dispWhileDamaged },
  { key: "gunArc", label: "Gun Arc", group: SpecGroup.GunHandling, render: (s) => fDeg(s.gunArc), sortValue: (s) => s.gunArc, tip: "Horizontal gun traverse arc" },
  {
    key: "depression",
    label: "Gun Depression / Elevation",
    group: SpecGroup.GunHandling,
    render: (s) =>
      s.depression != null || s.elevation != null
        ? `${s.depression != null ? `-${int.format(s.depression)}` : "—"}° / ${s.elevation != null ? `+${int.format(s.elevation)}` : "—"}°`
        : DASH,
    sortValue: (s) => s.depression,
    tip: "Gun depression / elevation",
    defaultVisible: true,
  },

  // Mobility
  {
    key: "speed",
    label: "Speed (Fwd / Bwd)",
    group: SpecGroup.Mobility,
    render: (s) => (s.speedForward != null ? `${int.format(s.speedForward)} / ${s.speedBackward != null ? int.format(s.speedBackward) : "—"}` : DASH),
    sortValue: (s) => s.speedForward,
    tip: "Top speed forward / backward (km/h)",
    defaultVisible: true,
  },
  { key: "hullTraverse", label: "Hull Traverse", group: SpecGroup.Mobility, render: (s) => (s.hullTraverse != null ? `${int.format(s.hullTraverse)}°/s` : DASH), sortValue: (s) => s.hullTraverse, defaultVisible: true },
  { key: "turretTraverse", label: "Turret Traverse", group: SpecGroup.Mobility, render: (s) => (s.turretTraverse != null ? `${int.format(s.turretTraverse)}°/s` : DASH), sortValue: (s) => s.turretTraverse },
  { key: "enginePower", label: "Power", group: SpecGroup.Mobility, render: (s) => fInt(s.enginePower), sortValue: (s) => s.enginePower, tip: "Engine power (hp)", defaultVisible: true },
  { key: "powerWeight", label: "Power/Weight", group: SpecGroup.Mobility, render: (s) => fD2(s.powerWeight), sortValue: (s) => s.powerWeight, tip: "hp per ton", defaultVisible: true },
  { key: "terrainHard", label: "Hard Terrain", group: SpecGroup.Mobility, render: (s) => fD2(s.terrainHard), sortValue: (s) => (s.terrainHard != null ? -s.terrainHard : null), tip: "Terrain resistance on hard ground (lower is better)" },
  { key: "terrainMedium", label: "Medium Terrain", group: SpecGroup.Mobility, render: (s) => fD2(s.terrainMedium), sortValue: (s) => (s.terrainMedium != null ? -s.terrainMedium : null) },
  { key: "terrainSoft", label: "Soft Terrain", group: SpecGroup.Mobility, render: (s) => fD2(s.terrainSoft), sortValue: (s) => (s.terrainSoft != null ? -s.terrainSoft : null) },

  // Survivability
  { key: "health", label: "Health", group: SpecGroup.Survivability, render: (s) => fInt(s.health), sortValue: (s) => s.health, tip: "Hit points", defaultVisible: true },
  { key: "engineHealth", label: "Engine Health", group: SpecGroup.Survivability, render: (s) => fInt(s.engineHealth), sortValue: (s) => s.engineHealth },
  { key: "engineFireChance", label: "Engine Fire Chance", group: SpecGroup.Survivability, render: (s) => fPct(s.engineFireChance), sortValue: (s) => (s.engineFireChance != null ? -s.engineFireChance : null) },
  { key: "hullArmorFront", label: "Hull Armor (front)", group: SpecGroup.Survivability, render: (s) => fInt(s.hullArmorFront), sortValue: (s) => s.hullArmorFront, tip: "Front hull armor (mm)", defaultVisible: true },
  { key: "turretArmorFront", label: "Turret Armor (front)", group: SpecGroup.Survivability, render: (s) => fInt(s.turretArmorFront), sortValue: (s) => s.turretArmorFront, tip: "Front turret armor (mm)", defaultVisible: true },
  { key: "trackArmor", label: "Track Armor", group: SpecGroup.Survivability, render: (s) => fInt(s.trackArmor), sortValue: (s) => s.trackArmor },
  { key: "trackHealth", label: "Track Health", group: SpecGroup.Survivability, render: (s) => fInt(s.trackHealth), sortValue: (s) => s.trackHealth },
  { key: "trackRepairTime", label: "Track Repair Time", group: SpecGroup.Survivability, render: (s) => fSec(s.trackRepairTime), sortValue: (s) => s.trackRepairTime },
  { key: "ammoRackHealth", label: "Ammo Rack Health", group: SpecGroup.Survivability, render: (s) => fInt(s.ammoRackHealth), sortValue: (s) => s.ammoRackHealth },

  // Other
  { key: "weight", label: "Weight", group: SpecGroup.Other, render: (s) => (s.weight != null ? `${d1.format(s.weight / 1000)}t` : DASH), sortValue: (s) => s.weight, defaultVisible: true },
  { key: "viewRange", label: "View Range", group: SpecGroup.Other, render: (s) => fInt(s.viewRange), sortValue: (s) => s.viewRange, tip: "View range (m)", defaultVisible: true },
  { key: "radioRange", label: "Radio Range", group: SpecGroup.Other, render: (s) => fInt(s.radioRange), sortValue: (s) => s.radioRange, tip: "Signal range (m)" },
  { key: "camoStill", label: "Stationary Camo", group: SpecGroup.Other, render: (s) => fPct(s.camoStill), sortValue: (s) => s.camoStill },
  { key: "camoMoving", label: "Moving Camo", group: SpecGroup.Other, render: (s) => fPct(s.camoMoving), sortValue: (s) => s.camoMoving },
  { key: "camoStillFiring", label: "Stationary Camo After Firing", group: SpecGroup.Other, render: (s) => fPct(s.camoStillFiring), sortValue: (s) => s.camoStillFiring },
  { key: "camoMovingFiring", label: "Moving Camo After Firing", group: SpecGroup.Other, render: (s) => fPct(s.camoMovingFiring), sortValue: (s) => s.camoMovingFiring },
];

export const SPEC_COLUMN_BY_KEY: Record<string, SpecColumn> = Object.fromEntries(
  SPEC_COLUMNS.map((c) => [c.key, c]),
);

export const DEFAULT_SPEC_COLUMN_KEYS: string[] = SPEC_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.key);
