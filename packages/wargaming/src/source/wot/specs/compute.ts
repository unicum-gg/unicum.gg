import { num, numList, tokens, isObject } from "./index";
import type { XmlNode, WotSrcSpec } from "./index";

/** The full derived stat block from an already-resolved set of modules (one
 * per slot). Shared by the top-config `#derive` and the per-config
 * enumeration below, so both produce identical numbers. */
export function computeSpec(
  tankId: number,
  tag: string,
  root: XmlNode,
  listEntry: XmlNode,
  shared: {
    guns: XmlNode;
    shells: XmlNode;
    turrets: XmlNode;
    engines: XmlNode;
    chassis: XmlNode;
    radios: XmlNode;
    fuelTanks: XmlNode;
  },
  m: {
    hull: XmlNode;
    C: XmlNode;
    T: XmlNode;
    G: XmlNode;
    E: XmlNode;
    R: XmlNode;
    F: XmlNode;
  },
): WotSrcSpec {
  const { hull, C, T, G, E, R, F } = m;
  // --- default shell + shot on the gun ---
  const shots = isObject(G.shots) ? (G.shots as XmlNode) : {};
  const shotEntries = Object.entries(shots).filter(([, v]) => isObject(v)) as [string, XmlNode][];
  let defaultShot: [string, XmlNode] | undefined = shotEntries[0];
  let bestPortion = -1;
  for (const [name, shot] of shotEntries) {
    const p = num((shot as XmlNode).defaultPortion) ?? 0;
    if (p > bestPortion) {
      bestPortion = p;
      defaultShot = [name, shot];
    }
  }
  const shot = defaultShot?.[1] ?? {};
  const shellName = defaultShot?.[0];
  const shell =
    shellName && isObject(shared.shells[shellName]) ? (shared.shells[shellName] as XmlNode) : {};

  // Per-shell muzzle velocity, splash radius and 500m penetration, keyed by
  // shell kind (`ARMOR_PIERCING`, ... — the same value WG uses as the ammo
  // `type`), since WG's ammo carries damage and (100m) penetration but not
  // velocity, splash or the falloff. The shot's name is its shell's name;
  // splash is null for non-HE shells, pen500 = piercingPower's 500m value.
  // The `<icons>` header maps each shell's short `<icon>` name to its PNG file.
  const iconMap = isObject(shared.shells.icons)
    ? (shared.shells.icons as XmlNode)
    : {};
  const shellStats = shotEntries
    .map(([name, sh]) => {
      const def = isObject(shared.shells[name]) ? (shared.shells[name] as XmlNode) : {};
      const type = String(def.kind ?? "");
      const velocity = num(sh.speed);
      const pp = numList(sh.piercingPower);
      const pen500: number | null =
        pp.length > 1 ? pp[1] : pp.length > 0 ? pp[0] : null;
      // Each shell carries its own `<icon>` (e.g. `hc_premium`), not just the
      // kind, so premium/variant shells show their real in-game icon (a premium
      // HEAT is gold, not the standard silver `HOLLOW_CHARGE.png`).
      const iconFile = tokens(iconMap[String(def.icon ?? "")])[0];
      const icon = iconFile ? iconFile.replace(/\.png$/i, "") : null;
      return type && velocity != null
        ? {
            type,
            velocity,
            splash: num(def.explosionRadius),
            pen500,
            icon,
            cost: num(def.price),
            // Damage (armor) and near penetration disambiguate two shells of the
            // same kind (e.g. standard + premium HE), which the ammo panel
            // matches against the WG shell so each gets its own icon/name.
            damage: isObject(def.damage)
              ? num((def.damage as XmlNode).armor)
              : null,
            pen: pp.length > 0 ? pp[0] : null,
            // The shell's own localization ref (its specific name, e.g.
            // `#ussr_vehicles:_122mm_UOF-471`); resolved to display names later
            // (in `configs()`), so the batch catalog leaves the names null.
            userString: String(def.userString ?? "") || null,
            shortName: null as string | null,
            kindName: null as string | null,
            name: null as string | null,
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // --- economics ---
  // list.xml price is a plain string (credits) for tech-tree tanks, or an
  // object `{ gold, #text }` for premiums (gold price). Shell cost is the
  // default shell's price; full ammo cost = shell cost * gun capacity.
  const priceNode = listEntry.price;
  let buyCredits: number | null = null;
  let buyGold: number | null = null;
  if (typeof priceNode === "string") {
    buyCredits = num(priceNode);
  } else if (isObject(priceNode)) {
    // A `<gold/>` flag element means the amount in `#text` is gold (premium);
    // otherwise it is a credit price.
    if ("gold" in priceNode) buyGold = num(priceNode["#text"]);
    else buyCredits = num(priceNode["#text"]);
  }
  const shellCost = num(shell.price);
  const maxAmmo = num(G.maxAmmo);
  const ammoCost =
    shellCost != null && maxAmmo != null ? shellCost * maxAmmo : null;

  // --- firepower ---
  const dmgNode = isObject(shell.damage) ? (shell.damage as XmlNode) : {};
  const damage = num(dmgNode.armor);
  const moduleDamage = num(dmgNode.devices);
  const splashRadius = num(shell.explosionRadius);
  const caliber = num(shell.caliber) ?? num(shot.caliber);
  // `piercingPower` is "<at 100m> <at 500m>"; AP/APCR fall off, HE/HEAT are flat.
  const piercing = numList(shot.piercingPower);
  const penetration = piercing[0] ?? null;
  const penetration500 = piercing.length > 1 ? piercing[1] : penetration;
  const shellVelocity = num(shot.speed);
  const maxRange = num(shot.maxDistance);
  const ammoCapacity = maxAmmo;

  const reload = num(G.reloadTime);
  const clip = isObject(G.clip) ? (G.clip as XmlNode) : null;
  // Shots held in a magazine (autoloader/autoreloader); null for single-shot.
  const clipSize = clip ? num(clip.count) : null;
  let rof: number | null = null;
  let dpm: number | null = null;
  let intraClipReload: number | null = null;
  if (clip && reload != null && damage != null) {
    const count = num(clip.count) ?? 0;
    const rate = num(clip.rate) ?? 0; // intra-clip shots per minute
    if (count > 0 && rate > 0) {
      intraClipReload = 60 / rate;
      const cycleTime = ((count - 1) / rate) * 60 + reload;
      rof = (count / cycleTime) * 60;
      dpm = (count * damage * 60) / cycleTime;
    }
  } else if (reload != null && reload > 0 && damage != null) {
    rof = 60 / reload;
    dpm = rof * damage;
  }

  // --- gun handling ---
  const accuracy = num(G.shotDispersionRadius);
  const aimTime = num(G.aimingTime);
  const gunDisp = isObject(G.shotDispersionFactors) ? (G.shotDispersionFactors as XmlNode) : {};
  const dispTurretTraverse = num(gunDisp.turretRotation);
  const dispAfterShot = num(gunDisp.afterShot);
  const dispWhileDamaged = num(gunDisp.whileGunDamaged);
  const chassisDisp = isObject(C.shotDispersionFactors)
    ? (C.shotDispersionFactors as XmlNode)
    : {};
  const dispMoving = num(chassisDisp.vehicleMovement);
  const dispTankTraverse = num(chassisDisp.vehicleRotation);

  // gun arc: limited yaw → span in degrees; otherwise full 360.
  let gunArc: number | null = 360;
  const yaw = numList(G.turretYawLimits);
  if (yaw.length >= 2) {
    const span = Math.abs(yaw[1] - yaw[0]);
    // -180 180 (or wider) is effectively full traverse.
    gunArc = span >= 359 ? 360 : span;
  }

  // pitch limits: "yaw angle yaw angle …" pairs; angles are the odd positions.
  const pitch = isObject(G.pitchLimits) ? (G.pitchLimits as XmlNode) : {};
  const minAngles = numList(pitch.minPitch).filter((_, i) => i % 2 === 1);
  const maxAngles = numList(pitch.maxPitch).filter((_, i) => i % 2 === 1);
  const depression = minAngles.length ? -Math.min(...minAngles) : null;
  const elevation = maxAngles.length ? Math.max(...maxAngles) : null;

  // --- mobility ---
  const speeds = isObject(root.speedLimits) ? (root.speedLimits as XmlNode) : {};
  const speedForward = num(speeds.forward);
  const speedBackward = num(speeds.backward);
  const hullTraverse = num(C.rotationSpeed);
  const turretTraverse = num(T.rotationSpeed);
  const enginePower = num(E.power);
  const terrain = numList(C.terrainResistance);
  const terrainHard = terrain[0] ?? null;
  const terrainMedium = terrain[1] ?? null;
  const terrainSoft = terrain[2] ?? null;

  // weight = sum of module weights (kg).
  const weightParts = [
    num(hull.weight),
    num(C.weight),
    num(T.weight),
    num(G.weight),
    num(E.weight),
    num(R.weight),
    num(F.weight),
  ].filter((n): n is number => n != null);
  const weight = weightParts.length ? weightParts.reduce((a, b) => a + b, 0) : null;
  const powerWeight = enginePower != null && weight ? enginePower / (weight / 1000) : null;

  // --- survivability ---
  // Total HP is hull + turret (`items/vehicles.py`: `maxHealth = hullMaxHealth
  // + turretMaxHealth`), not the hull alone; a casemate's fixed superstructure
  // still counts as its "turret".
  const hullHp = num(hull.maxHealth);
  const turretHp = num(T.maxHealth);
  const health = hullHp != null ? hullHp + (turretHp ?? 0) : null;
  const engineHealth = num(E.maxHealth);
  const engineFireChance = num(E.fireStartingChance);

  // `primaryArmor` lists the three main plates in order: front, side, rear.
  const hullArmor = isObject(hull.armor) ? (hull.armor as XmlNode) : {};
  const hullPrimary = tokens(hull.primaryArmor);
  const hullPlate = (i: number) =>
    hullPrimary.length > i ? num(hullArmor[hullPrimary[i]]) : null;
  const hullArmorFront = hullPlate(0);
  const hullArmorSide = hullPlate(1);
  const hullArmorRear = hullPlate(2);

  const turretArmor = isObject(T.armor) ? (T.armor as XmlNode) : {};
  const turretPrimary = tokens(T.primaryArmor);
  const turretPlate = (i: number) =>
    turretPrimary.length > i ? num(turretArmor[turretPrimary[i]]) : null;
  const turretArmorFrontRaw = turretPlate(0);
  // A casemate (no rotating turret) reports 0 front armor; null the whole
  // "turret" so it renders as no data rather than 0/0/0.
  const turretArmorFront =
    turretArmorFrontRaw && turretArmorFrontRaw > 0 ? turretArmorFrontRaw : null;
  const turretArmorSide = turretArmorFront != null ? turretPlate(1) : null;
  const turretArmorRear = turretArmorFront != null ? turretPlate(2) : null;

  const chassisArmor = isObject(C.armor) ? (C.armor as XmlNode) : {};
  const trackArmor = num(chassisArmor.leftTrack);
  // Each module also carries a `maxRegenHealth`: the HP it auto-repairs back to
  // without a repair kit (the "repaired" value on tomato.gg/tanks.gg).
  const trackHealth = num(C.maxHealth);
  const trackRepaired = num(C.maxRegenHealth);
  // The chassis stores a raw `repairTime`; the client divides it by the crew's
  // repair factor `0.57 + 0.43 * repairSkillLevel` (so 0.57 at base 100% crew
  // with no Repairs skill), giving the time to auto-repair a destroyed track.
  // We store the base-crew value so it matches the bare-vehicle view.
  const CREW_REPAIR_BASE = 0.57;
  const rawRepairTime = num(C.repairTime);
  const trackRepairTime =
    rawRepairTime != null ? rawRepairTime / CREW_REPAIR_BASE : null;
  const ammoBay = isObject(hull.ammoBayHealth) ? (hull.ammoBayHealth as XmlNode) : {};
  const ammoRackHealth = num(ammoBay.maxHealth);
  const ammoRackRepaired = num(ammoBay.maxRegenHealth);
  const engineRepaired = num(E.maxRegenHealth);
  const fuelTankHealth = num(F.maxHealth);
  const fuelTankRepaired = num(F.maxRegenHealth);
  // The turret ring (rotator) and viewport (surveying device) HP live on the
  // turret for turreted tanks, on the hull for casemates.
  const moduleField = (key: string, field: string): number | null => {
    const t = isObject(T[key]) ? (T[key] as XmlNode) : null;
    const h = isObject(hull[key]) ? (hull[key] as XmlNode) : null;
    return num(t?.[field]) ?? num(h?.[field]);
  };
  const turretRingHealth = moduleField("turretRotatorHealth", "maxHealth");
  const turretRingRepaired = moduleField("turretRotatorHealth", "maxRegenHealth");
  const viewportHealth = moduleField("surveyingDeviceHealth", "maxHealth");
  const viewportRepaired = moduleField("surveyingDeviceHealth", "maxRegenHealth");

  // --- other ---
  const viewRange = num(T.circularVisionRadius);
  const radioRange = num(R.distance);

  const invis = isObject(root.invisibility) ? (root.invisibility as XmlNode) : {};
  const camoStill = num(invis.still);
  const camoMoving = num(invis.moving);
  const firePenalty = num(invis.firePenalty) ?? 0;
  const camoStillFiring = camoStill != null ? camoStill * (1 - firePenalty) : null;
  const camoMovingFiring = camoMoving != null ? camoMoving * (1 - firePenalty) : null;

  return {
    tankId,
    tag,
    damage,
    moduleDamage,
    splashRadius,
    reload,
    rof,
    intraClipReload,
    clipSize,
    dpm,
    penetration,
    penetration500,
    caliber,
    shellVelocity,
    maxRange,
    ammoCapacity,
    accuracy,
    aimTime,
    dispMoving,
    dispTankTraverse,
    dispTurretTraverse,
    dispAfterShot,
    dispWhileDamaged,
    gunArc,
    depression,
    elevation,
    speedForward,
    speedBackward,
    hullTraverse,
    turretTraverse,
    enginePower,
    powerWeight,
    terrainHard,
    terrainMedium,
    terrainSoft,
    health,
    engineHealth,
    engineFireChance,
    hullArmorFront,
    hullArmorSide,
    hullArmorRear,
    turretArmorFront,
    turretArmorSide,
    turretArmorRear,
    trackArmor,
    trackHealth,
    trackRepaired,
    trackRepairTime,
    ammoRackHealth,
    ammoRackRepaired,
    engineRepaired,
    fuelTankHealth,
    fuelTankRepaired,
    turretRingHealth,
    turretRingRepaired,
    viewportHealth,
    viewportRepaired,
    weight,
    viewRange,
    radioRange,
    camoStill,
    camoMoving,
    camoStillFiring,
    camoMovingFiring,
    buyCredits,
    buyGold,
    shellCost,
    ammoCost,
    shellStats,
  };
}

/**
 * Every valid module combination for one tank, each fully derived. Fetches the
 * one nation's shared component files plus the tank's own XML, then walks the
 * cartesian product of chassis x turret x (that turret's guns) x engine x
 * radio. `tankId` is decoded to (nationIdx, localId) with the same bit layout
 * `computeTankId` produces, so the caller only needs the numeric id.
 */
