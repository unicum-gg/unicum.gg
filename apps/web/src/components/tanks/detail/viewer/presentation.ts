// How much room the picture is given, named once.
//
// Its own module for the same reason as the views: the row of controls that
// offers these is rendered by the viewer, so a viewer that named them would
// have to import what imports it.

/**
 * The three sizes the hero can be looked at.
 *
 * **Two ways to fill, because they are not the same offer.** Filling the window
 * keeps the browser where it is: the tabs, the address bar and the rest of the
 * screen stay, and so does everything a reader uses to leave. Filling the
 * screen gives the vehicle the whole display and takes those away, which is
 * worth it to read armour off a plate and a nuisance for a glance.
 */
export enum Presentation {
  /** In the page, in the band it belongs to. */
  Inline = "inline",
  /** Over the whole browser window, the page still behind it. */
  Windowed = "windowed",
  /** The display itself, through the browser's own full screen. */
  Screen = "screen",
}

/** What each button does from where the picture currently is. */
export const PRESENTATION_LABEL: Record<
  Exclude<Presentation, Presentation.Inline>,
  { enter: string; leave: string }
> = {
  [Presentation.Windowed]: {
    enter: "Fill the window",
    leave: "Back into the page",
  },
  [Presentation.Screen]: {
    enter: "Fill the screen",
    leave: "Leave full screen",
  },
};
