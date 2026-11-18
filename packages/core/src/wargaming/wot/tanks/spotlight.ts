import { desc, isNotNull } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { tankIntroductions } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { getTankDataset, type TankRowIdentity } from "./dataset";

/** How many vehicles the spotlight shows. */
export const SPOTLIGHT_SIZE = 8;

export type SpotlightTank = {
  identity: TankRowIdentity;
  /** The update that released it, or null for a vehicle only the Common Test
   * client carries. */
  releasedIn: string | null;
};

/**
 * The newest vehicles: the ones about to ship, then the ones that just did.
 *
 * The Common Test's come first, then each update's releases, newest update
 * first, until there are `SPOTLIGHT_SIZE` of them. An update that added more
 * than fits is cut, one that added fewer is topped up from the one before.
 *
 * Both halves come from what the site already records: the Common Test flag the
 * vehicles cron sets from the test client, and the release line the tank
 * history writes when a vehicle first appears with real characteristics.
 *
 * What a reader means by "a new tank" is narrower than what the client adds,
 * so three things are left out. An event or story-mode vehicle and an event bot
 * (`variant`, `eventRole`), which nobody can take into a battle of their own.
 * And a reissue (see `isReissue`).
 */
export async function getTankSpotlight(region: Region): Promise<SpotlightTank[]> {
  const [dataset, releases] = await Promise.all([
    getTankDataset(region),
    db
      .select({
        tankId: tankIntroductions.tankId,
        releasedVersion: tankIntroductions.releasedVersion,
      })
      .from(tankIntroductions)
      .where(isNotNull(tankIntroductions.releasedVersion))
      .orderBy(desc(tankIntroductions.releasedAt)),
  ]);

  const identities = dataset.map((row) => row.identity);
  const byId = new Map(identities.map((t) => [t.tankId, t]));
  const names = new Set(identities.map((t) => t.name));
  const isShown = (t: TankRowIdentity) =>
    t.tier > 0 &&
    t.variant === null &&
    t.eventRole === null &&
    !isReissue(t.name, names);

  const upcoming: SpotlightTank[] = identities
    .filter((t) => t.isCommonTest && isShown(t))
    .sort(byTierThenName)
    .map((identity) => ({ identity, releasedIn: null }));

  // Grouped by update in release order, so a version's vehicles stay together
  // and are ranked among themselves rather than by the second they were seen.
  const versions = new Map<string, TankRowIdentity[]>();
  for (const row of releases) {
    const t = byId.get(row.tankId);
    if (!t || t.isCommonTest || !isShown(t) || !row.releasedVersion) continue;
    const list = versions.get(row.releasedVersion) ?? [];
    list.push(t);
    versions.set(row.releasedVersion, list);
  }
  const released = [...versions].flatMap(([version, tanks]) =>
    tanks.sort(byTierThenName).map((identity) => ({ identity, releasedIn: version })),
  );

  return [...upcoming, ...released].slice(0, SPOTLIGHT_SIZE);
}

/**
 * Whether a vehicle is another one handed out again: the original's name and a
 * short mode token after it (`IS-7 7x7` for Onslaught, `T-44 FL` for Frontline,
 * `T110E5 BS`, `IS-7 IGR`, `T-43 (tr.)`).
 *
 * The name rather than the characteristics, which was tried first and is wrong
 * both ways. A rebadge sold or awarded as its own vehicle (the Fossa VM 68, the
 * Fireborn, the Erlang Shen) measures exactly like an older tank and is still
 * what players call new, while the tier XI Onslaught editions are retuned and
 * match nothing. One token of five characters at most, so a named rebadge
 * (`Tiger (P) Leoponsan`) is not mistaken for one.
 */
function isReissue(name: string, names: ReadonlySet<string>): boolean {
  const space = name.lastIndexOf(" ");
  if (space <= 0) return false;
  const suffix = name.slice(space + 1);
  return suffix.length <= 5 && names.has(name.slice(0, space));
}

function byTierThenName(a: TankRowIdentity, b: TankRowIdentity): number {
  return b.tier - a.tier || a.name.localeCompare(b.name);
}
