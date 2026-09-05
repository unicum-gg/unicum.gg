import STORAGE from "@/constants/storage";
import { Cinematic } from "@/components/tanks/detail/viewer/cinematic";

/**
 * How the reader likes to be shown a tank, kept between vehicles and visits.
 *
 * **The settings that describe the reader, not the vehicle.** A link says what
 * a tank is doing: which view, what it is wearing, what is being fired at it.
 * None of that belongs here, and it is already carried in the shared token.
 * What is here is the other half: whether this reader wants the sharp textures,
 * whether they want the camera to wander, whether they want the tracks moving
 * and where they want the vehicle framed. Those answers hold from one tank to
 * the next, and asking them again on every page is the site forgetting who it
 * is talking to.
 */
export type Preferences = {
  /** The larger texture set, where the vehicle has one. */
  sharp: boolean;
  /** Whether the camera wanders, and on what terms. */
  cinematic: Cinematic;
  /** Whether the running gear turns. */
  rolling: boolean;
  /** Whether the vehicle is framed in the middle of the band. */
  centred: boolean;
};

const DEFAULTS: Preferences = {
  sharp: true,
  cinematic: Cinematic.Auto,
  rolling: true,
  centred: false,
};

const KINDS = new Set<string>([Cinematic.Off, Cinematic.Auto, Cinematic.On]);

/**
 * What this reader last asked for, or the defaults where they never have.
 *
 * Read field by field, so a stored answer that no longer makes sense costs its
 * own setting rather than all four: the file is written by a version of this
 * page and read by whichever one the reader loads next.
 */
export function preferences(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const held = window.localStorage.getItem(STORAGE.LOCAL_STORAGE.VIEWER_PREFS);
    if (!held) return DEFAULTS;
    const kept = JSON.parse(held) as Partial<Preferences>;
    return {
      sharp: typeof kept.sharp === "boolean" ? kept.sharp : DEFAULTS.sharp,
      cinematic:
        typeof kept.cinematic === "string" && KINDS.has(kept.cinematic)
          ? (kept.cinematic as Cinematic)
          : DEFAULTS.cinematic,
      rolling: typeof kept.rolling === "boolean" ? kept.rolling : DEFAULTS.rolling,
      centred: typeof kept.centred === "boolean" ? kept.centred : DEFAULTS.centred,
    };
  } catch {
    // A quota-blocked or privacy-mode browser answers by throwing, and a page
    // that cannot remember a preference is not a broken page.
    return DEFAULTS;
  }
}

/** Keep what the reader has just asked for, for the next vehicle they open. */
export function remember(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE.LOCAL_STORAGE.VIEWER_PREFS,
      JSON.stringify(prefs),
    );
  } catch {
    // As above: worth trying, never worth failing over.
  }
}
