import { isObject, topModuleKey, resolveModule } from "./index";
import type { XmlNode } from "./index";

/**
 * Resolve one module per slot to its full (shared-merged) definition. With no
 * `sel`, every slot takes its TOP module (the stock top-config, byte-identical
 * to the former inline resolution). `sel` overrides individual slots by key so
 * the per-config enumeration can walk every combination. The gun lives under
 * the *resolved* turret (`T.guns`), so its key is looked up after the turret.
 */
export function resolveModules(
  root: XmlNode,
  shared: {
    guns: XmlNode;
    shells: XmlNode;
    turrets: XmlNode;
    engines: XmlNode;
    chassis: XmlNode;
    radios: XmlNode;
    fuelTanks: XmlNode;
  },
  sel?: {
    chassisKey?: string;
    turretKey?: string;
    gunKey?: string;
    engineKey?: string;
    radioKey?: string;
    fuelKey?: string;
  },
): {
  m: { hull: XmlNode; C: XmlNode; T: XmlNode; G: XmlNode; E: XmlNode; R: XmlNode; F: XmlNode };
  keys: {
    chassis: string | null;
    turret: string | null;
    gun: string | null;
    engine: string | null;
    radio: string | null;
    fuel: string | null;
  };
} {
  const hull = isObject(root.hull) ? root.hull : {};

  const chassisSlot = root.chassis;
  const chassisKey = sel?.chassisKey ?? topModuleKey(chassisSlot);
  const chassisInline =
    chassisKey && isObject(chassisSlot) ? chassisSlot[chassisKey] : undefined;
  const C =
    resolveModule(chassisInline, chassisKey ? shared.chassis[chassisKey] : undefined) ?? {};

  const turretSlot = root.turrets0;
  const turretKey = sel?.turretKey ?? topModuleKey(turretSlot);
  const turretInline =
    turretKey && isObject(turretSlot) ? turretSlot[turretKey] : undefined;
  const T =
    resolveModule(turretInline, turretKey ? shared.turrets[turretKey] : undefined) ?? {};

  const gunsSlot = isObject(T) ? (T as XmlNode).guns : undefined;
  const gunKey = sel?.gunKey ?? topModuleKey(gunsSlot);
  const gunInline = gunKey && isObject(gunsSlot) ? (gunsSlot as XmlNode)[gunKey] : undefined;
  const G = resolveModule(gunInline, gunKey ? shared.guns[gunKey] : undefined) ?? {};

  const engineKey = sel?.engineKey ?? topModuleKey(root.engines);
  const engineInline =
    engineKey && isObject(root.engines) ? (root.engines as XmlNode)[engineKey] : undefined;
  const E =
    resolveModule(engineInline, engineKey ? shared.engines[engineKey] : undefined) ?? {};

  const radioKey = sel?.radioKey ?? topModuleKey(root.radios);
  const radioInline =
    radioKey && isObject(root.radios) ? (root.radios as XmlNode)[radioKey] : undefined;
  const R =
    resolveModule(radioInline, radioKey ? shared.radios[radioKey] : undefined) ?? {};

  const fuelKey = sel?.fuelKey ?? topModuleKey(root.fuelTanks);
  const fuelInline =
    fuelKey && isObject(root.fuelTanks) ? (root.fuelTanks as XmlNode)[fuelKey] : undefined;
  const F =
    resolveModule(fuelInline, fuelKey ? shared.fuelTanks[fuelKey] : undefined) ?? {};

  return {
    m: { hull, C, T, G, E, R, F },
    keys: {
      chassis: chassisKey,
      turret: turretKey,
      gun: gunKey,
      engine: engineKey,
      radio: radioKey,
      fuel: fuelKey,
    },
  };
}
