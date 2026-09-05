import { num, numList, tokens, isObject, type XmlNode } from "./xml";
import type { WotSrcSpec } from "./index";

// What a gun loads, read off the client's own shot table.
//
// Its own file because it answers a different question from the rest of the
// specification: everything there describes the vehicle, and this describes
// what leaves the barrel. A gun lists several shots and each names a shell
// defined once for the whole nation, so the two have to be read together, and
// the pair is what an ammunition panel and an armour view both work from.

/** The shell a gun loads by default, and everything it can load. */
export type Loadout = {
  /** The default shot's own node, which the gun's figures are read against. */
  shot: XmlNode;
  /** And the shell it names, from the nation's shared table. */
  shell: XmlNode;
  /** Every shot the gun lists, so the caller can walk them again. */
  shotEntries: [string, XmlNode][];
  /** What each of them does, in the shape the specification publishes. */
  shellStats: WotSrcSpec["shellStats"];
};

/**
 * Read a gun's shots and the shells they name.
 *
 * The default shot is the one with the largest `defaultPortion`, which is the
 * client's own way of saying which round a crew loads first, rather than the
 * first one listed.
 */
export function readLoadout(
  G: XmlNode,
  shared: { shells: XmlNode },
): Loadout {
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
            // What the shell does when it meets sloped armour. Normalisation is
            // how many degrees it straightens on impact, and past the ricochet
            // angle it glances off instead of biting. Both belong to the shell,
            // not the gun, and an armour view cannot answer anything without
            // them. A shell that declares neither never ricochets.
            normalization: num(def.normalizationAngle) ?? 0,
            ricochet: num(def.ricochetAngle) ?? 90,
            // Calibre decides the two- and three-calibre rules, which is why it
            // is read per shell rather than taken from the gun: a gun can fire
            // shells of different calibres.
            caliber: num(def.caliber) ?? num(sh.caliber),
            // How far the shell carries, which bounds the falloff its two
            // penetrations describe.
            maxDistance: num(sh.maxDistance),
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
  return { shot, shell, shotEntries, shellStats };
}
