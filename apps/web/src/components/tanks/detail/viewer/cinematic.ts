// Whether the camera is allowed to wander, named once.
//
// Its own module because both the viewer and the row of controls need it, and
// the row is rendered by the viewer: a mode that lived in either would have to
// import what imports it.

/**
 * How the hangar drift is offered.
 *
 * **Three positions rather than a toggle, because a drifting hero is two
 * different things to two readers.** Someone who came to look at a vehicle
 * wants it to turn itself; someone reading armour off it wants it to hold
 * still. `Auto` serves both by waiting, and the ends are for anyone the wait
 * does not suit.
 */
export enum Cinematic {
  /** It never wanders. The camera stays wherever it was put. */
  Off = "off",
  /** It wanders once the reader has left it alone for a while. */
  Auto = "auto",
  /** It wanders, and picks up again the moment the reader lets go. */
  On = "on",
}

/**
 * Seconds the camera must be left alone before it starts to wander.
 *
 * The client waits 30, 45 or 60 seconds by the player's own setting, and the
 * shortest is what a page can reasonably hold someone for. **The other two
 * positions are that same wait at its ends**: nothing to wait for, or a wait
 * that never arrives. Turning the drift off is therefore the mode it already
 * has rather than a second switch beside it, and two switches for one behaviour
 * is how they fall out of step.
 */
export const CINEMATIC_WAIT: Record<Cinematic, number> = {
  [Cinematic.Off]: Number.POSITIVE_INFINITY,
  [Cinematic.Auto]: 30,
  [Cinematic.On]: 0,
};

/** What one press moves to, so the three come round on a single control. */
export const CINEMATIC_NEXT: Record<Cinematic, Cinematic> = {
  [Cinematic.Off]: Cinematic.Auto,
  [Cinematic.Auto]: Cinematic.On,
  [Cinematic.On]: Cinematic.Off,
};

/** What position it is in, for anyone reading the page rather than seeing it. */
export const CINEMATIC_LABEL: Record<Cinematic, string> = {
  [Cinematic.Off]: "Cinematic camera: off",
  [Cinematic.Auto]: "Cinematic camera: when left alone",
  [Cinematic.On]: "Cinematic camera: always",
};

/** And what that position does, in the tooltip the mark cannot say itself. */
export const CINEMATIC_TOOLTIP: Record<Cinematic, string> = {
  [Cinematic.Off]: "Cinematic camera: off, the view stays put",
  [Cinematic.Auto]: "Cinematic camera: starts after 30 seconds alone",
  [Cinematic.On]: "Cinematic camera: always, from the moment you let go",
};
