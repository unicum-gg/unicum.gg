"use client";

import { useLayoutEffect } from "react";

import { isVehiclePage } from "@/components/tanks/detail/tabs";

/**
 * Where a vehicle's page opens, and whether it moves at all for a reader who is
 * already on one.
 *
 * **Next scrolls to the segment the navigation created, and on this page that
 * segment sits under the hangar.** Every level a navigation creates shares one
 * scroll signal and the first handler to mount consumes it, and React commits a
 * child's layout effects before its parent's, so the level that consumes it is
 * always the deepest new one: the tab's own panel, which begins 770 pixels down,
 * below a 600 pixel picture. Next puts the document at the top first and only
 * falls back to scrolling that panel into view when it is still below the fold,
 * so what the reader gets depends on the height of their window. Measured from
 * the catalogue at 1200 pixels of scroll: an 884 pixel viewport landed at 0, a
 * 760 pixel one at 770, with the whole hangar off the top of the screen.
 *
 * So both ends of a navigation are decided here instead of left to the
 * framework, and the two wrappers every navigation on the site goes through
 * (`@/components/link` for the anchors, `@/hooks/use-router` for the pushes)
 * read this one module.
 *
 * **The two halves have to stay matched.** Every address `isVehiclePage` answers
 * yes for is served under the `(detail)` route group, whose layout mounts the
 * shell that reads the note below, so a destination Next is refused is always
 * one that puts itself right. A vehicle page added outside that group would be
 * refused by the first half and never answered by the second, which is a reader
 * left at whatever the page before it was scrolled to.
 */

/**
 * Whether the page about to open should put the document at its top.
 *
 * **Recorded as the navigation happens, and nowhere else.** It cannot be decided
 * at the arrival, because nothing there tells a click from a step back through
 * history: `history.scrollRestoration` is left at `auto` (the App Router sets
 * nothing), so the browser has already restored a traversal's own position by
 * the time the hero mounts, and a restored 2000 and a carried-over 2000 are the
 * same number. Nor can it be recorded by the render that decides the prop below,
 * since every vehicle link on a catalogue page renders and only one of them is
 * ever followed.
 */
let opensAtTop = false;

/**
 * Whether this destination is one that decides where it opens.
 *
 * A vehicle's page, less the links that name an anchor in it: an address
 * carrying a fragment has already said where it opens, and scrolling to one is
 * something Next does for itself.
 */
function opensItself(to: string): boolean {
  return isVehiclePage(to) && !to.includes("#");
}

/**
 * Whether Next may scroll on a navigation to this address.
 *
 * Never, into a vehicle's page: that one decides where it opens itself, a few
 * lines down. `undefined` hands the decision back to Next, which is every other
 * destination on the site.
 */
export function mayScrollTo(to: string): boolean | undefined {
  return opensItself(to) ? false : undefined;
}

/**
 * Told as a navigation starts, from the address being left to the one being
 * opened.
 *
 * Within a vehicle nothing moves: the reader is looking at the hangar, and
 * staying put is the one outcome with no movement in it, which is what lets
 * another vehicle keep the frame the picture hands over and a tab change replace
 * only what sits under it. An arrival from anywhere else opens at the top, which
 * is what a tall window already did and what a reader asked for by clicking a
 * tank.
 */
export function openingVehicle(from: string, to: string): void {
  if (opensItself(to) && !isVehiclePage(from)) opensAtTop = true;
}

/** Read once by the hero as it appears. */
export function useVehicleArrival(): void {
  useLayoutEffect(() => {
    if (!opensAtTop) return;
    opensAtTop = false;
    // In a layout effect, so the page is never painted at the position the one
    // before it was left at, and instant for the same reason: this is where the
    // page opens rather than a movement anyone means to watch.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
}
