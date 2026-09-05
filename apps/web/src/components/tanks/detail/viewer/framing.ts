// Where the camera stands, and what it is aiming at.
//
// The angle and the distance the hero is framed at, kept apart from everything
// that moves the camera because they are not choices the viewer makes: they are
// measured against the picture the 3D one replaced, so that a reader who knew
// the old hero sees the same tank at the same size in the same place.

/**
 * How the picture this replaces was framed, fitted rather than guessed.
 *
 * WG's portal renders are all shot from one camera and none of its numbers are
 * published. They were recovered by driving this viewer through a sweep of
 * angles and distances and comparing the silhouette it draws against a real
 * render's: how tall the outline is for its width, and how much of its own box
 * it fills, pin the angle down to about a percent. Twenty degrees round and
 * twenty-six up, at a distance matching the width to within one percent.
 *
 * The anchor is where the model has to land afterwards, in fractions of the
 * canvas. It is deliberately not WG's published centroid: that measures a centre
 * of mass and this measures an outline, so the two do not coincide, and what
 * matters is only that the model sits where the picture sat.
 *
 * **Moving it a hundredth moves the vehicle two.** The offset is given as a
 * fraction of the frame and read as one of the half-frame either side of centre,
 * so a correction applied at face value overshoots by exactly double, which is
 * how the first attempt turned an error of three points below into three above.
 */
export const AZIMUTH = (20 * Math.PI) / 180;
export const ELEVATION = (26 * Math.PI) / 180;
/**
 * How far back the camera stands, in metres, and the same for every vehicle.
 *
 * **The picture this replaces does not fit the frame to the tank, and neither
 * can this.** Framing each vehicle to fill the band is the obvious thing to do
 * and it is what a first pass did, but it makes a scout as big as a heavy, and
 * the render underneath keeps them at their real sizes. Measured against WG's
 * own renders, the framing distance they imply holds steady while a fitted one
 * would not: 20.6 for the IS-7, 20.0 for the Object 140 and 21.9 for the T-70,
 * whose own fitted distances run from 8.9 to 19.6. A fitted camera had the T-70
 * two and a half times too big.
 *
 * So the vehicles differ in size on screen, as they do in the game, and a Maus
 * fills the hero while a light sits inside it.
 */
export const DISTANCE = 19.8;
/** How long the outgoing view takes to dissolve, in milliseconds. */
export const VIEW_DISSOLVE = 180;

export const ANCHOR_X = 0.395;
export const ANCHOR_Y = 0.4484;
