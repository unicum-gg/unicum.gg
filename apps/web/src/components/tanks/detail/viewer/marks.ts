// The marks of excellence on the gun, named once.
//
// Its own module for the same reason as the cinematic mode: both the viewer and
// the row of controls need these words, and the row is rendered by the viewer,
// so a name that lived in either would have to import what imports it.

/**
 * How many marks the gun can wear.
 *
 * The game paints at most three, and the mirror publishes one texture per mark,
 * so what a vehicle can actually show is the length of that list rather than
 * this. Kept as the ceiling a control offers when it has nothing better.
 */
export const MARKS_MOST = 3;

/** What one press moves to, so the counts come round on a single control. */
export function nextMarks(count: number, available: number): number {
  return count >= Math.min(available, MARKS_MOST) ? 0 : count + 1;
}

/**
 * What wearing this many says about the player, in their own terms.
 *
 * A mark is a claim rather than a decoration: it is painted for beating a share
 * of everyone who plays that vehicle, on average damage. So the control says
 * which share, since the barrel cannot.
 */
export const MARKS_MEANING: Record<number, string> = {
  0: "No marks of excellence",
  1: "One mark: ahead of 65% of players on this tank",
  2: "Two marks: ahead of 85%",
  3: "Three marks: ahead of 95%",
};

/** What it is showing, for anyone reading the page rather than seeing it. */
export function marksLabel(count: number): string {
  return count === 0
    ? "No marks of excellence"
    : `${count} mark${count > 1 ? "s" : ""} of excellence`;
}
