import { computeSpec } from "./compute";
import { resolveModules } from "./resolve-modules";
import { isObject, moduleKeys, resolveModule } from "./index";
import type { XmlNode, WotSrcSpec, WotSrcConfig } from "./index";

export function derive(
  tankId: number,
  tag: string,
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
  listEntry: XmlNode,
): WotSrcSpec {
  const { m } = resolveModules(root, shared);
  return computeSpec(tankId, tag, root, listEntry, shared, m);
}

/** Walk every module combination and derive its stat block. */
export function deriveConfigs(
  tankId: number,
  tag: string,
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
  listEntry: XmlNode,
): WotSrcConfig[] {
  const chassisKeys = moduleKeys(root.chassis);
  const turretKeys = moduleKeys(root.turrets0);
  const engineKeys = moduleKeys(root.engines);
  const radioKeys = moduleKeys(root.radios);
  const out: WotSrcConfig[] = [];

  for (const turretKey of turretKeys) {
    // Guns are nested under the resolved turret, so the gun key set depends on
    // which turret is mounted.
    const turretInline = isObject(root.turrets0)
      ? (root.turrets0 as XmlNode)[turretKey]
      : undefined;
    const T0 = resolveModule(turretInline, shared.turrets[turretKey]) ?? {};
    const gunKeys = moduleKeys(isObject(T0) ? (T0 as XmlNode).guns : undefined);

    for (const gunKey of gunKeys)
      for (const chassisKey of chassisKeys)
        for (const engineKey of engineKeys)
          for (const radioKey of radioKeys) {
            const { m } = resolveModules(root, shared, {
              chassisKey,
              turretKey,
              gunKey,
              engineKey,
              radioKey,
            });
            const spec = computeSpec(tankId, tag, root, listEntry, shared, m);
            out.push({
              keys: {
                chassis: chassisKey,
                turret: turretKey,
                gun: gunKey,
                engine: engineKey,
                radio: radioKey,
              },
              spec,
            });
          }
  }
  return out;
}
