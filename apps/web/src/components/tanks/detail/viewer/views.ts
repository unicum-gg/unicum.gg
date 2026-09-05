// What the hero can be asked about one vehicle, named once.
//
// Its own module because the panels that label these views are rendered by the
// viewer, and a view that named them would have to import what imports it.

/**
 * The three questions this canvas can answer about one vehicle.
 *
 * They share the camera, the mounts and the floor, so switching between them is
 * a toggle rather than a reload: what changes is which of them is drawing.
 */
export enum View {
  /** The tank as the game draws it. */
  Visual = "visual",
  /** How thick each plate is, whatever is fired at it. */
  Collision = "collision",
  /** What the chosen shell would do, plate by plate. */
  Live = "live",
}

/** What each view is called where it is offered. */
export const VIEW_LABEL: Record<View, string> = {
  [View.Visual]: "Visual",
  [View.Collision]: "Collision",
  [View.Live]: "Live",
};

/** And what it answers, for anyone the word does not tell. */
export const VIEW_TOOLTIP: Record<View, string> = {
  [View.Visual]: "The tank as the game draws it",
  [View.Collision]: "How thick each plate is",
  [View.Live]: "What the chosen shell would do",
};
