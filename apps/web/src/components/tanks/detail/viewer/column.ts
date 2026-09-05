// The page's own column, which the hero bleeds past but its content keeps to.
//
// **Its own module, and deliberately not a client one.** Two things have to
// agree on where this column falls and neither can be the other's source: the
// shell lays the title and the panels out in it, and the viewer has to know
// where it is to keep the vehicle standing in the same place within it.
//
// It cannot live beside either of them, because the shell is server-rendered
// and the viewer is not. A `"use client"` module hands a server component a
// client reference for every export it names, which is what makes a component
// work across the boundary and what makes a plain value useless across it: read
// from the shell, this string arrived as a stub that throws on use and went
// into a `className` as the source text of a function. The content then took
// the full width of the window while the vehicle, anchored from the client
// side, stood correctly in a column that was no longer drawn.
export const HERO_COLUMN = "mx-auto w-full max-w-7xl";

/**
 * How tall the band stands: the column's own 32:15, never the window's.
 *
 * **Carried by the column rather than by the band.** The ratio has to be read
 * against `HERO_COLUMN`'s width now that the band is wider than it: left on the
 * band it grew with the window, and since the camera's field of view is
 * vertical the vehicle grew with it, until at 2182 across the hero stood 1023
 * tall and the tank ran off the side.
 *
 * Capping the band's height instead does not work, and the reason is worth
 * knowing: `aspect-ratio` against a `max-height` gives up width to keep the
 * ratio, so the band shrank back to 1280 and stopped bleeding at all. The
 * column's width is definite, so there the ratio can only set a height, and the
 * band takes that height from it as its own.
 */
export const HERO_BAND = "sm:aspect-[32/15]";
