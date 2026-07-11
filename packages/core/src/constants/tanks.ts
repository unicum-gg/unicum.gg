import { VehicleType } from "@unicum.gg/wargaming/api/wot/encyclopedia";

// Single source of truth for the five WoT vehicle classes. Values come from the
// SDK's canonical `VehicleType` enum; the order and labels are the app's display
// choice (the enum's own order puts TDs second). Import from here instead of
// re-declaring these lists per component.
export const VEHICLE_CLASSES: string[] = [
  VehicleType.HeavyTank,
  VehicleType.MediumTank,
  VehicleType.LightTank,
  VehicleType.TankDestroyer,
  VehicleType.SPG,
];

// Short label, for filter chips and compact columns.
export const VEHICLE_CLASS_LABEL: Record<string, string> = {
  [VehicleType.HeavyTank]: "Heavy",
  [VehicleType.MediumTank]: "Medium",
  [VehicleType.LightTank]: "Light",
  [VehicleType.TankDestroyer]: "TD",
  [VehicleType.SPG]: "SPG",
};

// Full label, for the tank page header / metadata.
export const VEHICLE_CLASS_LABEL_FULL: Record<string, string> = {
  [VehicleType.HeavyTank]: "Heavy tank",
  [VehicleType.MediumTank]: "Medium tank",
  [VehicleType.LightTank]: "Light tank",
  [VehicleType.TankDestroyer]: "Tank destroyer",
  [VehicleType.SPG]: "Artillery",
};

// WoT vehicle roles (the badge shown in the tech tree). We store the raw game
// token per tank (e.g. `role_HT_assault`); the class-agnostic suffix is the
// filter axis. Ordered for the filter row. Labels are WoT's own English names
// (`universal` displays as "Versatile", `break` as "Breakthrough"). SPGs carry
// no role suffix, so they match no role chip.
export const VEHICLE_ROLES: string[] = [
  "assault",
  "break",
  "support",
  "universal",
  "sniper",
  "wheeled",
];

export const VEHICLE_ROLE_LABEL: Record<string, string> = {
  assault: "Assault",
  break: "Breakthrough",
  support: "Support",
  universal: "Versatile",
  sniper: "Sniper",
  wheeled: "Wheeled",
};

// Class-agnostic role word from a raw role token: `role_HT_assault` → `assault`.
// Returns null for role_SPG / unknown tokens (nothing to filter on).
export function roleSuffix(token: string | null | undefined): string | null {
  if (!token) return null;
  const suffix = token.slice(token.lastIndexOf("_") + 1);
  return suffix in VEHICLE_ROLE_LABEL ? suffix : null;
}
