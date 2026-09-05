import type { Shot } from "@/services/tank-viewer/armour";

/** What the client publishes about one shell, of what the hero needs. */
type Published = {
  type?: string | null;
  pen?: number | null;
  pen500?: number | null;
  caliber?: number | null;
  normalization?: number | null;
  ricochet?: number | null;
  damage?: number | null;
  /** Its own icon, which is not its kind's: a premium round has its own. */
  icon?: string | null;
  shortName?: string | null;
  kindName?: string | null;
  name?: string | null;
  /** What it becomes once a calibrating gun is deployed, where it can be. */
  calibrated?: {
    normalization?: number;
    ricochet?: number;
    damage?: number;
    penetrationLoss?: number;
  } | null;
};

/** One round the hero can answer for, with enough of it to be offered. */
export type HeroShell = {
  /** What the rules need, and all they need. */
  shot: Shot;
  /**
   * The same shell once the gun has been calibrated, where it can be.
   *
   * A gun with extra chambers trades armour damage for penetrating power, and
   * the two figures that decide whether a plate is beaten are among what it
   * trades: five more degrees of normalisation and five more of tolerance
   * before it glances off. An armour view that answered with the travelling
   * figures while the tank is deployed would be answering about a shell it is
   * not firing.
   */
  deployed?: Shot;
  /** Its own name, falling back to its kind and then to the raw type. */
  name: string;
  /** The short mark the button carries, `AP`, `APCR`, `HE`. */
  short: string;
  /** The client's own icon for this round, premium variants included. */
  icon: string;
  damage: number | null;
  penetration: number;
};

/**
 * Enough of a tank's detail payload to find its rounds.
 *
 * `specs` is read as `unknown` on purpose. The endpoint declares it as a loose
 * object, so the generated client types it as an opaque value, and the shape is
 * only known by looking: narrowing here is the honest reading rather than a cast
 * that claims to know what the spec does not say.
 */
type Detail = {
  configs?: { specs?: unknown; keys?: { gun?: string } }[] | null;
};

/** The published shells of a config, where it has any that can be read. */
function shellsOf(specs: unknown): Published[] {
  if (typeof specs !== "object" || specs === null) return [];
  const found = (specs as { shellStats?: unknown }).shellStats;
  return Array.isArray(found) ? (found as Published[]) : [];
}

/**
 * The rounds the hero can answer for, in the order the client lists them.
 *
 * **The first is the standard one, not the best one.** A tank's premium round
 * goes through more of everything, so opening on it would paint a greener
 * vehicle than the one most players meet. It stays the default, and the rest
 * are offered beside it rather than instead of it.
 *
 * A shell that has not published what the rules need is dropped rather than
 * guessed at. Normalisation and the ricochet angle decide whether a plate is
 * beaten or glanced off, and a guess at them is an armour view that is
 * confidently wrong, which is worse than one round fewer to choose from.
 */
/**
 * The rounds of every gun the vehicle can mount, by the gun's own name.
 *
 * **Per gun, because a gun is what a round belongs to.** The E 100's 12.8 cm
 * loads an APCR round of 530 damage and the 15 cm a HEAT round of 750: read off
 * the first config alone, a reader who upgrades gets the new barrel drawn on
 * the vehicle and the old barrel's ammunition to shoot with it.
 */
export function heroShells(detail: Detail): Record<string, HeroShell[]> {
  const out: Record<string, HeroShell[]> = {};
  for (const config of detail.configs ?? []) {
    // **A config with no names on its modules still has rounds.** The names
    // come from the client's own data, and a vehicle it does not describe
    // publishes a build without them: the Pudel is one. Filed under the empty
    // key, which is what the viewer falls back to when it has no gun to name,
    // so such a tank keeps its live view instead of losing it to a missing
    // label.
    const gun = config.keys?.gun ?? "";
    if (out[gun]) continue;
    out[gun] = roundsOf(config.specs);
  }
  return out;
}

function roundsOf(specs: unknown): HeroShell[] {
  return shellsOf(specs).flatMap((shell) => {
    // The near figure, since the hero shows a vehicle at arm's length rather
    // than across a map. The falloff to `pen500` is what a range control would
    // drive, and there is no range control yet.
    const penetration = shell.pen ?? shell.pen500;
    if (
      typeof penetration !== "number" ||
      typeof shell.caliber !== "number" ||
      typeof shell.normalization !== "number" ||
      typeof shell.ricochet !== "number"
    ) {
      return [];
    }
    const kind = shell.type ?? "";
    const shot = {
      penetration,
      caliber: shell.caliber,
      normalisation: shell.normalization,
      ricochet: shell.ricochet,
      kind,
    };
    const tuned = shell.calibrated;
    return [
      {
        shot,
        // Only what the client restates: a field it leaves alone keeps the
        // figure the shell already had rather than being invented.
        ...(tuned
          ? {
              deployed: {
                ...shot,
                normalisation: tuned.normalization ?? shot.normalisation,
                ricochet: tuned.ricochet ?? shot.ricochet,
              },
            }
          : {}),
        name: shell.name ?? shell.kindName ?? kind,
        short: shell.shortName ?? kind,
        icon: shell.icon ?? kind,
        damage: shell.damage ?? null,
        penetration,
      },
    ];
  });
}
